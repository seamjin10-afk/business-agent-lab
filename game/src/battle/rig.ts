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
  footX: number, footY: number, height: number, flip: boolean, weapon: WeaponLook | null = null) {
  const rig = rigs.get(id);
  if (!rig) return;
  const map = poseAt(rig, pose, t), v = rig.viewBounds, scale = height / (v[3] - v[1]);
  ctx.save();
  ctx.translate(footX, footY);
  if (flip) ctx.scale(-1, 1);
  ctx.scale(scale, -scale);
  ctx.translate(-(v[0] + v[2]) / 2, -v[1]);
  for (const s of rig.slots) {
    let a = rig.skins.default[s.name]?.[s.attachment];
    let r = a && rig.regions[a.path || s.attachment], im = r && rig.pages[r.page];
    const b = map[s.bone];
    if (s.name === "r_sword" && weapon) ({ a, r, im } = borrowWeapon(weapon) ?? { a, r, im });
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

// ------------------------------------------------------------------ weapon parts
// Every rig hangs its weapon on an "r_sword" bone under the right hand, drawn along the
// bone. The seven weapon pictures in the rig set are borrowed across rigs so the drawing
// matches what the character actually carries.

export interface WeaponLook { rig: string; length: number }
const WEAPONS: Record<string, WeaponLook> = {
  sword: { rig: "human", length: 220 },
  sabre: { rig: "human-cavalry-on-foot", length: 220 },
  greatsword: { rig: "human", length: 300 },
  staff: { rig: "high-elf", length: 200 },
  spear: { rig: "wood-elf", length: 250 },
  lance: { rig: "high-elf-cavalry-on-foot", length: 240 },
  pick: { rig: "dwarf", length: 210 },
  dagger: { rig: "halfling", length: 80 },
};
const NATIVE: Record<string, string> = {
  "human": "sword", "human-cavalry-on-foot": "sabre", "high-elf": "staff", "high-elf-cavalry-on-foot": "lance",
  "wood-elf": "spear", "wood-elf-cavalry-on-foot": "spear", "dwarf": "pick", "halfling": "dagger", "dragon-prince-on-foot": "lance",
};

function borrowWeapon(w: WeaponLook) {
  const src = rigs.get(w.rig), sa: any = src && Object.values(src.skins.default.r_sword || {})[0];
  const r = src?.regions.r_sword, im = r && src!.pages[r.page];
  if (!sa || !r || !im) return null;
  const k = w.length / sa.height; // keep the picture's proportions and grip point
  return { a: { ...sa, x: (sa.x || 0) * k, y: sa.y * k, width: sa.width * k, height: w.length }, r, im };
}

/** Weapon kind of an engine weapon, from its group, reach and name. */
function weaponKind(w: any): string | null {
  const n = `${w.name} ${w.english ?? ""}`;
  if (/지팡이|staff/i.test(n)) return "staff";
  if (/단검|dagger|knife|칼날/i.test(n) || w.reach === "Very Short") return "dagger";
  if (w.group === "Two-Handed" && /검|sword|hoeth/i.test(n)) return "greatsword";
  if (w.group === "Polearm" || w.group === "Cavalry" || /창|spear|lance|halberd|미늘/i.test(n)) return "spear";
  if (/도끼|axe|망치|hammer|mace|곡괭이|pick/i.test(n) || w.group === "Two-Handed") return "pick";
  if (w.group === "Fencing" || /세이버|sabre|rapier|레이피어/i.test(n)) return "sabre";
  return w.group === "Basic" ? "hand" : null;
}

/**
 * Weapon picture for a rigged actor: the best melee weapon it carries. A generic hand
 * weapon keeps the rig's own sword/pick; casters with only a knife keep their staff.
 */
export function weaponLook(actor: any, rigId: string): WeaponLook | null {
  const native = NATIVE[rigId];
  if (!native) return null; // mounted rigs keep their lance
  const melee = (actor.weapons || []).filter((w: any) => !w.ranged && !w.freeOnly && w.group !== "Brawling")
    .sort((x: any, y: any) => (y.damage ?? 0) - (x.damage ?? 0) || (weaponKind(x) === "dagger" ? 1 : -1));
  let kind = melee.length ? weaponKind(melee[0]) : null;
  if (!kind || (kind === "dagger" && (actor.spells?.length || native === "staff"))) return null;
  if (kind === "hand") kind = ["sword", "sabre", "pick"].includes(native) ? native : "sword";
  return kind === native ? null : WEAPONS[kind];
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
  // Warrior-class careers wear the armoured body where the set has one (otherwise every
  // member of a species looked alike, e.g. a swordmaster drawn as a robed mage).
  if (actor.careerClass === "Warrior" && ["human", "high-elf", "wood-elf"].includes(base)) return base + "-cavalry-on-foot";
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
