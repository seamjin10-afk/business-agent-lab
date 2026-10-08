import Phaser from "phaser";
import { C, F } from "../rules/engine.js";
import { BattleSetup, DEFAULT_SETUP, Roster, createDemoBattle, playerControls } from "./setup";
import { Pose, buildGenericTextures, hasPose, preloadSprites, spriteKey } from "./sprites";
import { ActionChoice, Hud, Speed, sameChoice } from "./hud";
import demoParty from "../data/demo-party.json";

const T = 32;          // floor tile
const OX = 0, OY = 40; // board offset; OY leaves room for tall sprites on row 0
const ALLY = 0x5aa0ff, ENEMY = 0xff5a5a;

interface Unit {
  id: string;
  sprite: string; // unit id for sprite lookup
  team: string;
  n: number;      // footprint in tiles
  box: Phaser.GameObjects.Container;
  body: Phaser.GameObjects.Image;
  hpFill: Phaser.GameObjects.Rectangle;
  hpBack: Phaser.GameObjects.Rectangle;
  facing: 1 | -1;
}

/**
 * Pixel battle board. The rules engine (C) resolves an action in one go; F turns the
 * resulting log into ordered scenes, and this scene plays them one at a time:
 * move → wind-up → slash / projectile / spell → damage number + HP drop → death.
 */
export class BattleScene extends Phaser.Scene {
  private setup: BattleSetup = DEFAULT_SETUP;
  private roster!: Roster;
  private view: any;              // F presentation state: what the board currently shows
  private units = new Map<string, Unit>();
  private hud!: Hud;
  private speed: Speed = "normal";
  private busy = false;
  private choice: ActionChoice | null = null;
  private error = "";
  private overlay!: Phaser.GameObjects.Graphics;
  private floor!: Phaser.GameObjects.Container;
  private stats: Record<string, { dealt: number; taken: number; actions: number }> = {};
  private generation = 0; // bumps on "new battle" so a stale pump loop stops
  private fxObjects = new Set<Phaser.GameObjects.GameObject>();

  constructor() { super("battle"); }

  private get b() { return this.roster.battle; }

  preload() { preloadSprites(this); }

  create() {
    buildGenericTextures(this);
    buildFloorTextures(this);
    this.floor = this.add.container(0, 0);
    this.overlay = this.add.graphics().setDepth(1);
    this.hud = new Hud({
      newBattle: s => this.start(s),
      speed: s => { this.speed = s; },
      choose: c => { this.choice = c; this.error = ""; this.refreshControls(); },
      endTurn: () => this.endTurn(),
    }, (demoParty as any[]).map(p => p.state.profile.name));
    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => this.onBoardClick(p));
    if (location.search.includes("debug")) (window as any).__battle = () => ({ b: this.b, busy: this.busy, OX, OY, T });
    this.start(this.hud.current);
  }

  // ---------------------------------------------------------------- setup

  private start(setup: BattleSetup) {
    this.generation++;
    this.setup = setup;
    this.roster = createDemoBattle(setup);
    this.units.forEach(u => u.box.destroy());
    this.units.clear();
    this.tweens.killAll();
    this.fxObjects.forEach(o => o.destroy()); // effects whose tweens were just killed
    this.busy = false;
    this.choice = null;
    this.stats = {};
    this.drawFloor();
    for (const a of this.b.actors) this.units.set(a.id, this.makeUnit(a));
    this.view = F.presentationSnapshot(this.b);
    this.hud.reset();
    this.hud.log(`전투 시작 · 아군 ${this.b.actors.filter((a: any) => a.team === "allies").length}명 / 적 ${this.b.actors.filter((a: any) => a.team === "enemies").length}명`, "round");
    this.pump(this.generation);
  }

  private drawFloor() {
    this.floor.removeAll(true);
    const { width, height } = this.b.config;
    const rnd = new Phaser.Math.RandomDataGenerator([String(this.setup.seed)]);
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      this.floor.add(this.add.image(OX + x * T, OY + y * T, `floor-${rnd.between(0, 3)}`).setOrigin(0));
    }
    const g = this.add.graphics().lineStyle(1, 0x000000, 0.12);
    for (let x = 0; x <= width; x++) g.lineBetween(OX + x * T, OY, OX + x * T, OY + height * T);
    for (let y = 0; y <= height; y++) g.lineBetween(OX, OY + y * T, OX + width * T, OY + y * T);
    this.floor.add(g);
  }

  private makeUnit(a: any): Unit {
    const n = C.footprint(a);
    const sprite = this.roster.sprites[a.id] || "generic";
    const box = this.add.container(0, 0);
    const shadow = this.add.ellipse(0, -2, 22 * n, 8 * n, 0x000000, 0.35);
    const ring = this.add.ellipse(0, -2, 26 * n, 10 * n).setStrokeStyle(1, a.team === "allies" ? ALLY : ENEMY, 0.9);
    const body = this.add.image(0, 0, spriteKey(sprite, "idle")).setOrigin(0.5, 1);
    body.setScale((64 * n) / body.width);
    const top = -Math.min(body.displayHeight, 60 * n) - 4;
    const hpBack = this.add.rectangle(0, top, 24 * n, 3, 0x000000, 0.7);
    const hpFill = this.add.rectangle(-12 * n, top, 24 * n, 3, a.team === "allies" ? 0x6be36b : 0xe35b5b).setOrigin(0, 0.5);
    box.add([shadow, ring, body, hpBack, hpFill]);
    const u: Unit = { id: a.id, sprite, team: a.team, n, box, body, hpFill, hpBack, facing: a.team === "allies" ? 1 : -1 };
    this.placeAt(u, a.x, a.y);
    this.setPose(u, "idle");
    this.setHp(u, a.wounds, a.maxWounds, false);
    return u;
  }

  // ---------------------------------------------------------------- geometry

  private feet(x: number, y: number, n: number) {
    return { x: OX + x * T + (n * T) / 2, y: OY + (y + n) * T - 3 };
  }

  private placeAt(u: Unit, x: number, y: number) {
    const p = this.feet(x, y, u.n);
    u.box.setPosition(p.x, p.y).setDepth(10 + p.y);
  }

  private face(u: Unit, towardX: number) {
    if (Math.abs(towardX - u.box.x) > 2) u.facing = towardX < u.box.x ? -1 : 1;
    u.body.setFlipX(u.facing < 0);
  }

  private setPose(u: Unit, pose: Pose) {
    u.body.setTexture(spriteKey(u.sprite, pose));
    u.body.setFlipX(u.facing < 0);
  }

  private setHp(u: Unit, wounds: number, max: number, animate = true) {
    const ratio = Phaser.Math.Clamp(wounds / Math.max(1, max), 0, 1);
    if (animate && this.ms(350)) this.tweens.add({ targets: u.hpFill, scaleX: ratio, duration: this.ms(350) });
    else u.hpFill.scaleX = ratio;
  }

  // ---------------------------------------------------------------- turn loop

  private async pump(gen: number) {
    while (gen === this.generation && this.b.status === "running") {
      if (this.b.pending) {
        this.hud.idle("규칙 판정 보류 상태가 발생했습니다. 이 판정 처리는 아직 게임에 연결되지 않았습니다.");
        return;
      }
      const cur = C.current(this.b);
      this.hud.order(this.b, this.view, cur?.id);
      if (playerControls(this.setup, this.b, cur)) {
        this.b.controlled = cur.id;
        this.choice = this.defaultChoice(cur);
        this.refreshControls();
        return; // resumes from onBoardClick / endTurn
      }
      this.hud.idle(`${cur?.name ?? ""} 행동 중…`);
      await this.frame(); // let the "thinking" text paint before the AI blocks the thread
      await this.resolve(() => C.aiTurn(this.b));
    }
    if (gen === this.generation) this.finish();
  }

  /** Runs one engine call and plays every scene it produced, in order. */
  private async resolve(run: () => unknown) {
    this.busy = true;
    this.overlay.clear();
    this.view = F.presentationSnapshot(this.b);
    const since = this.b.logCounter;
    try { run(); } finally {
      const scenes = F.presentationScenes(F.visualEvents(this.b, since));
      for (const s of scenes) await this.play(s);
      this.syncToBattle();
      this.busy = false;
    }
  }

  private async play(scene: any) {
    F.beginPresentation(this.view, scene);
    if (scene.phase === "effect") await this.effect(scene);
    else if (scene.phase === "impact") await this.impact(scene);
    else if (scene.phase === "terminal") await this.death(scene);
    F.finishPresentation(this.view, scene);
    this.hud.logScene(scene);
    this.hud.order(this.b, this.view, C.current(this.b)?.id);
  }

  /** Snap everything to the engine's real state after a batch (guards against drift). */
  private syncToBattle() {
    for (const a of this.b.actors) {
      const u = this.units.get(a.id);
      if (!u) continue;
      this.placeAt(u, a.x, a.y);
      this.setHp(u, a.wounds, a.maxWounds, false);
    }
  }

  private finish() {
    this.overlay.clear();
    this.hud.order(this.b, this.view, undefined);
    this.hud.idle("전투 종료");
    this.hud.log(this.b.winner === "allies" ? "아군 승리" : this.b.winner === "enemies" ? "아군 패배" : "전투 종료", "round");
    this.hud.result(this.b, this.view, this.stats);
  }

  // ---------------------------------------------------------------- player input

  private choicesFor(a: any): ActionChoice[] {
    const out: ActionChoice[] = [];
    const melee = [...a.weapons].filter((w: any) => !w.ranged).sort((x: any, y: any) => (y.damage ?? 0) - (x.damage ?? 0))[0];
    if (melee) out.push({ action: "attack", label: `근접 공격 · ${melee.name}`, weaponId: melee.id });
    for (const w of a.weapons.filter((w: any) => w.ranged)) out.push({ action: "attack", label: `사격 · ${w.name}`, weaponId: w.id });
    for (const sp of a.spells || []) out.push({ action: "cast", label: `주문 · ${sp.koName || sp.ko || sp.name}`, spellId: sp.id });
    out.push({ action: "defend", label: "방어 태세" });
    return out;
  }

  private defaultChoice(a: any) { return this.choicesFor(a)[0] ?? null; }

  private refreshControls() {
    const a = C.current(this.b);
    if (!a || !playerControls(this.setup, this.b, a)) return;
    const moveLeft = Math.floor(C.movementRemaining(this.b, a) / 2);
    this.hud.controls(a, this.choicesFor(a), this.choice, moveLeft, this.error);
    if (this.choice?.action === "defend" && !a.actionUsed) { this.act(a, () => C.perform(this.b, a.id, "defend", {})); return; }
    this.drawOverlay(a);
  }

  private drawOverlay(a: any) {
    const g = this.overlay.clear();
    for (const p of C.movementPaths(this.b, a).filter((p: any) => p.cost > 0)) {
      g.fillStyle(0x3a7bd5, 0.28).fillRect(OX + p.x * T + 1, OY + p.y * T + 1, T - 2, T - 2);
    }
    if (a.actionUsed || !this.choice || this.choice.action === "defend") return;
    for (const t of this.b.actors.filter((t: any) => t.team !== a.team && C.active(t))) {
      const n = C.footprint(t);
      g.lineStyle(2, 0xff4444, 0.9).strokeRect(OX + t.x * T + 1, OY + t.y * T + 1, n * T - 2, n * T - 2);
    }
  }

  private onBoardClick(p: Pointer) {
    const a = C.current(this.b);
    if (this.busy || !a || !playerControls(this.setup, this.b, a) || this.b.status !== "running") return;
    const x = Math.floor((p.worldX - OX) / T), y = Math.floor((p.worldY - OY) / T);
    if (x < 0 || y < 0 || x >= this.b.config.width || y >= this.b.config.height) return;
    const foe = this.b.actors.find((t: any) => t.team !== a.team && C.active(t) && C.occupiesCell(t, x, y));
    if (foe && this.choice && this.choice.action !== "defend") {
      const c = this.choice;
      this.act(a, () => C.performTargetAction(this.b, a.id, c.action, { target: foe.id, weaponId: c.weaponId ?? C.weaponOf(a).id, spellId: c.spellId }));
      return;
    }
    const route = C.movementPaths(this.b, a).find((r: any) => r.x === x && r.y === y && r.cost > 0);
    if (route) this.act(a, () => C.perform(this.b, a.id, "move", { x, y, weaponId: this.choice?.weaponId }));
  }

  private async act(a: any, run: () => unknown) {
    const gen = this.generation;
    this.error = "";
    try {
      await this.resolve(() => {
        try { run(); } catch (e) { this.error = (e as Error).message; }
      });
    } finally {
      if (gen !== this.generation) return;
      const cur = C.current(this.b);
      const stillMine = this.b.status === "running" && cur?.id === a.id;
      if (stillMine && cur.actionUsed && C.movementRemaining(this.b, cur) < 2) return this.endTurn();
      if (stillMine) this.refreshControls();
      else this.pump(gen);
    }
  }

  private async endTurn() {
    const a = C.current(this.b);
    if (this.busy || !a || this.b.status !== "running") return;
    this.overlay.clear();
    await this.resolve(() => C.perform(this.b, a.id, "end", {}));
    this.pump(this.generation);
  }

  // ---------------------------------------------------------------- animation

  private ms(n: number) { return this.speed === "instant" ? 0 : this.speed === "fast" ? n / 2 : n; }

  private frame() { return new Promise<void>(r => this.time.delayedCall(16, r)); }

  private wait(n: number) { return n ? new Promise<void>(r => this.time.delayedCall(this.ms(n), r)) : Promise.resolve(); }

  private tween(cfg: Phaser.Types.Tweens.TweenBuilderConfig & { duration: number }) {
    return new Promise<void>(r => {
      if (this.ms(cfg.duration) === 0) {
        // Instant playback: jump to the end state (a yoyo tween ends where it started).
        if (!cfg.yoyo) {
          const targets = Array.isArray(cfg.targets) ? cfg.targets : [cfg.targets];
          for (const [k, v] of Object.entries(cfg)) if (!["targets", "duration", "ease", "repeat"].includes(k) && typeof v === "number") for (const t of targets) (t as any)[k] = v;
        }
        return r();
      }
      this.tweens.add({ ...cfg, duration: this.ms(cfg.duration), onComplete: () => r() });
    });
  }

  private center(u: Unit) { return { x: u.box.x, y: u.box.y - 18 * u.n }; }

  private async effect(scene: any) {
    const u = this.units.get(scene.actor);
    if (!u) return;
    const type = F.actionType(scene.action);
    const target = scene.target && scene.target !== scene.actor ? this.units.get(scene.target) : undefined;
    if (["attack", "ranged", "cast", "technique", "breath"].includes(type)) this.bump(scene.actor, "actions");

    if (type === "move") {
      const path = F.movementPath(scene);
      this.setPose(u, "move");
      for (const step of path.slice(1)) {
        const p = this.feet(step.x, step.y, u.n);
        this.face(u, p.x);
        await this.tween({ targets: u.box, x: p.x, y: p.y, duration: 110 });
        u.box.setDepth(10 + u.box.y);
      }
      this.setPose(u, "idle");
      return;
    }
    if (target) this.face(u, target.box.x);

    if (type === "attack") {
      this.setPose(u, "melee");
      const dx = target ? Math.sign(target.box.x - u.box.x) * 8 : u.facing * 8;
      const x0 = u.box.x;
      await this.tween({ targets: u.box, x: x0 + dx, duration: 90, ease: "Quad.easeOut" });
      if (target) this.slash(this.center(target), scene.action === "riposte" ? 0xfff2a0 : 0xffffff);
      await this.tween({ targets: u.box, x: x0, duration: 140 });
      await this.wait(80);
    } else if (type === "ranged") {
      this.setPose(u, "ranged");
      await this.wait(150);
      if (target) await this.projectile(this.center(u), this.center(target), 0xe8e0c8, 4);
    } else if (["cast", "channel", "technique", "breath"].includes(type)) {
      const theme = F.effectTheme(scene);
      const color = theme?.color ? Phaser.Display.Color.HexStringToColor(theme.color).color : 0xc9b8ff;
      this.setPose(u, hasPose(u.sprite, "cast") || type !== "technique" ? "cast" : "melee");
      await this.glow(this.center(u), color);
      if (type === "breath") await this.areaFlash(scene.areaCells || [], color);
      else if (target) await this.projectile(this.center(u), this.center(target), color, 6, true);
      for (const c of scene.areaCells || []) if (type !== "breath") this.cellFlash(c, color);
    } else if (type === "defend") {
      this.shield(u);
      await this.wait(350);
    } else {
      this.floatText(this.center(u), scene.label || scene.action, "#e8e0c8");
      await this.wait(350);
    }
    this.setPose(u, "idle");
  }

  private async impact(scene: any) {
    const losses = F.sceneLosses(scene);
    const jobs = losses.map(async (x: any) => {
      const u = this.units.get(x.actor);
      const v = this.view.actors[x.actor];
      if (!u || !v) return;
      if (x.amount > 0) {
        this.bump(x.actor, "taken", x.amount);
        if (scene.actor && scene.actor !== x.actor) this.bump(scene.actor, "dealt", x.amount);
      }
      this.floatText(this.center(u), x.amount > 0 ? `-${x.amount}` : `+${-x.amount}`, x.amount > 0 ? "#ff6b6b" : "#7dff8a", true);
      this.setHp(u, v.wounds, v.maxWounds);
      if (x.amount <= 0) return;
      this.setPose(u, "hit");
      u.body.setTint(0xff8080);
      const heavy = x.amount >= v.maxWounds * 0.4;
      if (heavy) this.cameras.main.shake(this.ms(180), 0.006);
      const x0 = u.box.x, amp = heavy ? 4 : 2;
      await this.tween({ targets: u.box, x: x0 + amp, duration: 40, yoyo: true, repeat: heavy ? 3 : 1 });
      u.box.x = x0;
      u.body.clearTint();
      if (!v.dead) this.setPose(u, "idle");
    });
    await Promise.all(jobs);
    await this.wait(150);
  }

  private async death(scene: any) {
    const u = this.units.get(scene.actor);
    if (!u) return;
    if (hasPose(u.sprite, "death")) this.setPose(u, "death");
    else await this.tween({ targets: u.body, angle: 90 * -u.facing, y: -4, duration: 260, ease: "Quad.easeIn" });
    u.body.setTint(0x888888);
    u.hpBack.setVisible(false);
    u.hpFill.setVisible(false);
    await this.tween({ targets: u.box, alpha: 0.55, duration: 200 });
    u.box.setDepth(5 + u.box.y / 1000);
    this.floatText(this.center(u), scene.label || "사망", "#d0d0d0");
    await this.wait(250);
  }

  private bump(id: string, k: "dealt" | "taken" | "actions", n = 1) {
    (this.stats[id] ||= { dealt: 0, taken: 0, actions: 0 })[k] += n;
  }

  // ------------------------------------------------------------- effect sprites

  /** Registers a short-lived effect object so a new battle can clear it mid-animation. */
  private fx<O extends Phaser.GameObjects.GameObject>(o: O): O {
    this.fxObjects.add(o);
    o.once("destroy", () => this.fxObjects.delete(o));
    return o;
  }

  private slash(at: { x: number; y: number }, color: number) {
    const g = this.fx(this.add.graphics({ x: at.x, y: at.y }).setDepth(2000));
    g.lineStyle(2, color, 1);
    for (const r of [10, 14]) { g.beginPath(); g.arc(0, 0, r, Phaser.Math.DegToRad(-60), Phaser.Math.DegToRad(40)); g.strokePath(); }
    this.sparks(at, 0xffd27a);
    this.tweens.add({ targets: g, alpha: 0, scale: 1.3, duration: this.ms(260) || 1, onComplete: () => g.destroy() });
  }

  private sparks(at: { x: number; y: number }, color: number) {
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + Math.random();
      const s = this.fx(this.add.rectangle(at.x, at.y, 2, 2, color).setDepth(2000));
      this.tweens.add({ targets: s, x: at.x + Math.cos(a) * 12, y: at.y + Math.sin(a) * 12, alpha: 0, duration: this.ms(240) || 1, onComplete: () => s.destroy() });
    }
  }

  private async projectile(from: { x: number; y: number }, to: { x: number; y: number }, color: number, size: number, orb = false) {
    const p = this.fx(orb
      ? this.add.circle(from.x, from.y, size / 2, color).setDepth(2000)
      : this.add.rectangle(from.x, from.y, size * 2, 2, color).setDepth(2000).setRotation(Math.atan2(to.y - from.y, to.x - from.x)));
    const glow = orb ? this.fx(this.add.circle(from.x, from.y, size, color, 0.35).setDepth(1999)) : null;
    const d = Phaser.Math.Distance.Between(from.x, from.y, to.x, to.y);
    await this.tween({ targets: glow ? [p, glow] : p, x: to.x, y: to.y, duration: Math.min(450, 120 + d * 1.2) });
    p.destroy(); glow?.destroy();
    orb ? this.burst(to, color) : this.sparks(to, 0xffffff);
  }

  private burst(at: { x: number; y: number }, color: number) {
    const c = this.fx(this.add.circle(at.x, at.y, 4, color, 0.8).setDepth(2000));
    this.tweens.add({ targets: c, radius: 16, alpha: 0, duration: this.ms(300) || 1, onComplete: () => c.destroy() });
    this.sparks(at, color);
  }

  private async glow(at: { x: number; y: number }, color: number) {
    const c = this.fx(this.add.circle(at.x, at.y, 6, color, 0.5).setDepth(2000));
    await this.tween({ targets: c, radius: 14, alpha: 0.15, duration: 260, yoyo: true });
    c.destroy();
  }

  private cellFlash(c: { x: number; y: number }, color: number) {
    const r = this.fx(this.add.rectangle(OX + c.x * T + T / 2, OY + c.y * T + T / 2, T, T, color, 0.45).setDepth(3));
    this.tweens.add({ targets: r, alpha: 0, duration: this.ms(400) || 1, onComplete: () => r.destroy() });
  }

  private async areaFlash(cells: { x: number; y: number }[], color: number) {
    cells.forEach((c, i) => this.time.delayedCall(this.ms(i * 8), () => this.cellFlash(c, color)));
    await this.wait(420);
  }

  private shield(u: Unit) {
    const s = this.fx(this.add.ellipse(u.box.x, u.box.y - 18 * u.n, 30 * u.n, 40 * u.n).setStrokeStyle(2, 0x9ad1ff, 0.9).setDepth(2000));
    this.tweens.add({ targets: s, alpha: 0, scale: 1.15, duration: this.ms(420) || 1, onComplete: () => s.destroy() });
  }

  private floatText(at: { x: number; y: number }, text: string, color: string, big = false) {
    const t = this.fx(this.add.text(at.x, at.y - 10, text, {
      fontFamily: "monospace", fontSize: big ? "14px" : "10px", color, stroke: "#000", strokeThickness: 3,
    }).setOrigin(0.5).setDepth(3000).setResolution(2));
    this.tweens.add({ targets: t, y: at.y - 30, alpha: 0, duration: this.ms(800) || 1, ease: "Quad.easeOut", onComplete: () => t.destroy() });
  }
}

type Pointer = Phaser.Input.Pointer;

/** Placeholder forest floor until the background tiles are drawn. */
function buildFloorTextures(scene: Phaser.Scene) {
  const tones = [0x3d6b3a, 0x426f3c, 0x3a6536, 0x45733f];
  tones.forEach((base, i) => {
    const g = scene.add.graphics();
    g.fillStyle(base).fillRect(0, 0, T, T);
    const r = new Phaser.Math.RandomDataGenerator([String(i)]);
    for (let k = 0; k < 14; k++) {
      g.fillStyle(r.pick([0x335c30, 0x4f8247, 0x2e532b])).fillRect(r.between(0, T - 2), r.between(0, T - 3), 1, r.between(1, 3));
    }
    if (i === 3) g.fillStyle(0xd8c65a).fillRect(r.between(4, 26), r.between(4, 26), 2, 2);
    g.generateTexture(`floor-${i}`, T, T);
    g.destroy();
  });
}
