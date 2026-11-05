import Phaser from "phaser";
import { C, F } from "../rules/engine.js";
import { BattleSetup, DEFAULT_SETUP, Roster, createDemoBattle, playerControls } from "./setup";
import { Pose, buildGenericTextures, hasPose, preloadSprites, spriteKey } from "./sprites";
import { Hud, Speed } from "./hud";
import * as K from "./ranks";
import demoParty from "../data/demo-party.json";

const W = 640, H = 424;
const GROUND = 300;            // feet line
const MID = W / 2;
const FRONT = 46, STEP = 72;   // px from centre to rank 1, and between ranks
const ALLY = 0x5aa0ff, ENEMY = 0xff5a5a;

interface Unit {
  id: string;
  sprite: string;
  team: string;
  box: Phaser.GameObjects.Container;
  body: Phaser.GameObjects.Image;
  crowd: Phaser.GameObjects.Image[]; // extra bodies drawn for a Swarm
  hpFill: Phaser.GameObjects.Rectangle;
  hpBack: Phaser.GameObjects.Rectangle;
  rankTag: Phaser.GameObjects.Text;
  facing: 1 | -1;
  n: number;
}

/**
 * Rank battle (Darkest Dungeon style): both sides stand in 4 ranks facing each other.
 * ranks.ts decides what is legal and runs the engine; F turns the engine log into
 * ordered scenes and this scene plays them one at a time.
 */
export class BattleScene extends Phaser.Scene {
  private setup: BattleSetup = DEFAULT_SETUP;
  private roster!: Roster;
  private f!: K.Formation;
  private view: any;
  private units = new Map<string, Unit>();
  private hud!: Hud;
  private speed: Speed = "normal";
  private busy = false;
  private choice: K.RankAction | null = null;
  private error = "";
  private marks!: Phaser.GameObjects.Graphics;
  private stats: Record<string, { dealt: number; taken: number; actions: number }> = {};
  private generation = 0;
  private fxObjects = new Set<Phaser.GameObjects.GameObject>();

  constructor() { super("battle"); }

  private get b() { return this.roster.battle; }

  preload() { preloadSprites(this); }

  create() {
    buildGenericTextures(this);
    drawBackdrop(this);
    this.marks = this.add.graphics().setDepth(5);
    this.hud = new Hud({
      newBattle: s => this.start(s),
      speed: s => { this.speed = s; },
      choose: c => this.choose(c),
      endTurn: () => this.endTurn(),
    }, (demoParty as any[]).map(p => p.state.profile.name));
    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => this.onClick(p));
    if (location.search.includes("debug")) (window as any).__battle = () => ({ b: this.b, f: this.f, busy: this.busy, pos: (id: string) => { const u = this.units.get(id)!; return { x: u.box.x, y: u.box.y - 24 }; } });
    this.start(this.hud.current);
  }

  // ---------------------------------------------------------------- setup

  private start(setup: BattleSetup) {
    this.generation++;
    this.setup = setup;
    this.roster = createDemoBattle(setup);
    this.f = K.makeFormation(this.b);
    this.units.forEach(u => u.box.destroy());
    this.units.clear();
    this.tweens.killAll();
    this.fxObjects.forEach(o => o.destroy());
    this.busy = false;
    this.choice = null;
    this.stats = {};
    for (const a of this.b.actors) this.units.set(a.id, this.makeUnit(a));
    this.layout(false);
    this.view = F.presentationSnapshot(this.b);
    this.hud.reset();
    this.hud.log(`전투 시작 · 아군 ${this.f.allies.length}명 / 적 ${this.f.enemies.length}명 (4열 대열)`, "round");
    this.pump(this.generation);
  }

  private makeUnit(a: any): Unit {
    const sprite = this.roster.sprites[a.id] || "generic";
    const n = C.footprint(a) > 1 ? 1.5 : 1;
    const box = this.add.container(0, GROUND);
    const shadow = this.add.ellipse(0, -2, 34 * n, 9, 0x000000, 0.35);
    const ring = this.add.ellipse(0, -2, 38 * n, 11).setStrokeStyle(1, a.team === "allies" ? ALLY : ENEMY, 0.9);
    const crowd: Phaser.GameObjects.Image[] = [];
    for (let i = 1; i < K.swarmSize(a); i++) {
      const c = this.add.image(i % 2 ? -18 : 18, -6, spriteKey(sprite, "idle")).setOrigin(0.5, 1).setTint(0xb8b8b8);
      c.setScale((56 * n) / c.width);
      crowd.push(c);
    }
    const body = this.add.image(0, 0, spriteKey(sprite, "idle")).setOrigin(0.5, 1);
    body.setScale((64 * n) / body.width);
    const top = -Math.min(body.displayHeight, 60 * n) - 6;
    const hpBack = this.add.rectangle(0, top, 36, 4, 0x000000, 0.7);
    const hpFill = this.add.rectangle(-18, top, 36, 4, a.team === "allies" ? 0x6be36b : 0xe35b5b).setOrigin(0, 0.5);
    const rankTag = this.add.text(0, 10, "", { fontFamily: "monospace", fontSize: "9px", color: "#a49c90" }).setOrigin(0.5, 0).setResolution(2);
    box.add([shadow, ring, ...crowd, body, hpBack, hpFill, rankTag]);
    const u: Unit = { id: a.id, sprite, team: a.team, box, body, crowd, hpFill, hpBack, rankTag, facing: a.team === "allies" ? 1 : -1, n };
    this.setPose(u, "idle");
    this.setHp(u, a.wounds, a.maxWounds, false);
    return u;
  }

  // ---------------------------------------------------------------- geometry

  private rankX(team: string, rank: number) {
    const d = FRONT + (rank - 1) * STEP;
    return team === "allies" ? MID - d : MID + d;
  }

  /** Moves every unit to its rank slot (animated when a rank changed). */
  private async layout(animate = true) {
    const jobs: Promise<void>[] = [];
    for (const team of ["allies", "enemies"] as const) {
      this.f[team].forEach((id, i) => {
        const u = this.units.get(id);
        if (!u) return;
        u.rankTag.setText(`${i + 1}열`);
        const x = this.rankX(team, i + 1);
        u.facing = team === "allies" ? 1 : -1;
        this.setPose(u, "idle");
        if (animate && Math.abs(u.box.x - x) > 1 && this.ms(1)) {
          this.setPose(u, "move");
          jobs.push(this.tween({ targets: u.box, x, duration: 260 }).then(() => this.setPose(u, "idle")));
        } else u.box.x = x;
        u.box.setDepth(10 + (4 - i));
      });
    }
    await Promise.all(jobs);
  }

  private face(u: Unit, towardX: number) {
    if (Math.abs(towardX - u.box.x) > 2) u.facing = towardX < u.box.x ? -1 : 1;
    u.body.setFlipX(u.facing < 0);
    u.crowd.forEach(c => c.setFlipX(u.facing < 0));
  }

  private setPose(u: Unit, pose: Pose) {
    u.body.setTexture(spriteKey(u.sprite, pose));
    u.body.setFlipX(u.facing < 0);
    u.crowd.forEach(c => { c.setTexture(spriteKey(u.sprite, pose)); c.setFlipX(u.facing < 0); });
  }

  private setHp(u: Unit, wounds: number, max: number, animate = true) {
    const ratio = Phaser.Math.Clamp(wounds / Math.max(1, max), 0, 1);
    if (animate && this.ms(350)) this.tweens.add({ targets: u.hpFill, scaleX: ratio, duration: this.ms(350) });
    else u.hpFill.scaleX = ratio;
  }

  // ---------------------------------------------------------------- turn loop

  private async pump(gen: number) {
    while (gen === this.generation && this.b.status === "running") {
      const cur = C.current(this.b);
      this.hud.order(this.b, this.view, cur?.id);
      if (!cur || K.cannotAct(cur)) { await this.resolve(() => K.skipTurn(this.b, cur)); continue; }
      if (playerControls(this.setup, this.b, cur)) {
        this.b.controlled = cur.id;
        this.choice = K.actionsFor(this.b, this.f, cur).find(x => K.usable(this.b, this.f, cur, x) && x.kind !== "defend" && x.kind !== "swap") ?? null;
        this.refreshControls();
        return; // resumes from a click / end turn
      }
      this.hud.idle(`${cur.name} 행동 중…`);
      await this.wait(120);
      const { act, target } = K.aiChoose(this.b, this.f, cur);
      let err: string | null = null;
      await this.resolve(() => { err = K.perform(this.b, this.f, cur, act, target); });
      if (err) await this.resolve(() => K.skipTurn(this.b, cur));
    }
    if (gen === this.generation) this.finish();
  }

  /** Runs one engine call, plays its scenes in order, then slides units to their new ranks. */
  private async resolve(run: () => unknown) {
    this.busy = true;
    this.marks.clear();
    this.view = F.presentationSnapshot(this.b);
    const since = this.b.logCounter;
    try { run(); } finally {
      const scenes = F.presentationScenes(F.visualEvents(this.b, since));
      for (const s of scenes) await this.play(s);
      for (const a of this.b.actors) { const u = this.units.get(a.id); if (u) this.setHp(u, a.wounds, a.maxWounds, false); }
      K.compact(this.b, this.f);
      await this.layout(true);
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

  private finish() {
    this.marks.clear();
    this.hud.order(this.b, this.view, undefined);
    this.hud.idle("전투 종료");
    this.hud.log(this.b.winner === "allies" ? "아군 승리" : this.b.winner === "enemies" ? "아군 패배" : "전투 종료", "round");
    this.hud.result(this.b, this.view, this.stats);
  }

  // ---------------------------------------------------------------- player input

  private choose(c: K.RankAction) {
    this.choice = c;
    this.error = "";
    const a = C.current(this.b);
    if (c.kind === "defend") { this.act(a, c); return; }
    this.refreshControls();
  }

  private refreshControls() {
    const a = C.current(this.b);
    if (!a || !playerControls(this.setup, this.b, a)) return;
    const acts = K.actionsFor(this.b, this.f, a);
    this.hud.controls(a, K.rankOf(this.f, a.id), acts.map(x => ({ ...x, ok: K.usable(this.b, this.f, a, x) })), this.choice, this.error);
    this.drawMarks(a);
  }

  /** Red brackets on hittable enemies, blue on allies a swap can reach. */
  private drawMarks(a: any) {
    const g = this.marks.clear();
    const box = (id: string, color: number) => {
      const u = this.units.get(id)!;
      g.lineStyle(2, color, 0.95).strokeRect(u.box.x - 22, GROUND - 70, 44, 76);
    };
    g.lineStyle(2, 0xd5b878, 0.9).strokeEllipse(this.units.get(a.id)!.box.x, GROUND - 2, 46, 14);
    if (!this.choice) return;
    if (this.choice.kind === "swap") {
      const side = this.f[a.team as K.Side], i = side.indexOf(a.id);
      [side[i - 1], side[i + 1]].filter(Boolean).forEach(id => box(id, 0x5aa0ff));
    } else for (const id of K.legalTargets(this.b, this.f, a, this.choice)) box(id, 0xff4444);
  }

  private onClick(p: Phaser.Input.Pointer) {
    const a = C.current(this.b);
    if (this.busy || !a || !this.choice || this.b.status !== "running" || !playerControls(this.setup, this.b, a)) return;
    let hit: Unit | null = null;
    for (const u of this.units.values()) if (Math.abs(p.worldX - u.box.x) < 26 && p.worldY > GROUND - 75 && p.worldY < GROUND + 12) hit = u;
    if (hit) this.act(a, this.choice, hit.id);
  }

  private async act(a: any, act: K.RankAction, target?: string) {
    const gen = this.generation;
    let err: string | null = null;
    await this.resolve(() => { err = K.perform(this.b, this.f, a, act, target); });
    if (gen !== this.generation) return;
    this.error = err ?? "";
    if (err && C.current(this.b)?.id === a.id) this.refreshControls();
    else this.pump(gen);
  }

  private async endTurn() {
    const a = C.current(this.b);
    if (this.busy || !a || this.b.status !== "running") return;
    await this.resolve(() => K.skipTurn(this.b, a));
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

    if (type === "move") return; // rank changes are animated by moveRanks()
    if (target) this.face(u, target.box.x);

    const shooter = this.b.actors.find((x: any) => x.id === scene.actor);
    if (type === "attack" && !(scene.action === "attack" && C.weaponOf(shooter)?.ranged)) {
      // Melee: dash most of the way to the target, strike, step back to the rank.
      this.setPose(u, "move");
      const x0 = u.box.x;
      const gap = target ? target.box.x - u.box.x : u.facing * 60;
      const reach = Math.sign(gap) * Math.max(8, Math.abs(gap) - 44);
      await this.tween({ targets: u.box, x: x0 + reach, duration: 160, ease: "Quad.easeOut" });
      this.setPose(u, "melee");
      if (target) this.slash(this.center(target), scene.action === "riposte" ? 0xfff2a0 : 0xffffff);
      await this.wait(120);
      this.setPose(u, "move");
      await this.tween({ targets: u.box, x: x0, duration: 180 });
    } else if (type === "ranged" || type === "attack") {
      this.setPose(u, "ranged");
      await this.wait(150);
      if (target) await this.projectile(this.center(u), this.center(target), 0xe8e0c8, 4);
    } else if (["cast", "channel", "technique", "breath"].includes(type)) {
      const theme = F.effectTheme(scene);
      const color = theme?.color ? Phaser.Display.Color.HexStringToColor(theme.color).color : 0xc9b8ff;
      this.setPose(u, hasPose(u.sprite, "cast") || type !== "technique" ? "cast" : "melee");
      await this.glow(this.center(u), color);
      if (target) await this.projectile(this.center(u), this.center(target), color, 6, true);
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


/** Placeholder battlefield: sky, distant hills and a dirt strip the ranks stand on. */
function drawBackdrop(scene: Phaser.Scene) {
  const g = scene.add.graphics().setDepth(0);
  g.fillGradientStyle(0x1d2533, 0x1d2533, 0x3a4250, 0x3a4250, 1).fillRect(0, 0, W, GROUND - 40);
  g.fillStyle(0x2c3a2c).fillTriangle(0, GROUND - 40, 160, GROUND - 120, 340, GROUND - 40);
  g.fillStyle(0x263326).fillTriangle(260, GROUND - 40, 470, GROUND - 140, 640, GROUND - 40);
  g.fillStyle(0x3d5a36).fillRect(0, GROUND - 40, W, 40);
  g.fillStyle(0x5b4630).fillRect(0, GROUND - 6, W, H - GROUND + 6);
  const r = new Phaser.Math.RandomDataGenerator(["field"]);
  for (let i = 0; i < 260; i++) {
    g.fillStyle(r.pick([0x4c3a28, 0x6a5238, 0x34492f])).fillRect(r.between(0, W), r.between(GROUND - 38, H), r.between(1, 3), 1);
  }
  g.lineStyle(1, 0x000000, 0.25).lineBetween(MID, GROUND - 50, MID, GROUND + 20);
}
