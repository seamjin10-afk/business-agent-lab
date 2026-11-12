import Phaser from "phaser";
import { C, F } from "../rules/engine.js";
import { BattleSetup, DEFAULT_SETUP, Roster, createDemoBattle, playerControls } from "./setup";
import { Pose, buildGenericTextures, hasPose, preloadSprites, spriteKey } from "./sprites";
import { Hud, Speed } from "./hud";
import * as K from "./ranks";
import { RigPose, WeaponLook, drawRig, hasRig, resolveRig, rigDuration, rigsReady, weaponLook } from "./rig";
import demoParty from "../data/demo-party.json";

const W = 640, H = 424;
const GROUND = 300;            // feet line
const MID = W / 2;
const FRONT = 44, STEP = 76;   // px from centre to rank 1, and between ranks
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
  rig?: { id: string; tex: Phaser.Textures.CanvasTexture; pose: RigPose; start: number; weapon: WeaponLook | null };
}

// Rig canvas per unit, in world px (drawn at 2x for the zoomed camera).
const RIG_W = 210, RIG_H = 170, RIG_FOOT = 8, RIG_HEIGHT = 108;
const POSE_TO_RIG: Record<Pose, RigPose> = { idle: "combat", move: "walk", melee: "attack", ranged: "attack", cast: "skill", hit: "hurt", death: "down" };
const LOOPING: RigPose[] = ["combat", "walk", "afflicted", "victory", "camp"];
const HIT_AT = 0.45; // share of an attack/skill animation before the blow lands

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
  private slow = 1;                                  // >1 during a close-up
  private dim?: Phaser.GameObjects.Rectangle;        // close-up backdrop shade

  constructor() { super("battle"); }

  private get b() { return this.roster.battle; }

  preload() { preloadSprites(this); }

  /** Redraws every rigged unit's canvas for its current pose and time. */
  update() {
    const now = this.time.now;
    for (const u of this.units.values()) {
      if (!u.rig) continue;
      const { id, tex, pose, start, weapon } = u.rig, D = rigDuration(id, pose);
      const elapsed = (now - start) / 1000 * (this.speed === "fast" ? 2 : 1) / this.slow;
      const t = LOOPING.includes(pose) ? elapsed % D : Math.min(D, this.speed === "instant" ? D : elapsed);
      const ctx = tex.getContext();
      ctx.clearRect(0, 0, tex.width, tex.height);
      drawRig(ctx, id, pose, t, tex.width / 2, tex.height - RIG_FOOT * 2, RIG_HEIGHT * 2 * u.n, u.facing < 0, weapon);
      tex.refresh();
    }
  }

  create() {
    this.cameras.main.setZoom(2).centerOn(W / 2, H / 2); // 640×424 world on a 1280×848 canvas
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
    if (location.search.includes("debug")) (window as any).__battle = () => ({ b: this.b, f: this.f, busy: this.busy, zoom: this.cameras.main.zoom, pos: (id: string) => { const u = this.units.get(id)!; return { x: u.box.x, y: u.box.y - 24 }; } });
    rigsReady.then(() => this.start(this.hud.current));
  }

  // ---------------------------------------------------------------- setup

  private start(setup: BattleSetup) {
    this.generation++;
    this.setup = setup;
    this.roster = createDemoBattle(setup);
    this.f = K.makeFormation(this.b);
    this.units.forEach(u => { u.box.destroy(); if (u.rig) this.textures.remove(u.rig.tex); });
    this.units.clear();
    this.tweens.killAll();
    this.fxObjects.forEach(o => o.destroy());
    this.slow = 1;
    this.dim?.setFillStyle(0x000000, 0);
    this.cameras.main.setZoom(2).centerOn(W / 2, H / 2);
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
    const n = C.footprint(a) > 1 && !C.trait(a, "Swarm") ? 1.5 : 1;
    const box = this.add.container(0, GROUND);
    const shadow = this.add.ellipse(0, -2, 34 * n, 9, 0x000000, 0.35);
    const ring = this.add.ellipse(0, -2, 38 * n, 11).setStrokeStyle(1, a.team === "allies" ? ALLY : ENEMY, 0.9);
    const crowd: Phaser.GameObjects.Image[] = [];
    for (let i = 1; i < K.swarmSize(a); i++) {
      const c = this.add.image(i % 2 ? -18 : 18, -6, spriteKey(sprite, "idle")).setOrigin(0.5, 1).setTint(0xb8b8b8);
      c.setScale((56 * n) / c.width);
      crowd.push(c);
    }
    const rigId = resolveRig(a);
    let rig: Unit["rig"];
    let body: Phaser.GameObjects.Image;
    if (hasRig(rigId)) {
      const key = `rig-${a.id}-${this.generation}`;
      const tex = this.textures.createCanvas(key, RIG_W * 2 * n, RIG_H * 2 * n)!;
      rig = { id: rigId!, tex, pose: "combat", start: this.time.now, weapon: weaponLook(a, rigId!) };
      body = this.add.image(0, 0, key).setOrigin(0.5, 1 - (RIG_FOOT * 2) / tex.height).setScale(0.5);
    } else {
      body = this.add.image(0, 0, spriteKey(sprite, "idle")).setOrigin(0.5, 1);
      body.setScale((64 * n) / body.width);
    }
    const top = rig ? -RIG_HEIGHT * 0.8 * n : -Math.min(body.displayHeight, 60 * n) - 6;
    const hpBack = this.add.rectangle(0, top, 36, 4, 0x000000, 0.7);
    const hpFill = this.add.rectangle(-18, top, 36, 4, a.team === "allies" ? 0x6be36b : 0xe35b5b).setOrigin(0, 0.5);
    const rankTag = this.add.text(0, 10, "", { fontFamily: "monospace", fontSize: "9px", color: "#a49c90" }).setOrigin(0.5, 0).setResolution(2);
    box.add([shadow, ring, ...crowd, body, hpBack, hpFill, rankTag]);
    const u: Unit = { id: a.id, sprite, team: a.team, box, body, crowd, hpFill, hpBack, rankTag, facing: a.team === "allies" ? 1 : -1, n, rig };
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
        const rs = K.ranksOf(this.f, id);
        u.rankTag.setText(rs.length > 1 ? `${rs[0]}·${rs[1]}열` : `${rs[0]}열`);
        const x = (this.rankX(team, rs[0]) + this.rankX(team, rs[rs.length - 1])) / 2;
        u.facing = team === "allies" ? 1 : -1;
        this.setPose(u, "idle");
        if (animate && Math.abs(u.box.x - x) > 1 && this.ms(1)) {
          // Walk facing the way they move, then turn back to the enemy.
          const front = u.facing;
          this.face(u, x);
          this.setPose(u, "move");
          jobs.push(this.tween({ targets: u.box, x, duration: 320 }).then(() => { u.facing = front; this.setPose(u, "idle"); }));
        } else u.box.x = x;
        u.box.setDepth(10 + (4 - i));
      });
    }
    await Promise.all(jobs);
  }

  private face(u: Unit, towardX: number) {
    if (Math.abs(towardX - u.box.x) > 2) u.facing = towardX < u.box.x ? -1 : 1;
    if (!u.rig) u.body.setFlipX(u.facing < 0); // rigs are mirrored when drawn
    u.crowd.forEach(c => c.setFlipX(u.facing < 0));
  }

  private setPose(u: Unit, pose: Pose) {
    if (u.rig) {
      // Resting pose reflects the actor's state: fallen, panicking, or ready.
      const a = this.b.actors.find((x: any) => x.id === u.id);
      let rp = POSE_TO_RIG[pose];
      if (pose === "idle" && a) rp = !C.conscious(a) ? "down" : a.conditions?.Broken ? "afflicted" : "combat";
      if (u.rig.pose !== rp || !LOOPING.includes(rp)) u.rig.start = this.time.now;
      u.rig.pose = rp;
      return;
    }
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
      if (this.b.pending) {
        const kind = this.b.pending.kind, note = K.settlePending(this.b);
        this.hud.log(kind.startsWith("archive-") ? `규칙 판정: ${note}` : `GM 판정 필요: ${note} (게임에서는 효과 없이 기록만 하고 진행)`, "round");
        if (this.b.status !== "running") break;
      }
      const cur = C.current(this.b);
      this.hud.order(this.b, this.view, cur?.id);
      if (!cur || K.cannotAct(cur)) {
        const why = cur && C.conscious(cur) ? K.stuckReason(cur) : "";
        if (why) this.hud.log(`${cur.name} · ${why}로 행동하지 못함`, cur.team);
        await this.resolve(() => K.skipTurn(this.b, cur));
        continue;
      }
      if (playerControls(this.setup, this.b, cur)) {
        this.b.controlled = cur.id;
        this.choice = K.actionsFor(this.b, this.f, cur).find(x => K.usable(this.b, this.f, cur, x) && x.kind !== "defend" && x.kind !== "swap") ?? null;
        this.refreshControls();
        return; // resumes from a click / end turn
      }
      this.hud.idle(`${cur.name} 행동 중…`);
      await this.wait(120);
      // If the engine refuses a special move (momentum, engagement…), fall back to a plain one.
      let err: string | null = null;
      for (const noSkills of [false, true]) {
        const live = this.b.actors.find((x: any) => x.id === cur.id);
        const { act, target } = K.aiChoose(this.b, this.f, live, { noSkills });
        await this.resolve(() => { err = K.perform(this.b, this.f, live, act, target); });
        if (!err) break;
      }
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
    const standing = new Set(this.b.actors.filter((x: any) => C.conscious(x)).map((x: any) => x.id));
    try { run(); } finally {
      const scenes = F.presentationScenes(F.visualEvents(this.b, since));
      // Decisive moment: someone who was standing goes down in this action → close-up.
      const felled = this.b.actors.find((x: any) => standing.has(x.id) && !C.conscious(x));
      const blow = felled && scenes.find((s: any) => s.phase === "effect" && s.actor !== felled.id);
      if (blow && this.speed !== "instant") await this.closeUp(blow.actor, felled.id, true);
      for (const s of scenes) await this.play(s);
      if (blow && this.speed !== "instant") await this.closeUp(blow.actor, felled.id, false);
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
    for (const u of this.units.values()) {
      const a = this.b.actors.find((x: any) => x.id === u.id);
      if (u.rig && a && C.conscious(a) && a.team === this.b.winner) { u.rig.pose = "victory"; u.rig.start = this.time.now; }
    }
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
      g.lineStyle(2, color, 0.95).strokeRect(u.box.x - 22 * u.n, GROUND - 70 * u.n, 44 * u.n, 76 * u.n);
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
    for (const u of this.units.values()) if (Math.abs(p.worldX - u.box.x) < 26 * u.n && p.worldY > GROUND - 75 * u.n && p.worldY < GROUND + 12) hit = u;
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

  /**
   * Darkest Dungeon style close-up for a decisive blow: dim the field, zoom between the
   * attacker and the victim and slow the action a little; `on=false` restores the view.
   */
  private async closeUp(attackerId: string, victimId: string, on: boolean) {
    const cam = this.cameras.main, a = this.units.get(attackerId), v = this.units.get(victimId);
    if (on && a && v) {
      this.dim ??= this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0).setDepth(9.5);
      this.tweens.add({ targets: this.dim, fillAlpha: 0.55, duration: 260 });
      a.box.setDepth(110); v.box.setDepth(105);
      this.slow = 1.6;
      cam.pan((a.box.x + v.box.x) / 2, GROUND - 52, 300, "Sine.easeInOut");
      cam.zoomTo(2.9, 300, "Sine.easeInOut");
      await new Promise<void>(r => this.time.delayedCall(320, r));
    } else if (!on) {
      await new Promise<void>(r => this.time.delayedCall(350, r)); // let the fall land
      this.slow = 1;
      if (this.dim) this.tweens.add({ targets: this.dim, fillAlpha: 0, duration: 260 });
      cam.pan(W / 2, H / 2, 300, "Sine.easeInOut");
      cam.zoomTo(2, 300, "Sine.easeInOut");
      await new Promise<void>(r => this.time.delayedCall(320, r));
    }
  }

  /** Length of a pose's animation in ms at the current speed (sprites: a short beat). */
  private animMs(u: Unit, pose: Pose) {
    return u.rig ? rigDuration(u.rig.id, POSE_TO_RIG[pose]) * 1000 : 300; // wait()/tween() apply speed
  }

  private ms(n: number) { return this.speed === "instant" ? 0 : (this.speed === "fast" ? n / 2 : n) * this.slow; }

  private frame() { return new Promise<void>(r => this.time.delayedCall(16, r)); }

  private wait(n: number) { return n > 0 ? new Promise<void>(r => this.time.delayedCall(this.ms(n), r)) : Promise.resolve(); }

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
      // Melee (Darkest Dungeon style): lunge in while the attack animation plays, land the
      // hit at the swing, let the animation finish, then slide back in the ready pose.
      const x0 = u.box.x;
      const gap = target ? target.box.x - u.box.x : u.facing * 60;
      const reach = Math.sign(gap) * Math.max(8, Math.abs(gap) - 48);
      const D = this.animMs(u, "melee");
      u.box.setDepth(100); // the attacker steps in front of its own line
      this.setPose(u, "melee");
      await this.tween({ targets: u.box, x: x0 + reach, duration: Math.min(220, D * 0.3), ease: "Quad.easeOut" });
      await this.wait(D * HIT_AT - Math.min(220, D * 0.3));
      if (target) this.slash(this.center(target), scene.action === "riposte" ? 0xfff2a0 : 0xffffff);
      await this.wait(D * (1 - HIT_AT));
      this.setPose(u, "idle");
      await this.tween({ targets: u.box, x: x0, duration: 200, ease: "Quad.easeInOut" });
    } else if (type === "ranged" || type === "attack") {
      const D = this.animMs(u, "ranged");
      this.setPose(u, "ranged");
      await this.wait(D * HIT_AT);
      if (target) await this.projectile(this.center(u), this.center(target), 0xe8e0c8, 4);
      await this.wait(D * (1 - HIT_AT) - 200);
    } else if (["cast", "channel", "technique", "breath"].includes(type)) {
      const theme = F.effectTheme(scene);
      const color = theme?.color ? Phaser.Display.Color.HexStringToColor(theme.color).color : 0xc9b8ff;
      const pose: Pose = u.rig || hasPose(u.sprite, "cast") || type !== "technique" ? "cast" : "melee";
      const D = this.animMs(u, pose);
      this.setPose(u, pose);
      await this.glow(this.center(u), color);
      await this.wait(D * HIT_AT - 520);
      if (target) await this.projectile(this.center(u), this.center(target), color, 6, true);
      await this.wait(D * (1 - HIT_AT) - 300);
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
      if (u.rig) await this.wait(this.animMs(u, "hit") * 0.6 - 160); // let the flinch read
      if (!v.dead) this.setPose(u, "idle");
    });
    await Promise.all(jobs);
    await this.wait(150);
  }

  private async death(scene: any) {
    const u = this.units.get(scene.actor);
    if (!u) return;
    if (u.rig || hasPose(u.sprite, "death")) this.setPose(u, "death");
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
