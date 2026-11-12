// Spine 2.1 rigs from ../../../rigging (warhammer v55 rigging source), drawn on a canvas.
// Ported from rigging/runtime.js: same pose sampling, draw order, rig choice (resolve)
// and scene → pose mapping (poseFor). The game reads the editable JSON instead of the
// binary .skel; both hold the same bones, slots, skins and baked animations.

export type RigPose = "combat" | "attack" | "skill" | "hurt" | "down" | "walk" | "camp"
  | "victory" | "heroic" | "afflicted" | "defend" | "investigate";

interface Rig {
  id: string;
  name: string;
  bones: any[];
  slots: any[];
  skins: { default: Record<string, Record<string, any>> };
  animations: Record<string, { bones: Record<string, any> }>;
  durations: Record<string, number>;
  viewBounds: [number, number, number, number];
  regions: Record<string, { x: number; y: number; width: number; height: number; page: string }>;
  pages: Record<string, HTMLImageElement>;
}

const jsons = import.meta.glob("../../../rigging/*/*.json", { eager: true, import: "default" }) as Record<string, any>;
const pngs = import.meta.glob("../../../rigging/*/*.png", { eager: true, query: "?url", import: "default" }) as Record<string, string>;

const rigs = new Map<string, Rig>();
const loads: Promise<void>[] = [];
for (const [path, data] of Object.entries(jsons)) {
  const folder = path.split("/").at(-2)!;
  if (!data?.bones || data.id !== folder) continue; // skips verification/*.json
  const pages: Record<string, HTMLImageElement> = {};
  for (const [p, url] of Object.entries(pngs)) {
    if (p.split("/").at(-2) !== folder) continue;
    const im = new Image();
    loads.push(new Promise(r => { im.onload = () => r(); im.onerror = () => r(); }));
    im.src = url;
    pages[p.split("/").at(-1)!] = im;
  }
  rigs.set(folder, { ...data, pages });
}
export const rigsReady = Promise.all(loads);
export const hasRig = (id: string | null) => !!id && rigs.has(id);
export const rigDuration = (id: string, pose: RigPose) => rigs.get(id)?.durations[pose] ?? 1.2;

function sample(frames: any[], t: number, key: string) {
  if (t <= frames[0].time) return frames[0][key] || 0;
  for (let i = 1; i < frames.length; i++) {
    const a = frames[i - 1], b = frames[i];
    if (t <= b.time) { const f = (t - a.time) / (b.time - a.time); return (a[key] || 0) * (1 - f) + (b[key] || 0) * f; }
  }
  return frames.at(-1)[key] || 0;
}

function poseAt(rig: Rig, pose: RigPose, t: number) {
  const tracks = (rig.animations[pose] || rig.animations.combat).bones, map: Record<string, any> = {};
  for (const b of rig.bones) {
    const tr = tracks[b.name] || {};
    const angle = (b.rotation || 0) + (tr.rotate ? sample(tr.rotate, t, "angle") : 0), rad = angle * Math.PI / 180;
    const sx = b.scaleX ?? 1, sy = b.scaleY ?? 1;
    const x = (b.x || 0) + (tr.translate ? sample(tr.translate, t, "x") : 0), y = (b.y || 0) + (tr.translate ? sample(tr.translate, t, "y") : 0);
    const a = Math.cos(rad) * sx, c = Math.sin(rad) * sx, bb = -Math.sin(rad) * sy, d = Math.cos(rad) * sy;
    if (b.parent) {
      const p = map[b.parent];
      map[b.name] = { a: p.a * a + p.b * c, b: p.a * bb + p.b * d, c: p.c * a + p.d * c, d: p.c * bb + p.d * d, x: p.a * x + p.b * y + p.x, y: p.c * x + p.d * y + p.y };
    } else map[b.name] = { a, b: bb, c, d, x, y };
  }
  return map;
}

/**
 * Draws a rig with its feet at (footX, footY) of the canvas, `height` px tall for the
 * rig's whole view box (so a horse is taller than a dwarf at the same scale per rig).
 */
export function drawRig(ctx: CanvasRenderingContext2D, id: string, pose: RigPose, t: number,
  footX: number, footY: number, height: number, flip: boolean) {
  const rig = rigs.get(id);
  if (!rig) return;
  const map = poseAt(rig, pose, t), v = rig.viewBounds, scale = height / (v[3] - v[1]);
  ctx.save();
  ctx.translate(footX, footY);
  if (flip) ctx.scale(-1, 1);
  ctx.scale(scale, -scale);
  ctx.translate(-(v[0] + v[2]) / 2, -v[1]);
  for (const s of rig.slots) {
    const a = rig.skins.default[s.name]?.[s.attachment];
    const r = a && rig.regions[a.path || s.attachment], im = r && rig.pages[r.page], b = map[s.bone];
    if (!r || !im?.complete || !im.naturalWidth) continue;
    ctx.save();
    ctx.transform(b.a, b.c, b.b, b.d, b.x, b.y);
    ctx.translate(a.x || 0, a.y || 0);
    ctx.rotate((a.rotation || 0) * Math.PI / 180);
    ctx.scale(1, -1);
    ctx.drawImage(im, r.x, r.y, r.width, r.height, -a.width / 2, -a.height / 2, a.width, a.height);
    ctx.restore();
  }
  ctx.restore();
}

/** Which rig a party member uses (rigging/runtime.js resolve). Monsters have none yet. */
export function resolveRig(actor: any, mount: any = null): string | null {
  if (!actor || actor.npc !== false) return null;
  const base = ({ "Human": "human", "High Elf": "high-elf", "Wood Elf": "wood-elf", "Halfling": "halfling", "Dwarf": "dwarf" } as Record<string, string>)[actor.species];
  if (!base) return null;
  const c = String(actor.careerId || actor.career || "");
  const cavalry = ["54", "70", "elf-silver-helm"].includes(c) && ["human", "high-elf", "wood-elf"].includes(base);
  if (c === "elf-dragon-prince") {
    if (actor.mountId && mount?.mountKind === "Dragon") return "dragon-prince-dragon";
    if (actor.mountId && mount?.mountKind === "Horse") return "dragon-prince-horse";
    return "dragon-prince-on-foot";
  }
  if (cavalry) return actor.mountId && mount?.mountKind === "Horse" ? base + "-cavalry" : base + "-cavalry-on-foot";
  return base;
}

/** Pose for an actor given the scene being played (rigging/runtime.js poseFor). */
export function poseFor(actor: any, scene: any, active: boolean, battle: any): RigPose {
  if (actor.dead || actor.banished || actor.wounds <= 0 || actor.conditions?.Unconscious || actor.conditions?.Prone) return "down";
  if (active && scene) {
    const hurt = ["impact", "terminal"].includes(scene.phase)
      && ((scene.losses || []).some((x: any) => x.actor === actor.id && x.amount > 0) || (scene.target === actor.id && scene.damage > 0));
    if (hurt) return "hurt";
    if (scene.actor === actor.id) {
      const a = scene.action;
      if (a === "death") return "down";
      if (["move", "fly", "flee", "disengage"].includes(a)) return "walk";
      if (["attack", "charge", "riposte", "fast-shot", "bite", "tail", "feint", "furious", "grapple", "disarm", "beat", "breath"].includes(a)) return "attack";
      if (a === "defend") return "defend";
      if (a === "rally") return "heroic";
      return "skill";
    }
  }
  if (battle && ["finished", "draw"].includes(battle.status) && battle.winner === actor.team) return "victory";
  if (actor.conditions?.Broken) return "afflicted";
  return "combat";
}
