// Darkest Dungeon style rank combat on top of the ported WFRP engine.
//
// Each side stands in 4 ranks (1 = front). One actor per rank; an actor with the
// Swarm trait is one engine participant drawn as a crowd. Rank rules decide WHO may
// act on WHOM; the engine still rolls the dice, applies damage, criticals and
// conditions. Right before an engine call the two participants are placed on the
// engine grid at a distance that satisfies its reach / range checks ("projection"),
// everyone else is parked out of the way, and the formation is restored afterwards.
import { C, D, E } from "../rules/engine.js";

export const RANKS = 4;
export type Side = "allies" | "enemies";

export type ActionKind = "attack" | "cast" | "channel" | "skill" | "defend" | "swap" | "shove" | "pull";

export interface RankAction {
  kind: ActionKind;
  label: string;
  weaponId?: string;
  spellId?: string;
  /** engine action for an active skill (technique, disarm, breath, …) */
  action?: string;
  techniqueId?: string;
  /** ranks the user may stand in */
  from: number[];
  /** enemy ranks it can reach (empty for self/ally actions) */
  to: number[];
}

/** The formation: actor ids per side, front first. Large and bigger monsters are 2 ranks wide. */
export interface Formation { allies: string[]; enemies: string[]; width: Record<string, number> }

const ALL = [1, 2, 3, 4];
const MELEE_TARGETS = [1, 2];

/** Which ranks a weapon may be used from (user rules, 2026-11). */
export function weaponRanks(w: any): { from: number[]; to: number[]; label: string } {
  if (!w.ranged) {
    const short = ["Personal", "Very Short", "Short"].includes(w.reach);
    return short
      ? { from: [1], to: MELEE_TARGETS, label: "근접(짧음)" }
      : { from: [1, 2], to: MELEE_TARGETS, label: w.group === "Polearm" ? "근접(창)" : "근접" };
  }
  // Pistols and thrown weapons are short ranged; bows, crossbows, guns, slings long ranged.
  const pistol = /pistol|권총/i.test(String(w.name) + " " + String(w.english ?? "")) || w.group === "Throwing";
  return pistol
    ? { from: [1, 2, 3], to: ALL, label: "단거리 사격" }
    : { from: [2, 3, 4], to: ALL, label: "사격" };
}

export function makeFormation(b: any): Formation {
  const width: Record<string, number> = {};
  // A Swarm is one rank however big the crowd; other Large+ creatures take two.
  for (const a of b.actors) width[a.id] = C.footprint(a) > 1 && !C.trait(a, "Swarm") ? 2 : 1;
  const side = (team: Side) => {
    const ids: string[] = [];
    let used = 0;
    for (const a of b.actors.filter((x: any) => x.team === team)) {
      if (used + width[a.id] > RANKS) continue;
      ids.push(a.id);
      used += width[a.id];
    }
    return ids;
  };
  return { allies: side("allies"), enemies: side("enemies"), width };
}

export function sideOf(f: Formation, id: string): Side { return f.allies.includes(id) ? "allies" : "enemies"; }
/** First (front-most) rank the unit stands in. */
export function rankOf(f: Formation, id: string): number {
  const side = f[sideOf(f, id)];
  let r = 1;
  for (const x of side) { if (x === id) return r; r += f.width[x] ?? 1; }
  return 0;
}
/** Every rank the unit covers (two for a large monster). */
export function ranksOf(f: Formation, id: string): number[] {
  const r = rankOf(f, id);
  return Array.from({ length: f.width[id] ?? 1 }, (_, i) => r + i);
}
const overlaps = (a: number[], b: number[]) => a.some(x => b.includes(x));
const actor = (b: any, id: string) => b.actors.find((a: any) => a.id === id);

/** Conscious actors move forward over the fallen; fallen ones go to the back, in order. */
export function compact(b: any, f: Formation) {
  for (const s of ["allies", "enemies"] as Side[]) {
    const up = f[s].filter(id => C.conscious(actor(b, id)));
    const down = f[s].filter(id => !C.conscious(actor(b, id)));
    f[s] = [...up, ...down];
  }
}

/** Living enemies of `a` standing in the given ranks. */
function targetsIn(b: any, f: Formation, a: any, ranks: number[]) {
  const foes = f[a.team === "allies" ? "enemies" : "allies"];
  return foes.filter(id => overlaps(ranksOf(f, id), ranks) && C.active(actor(b, id)));
}

export function actionsFor(b: any, f: Formation, a: any): RankAction[] {
  const out: RankAction[] = [];
  const seen = new Set<string>();
  const armed = a.weapons.some((w: any) => !/맨손|unarmed/i.test(w.name));
  for (const w of a.weapons) {
    if (w.freeOnly || w.dropped || w.broken) continue;
    if (armed && /맨손|unarmed/i.test(w.name)) continue; // bare hands only when there is nothing else
    const r = weaponRanks(w);
    const key = r.label + w.name;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ kind: "attack", label: `${w.name} · ${r.label}`, weaponId: w.id, from: r.from, to: r.to });
  }
  for (const sp of a.spells || []) {
    if (!/\d|yard|Willpower|Touch/i.test(sp.range || "") || /^You$/i.test(sp.range || "")) continue; // skip self/utility
    const touch = /touch/i.test(sp.range);
    // Casting is not limited by rank: being hit in the front line only matters if it breaks
    // concentration, which the engine resolves. Touch spells still need the foe in reach.
    out.push({ kind: "cast", label: `주문 · ${sp.name}`, spellId: sp.id, from: touch ? [1, 2] : ALL, to: touch ? MELEE_TARGETS : ALL });
    if (canChannel(a) && Number(sp.cn) > 0) out.push({ kind: "channel", label: `집중 · ${sp.name}`, spellId: sp.id, from: ALL, to: [] });
  }
  out.push(...activeSkills(a));
  // Shove / pull wait for the rulebook text (kept in perform() but not offered).
  out.push({ kind: "swap", label: "자리 바꾸기", from: ALL, to: [] });
  out.push({ kind: "defend", label: "방어 태세", from: ALL, to: [] });
  return out;
}

/** Enemy ids this action can hit right now (rank of the user and of the targets checked). */
export function legalTargets(b: any, f: Formation, a: any, act: RankAction): string[] {
  if (!overlaps(ranksOf(f, a.id), act.from) || !act.to.length) return [];
  if (a.actionUsed) return [];
  return targetsIn(b, f, a, act.to);
}

export function usable(b: any, f: Formation, a: any, act: RankAction): boolean {
  if (a.actionUsed || !overlaps(ranksOf(f, a.id), act.from)) return false;
  if ((act.kind === "cast" || act.kind === "channel") && !canCastNow(a, act.spellId)) return false;
  if (act.kind === "defend" || act.kind === "channel" || (act.kind === "skill" && !act.to.length)) return true;
  if (act.kind === "swap") return f[a.team as Side].length > 1;
  return legalTargets(b, f, a, act).length > 0;
}

// ------------------------------------------------------------------ active skills

// Sword dances that strike a foe; the rest are stances on the dancer (engine: perform()).
const TARGETED_DANCES = ["phoenix", "hawk", "water", "final"];

/**
 * Active commands from the v54 workshop's command list (actionGroups) that depend on a
 * talent, trait, rune or sword dance. Plain attack / defend stay as their own buttons.
 */
function activeSkills(a: any): RankAction[] {
  const out: RankAction[] = [];
  const melee = [...a.weapons].filter((w: any) => !w.ranged && !w.freeOnly && !/맨손|unarmed/i.test(w.name))
    .sort((x: any, y: any) => (y.damage ?? 0) - (x.damage ?? 0))[0] ?? a.weapons.find((w: any) => !w.ranged);
  const meleeRanks = melee ? weaponRanks(melee).from : [1];
  const add = (action: string, label: string, mode: "melee" | "ranged" | "self", extra: Partial<RankAction> = {}) =>
    out.push({ kind: "skill", action, label, from: mode === "melee" ? meleeRanks : ALL, to: mode === "melee" ? MELEE_TARGETS : mode === "ranged" ? ALL : [], weaponId: mode === "melee" ? melee?.id : undefined, ...extra });

  const dancer = C.swordDanceWeapon(a);
  for (const id of a.techniques || []) {
    const t = E.SWORD_TECHNIQUES.find((x: any) => x.id === id);
    if (!t || !dancer) continue;
    // Phoenix's Flight is a leaping strike the engine forbids while engaged: rank 2 only.
    const hits = TARGETED_DANCES.includes(id), r = id === "phoenix" ? [2] : weaponRanks(dancer).from;
    out.push({ kind: "skill", action: "technique", techniqueId: id, label: `검무 · ${t.name}`, weaponId: dancer.id, from: r, to: hits ? MELEE_TARGETS : [] });
  }
  for (const [id, talent] of [["disarm", "Disarm"], ["feint", "Feint"], ["beat", "Beat Blade"]]) if (C.talent(a, talent)) add(id, actionName(id), "melee");
  for (const [id, t] of [["distract", "Distract"], ["frenzy", "Frenzy"]]) if (C.talent(a, t) || C.trait(a, t)) add(id, actionName(id), "self");
  if (C.trait(a, "Bite")) add("bite", actionName("bite"), "melee", { from: [1, 2] });
  if (C.trait(a, "Tail")) add("tail", actionName("tail"), "melee", { from: [1, 2] });
  if (C.trait(a, "Breath")) add("breath", actionName("breath"), "melee", { from: [1, 2] });
  const rune = (n: number, min = 1) => a.weapons.find((w: any) => (C.rune(a, n, w) || 0) >= min);
  if (rune(13)) add("throw-rune", actionName("throw-rune"), "ranged", { weaponId: rune(13).id });
  if (rune(5, 2)) add("rune-fire", actionName("rune-fire"), "ranged", { weaponId: rune(5, 2).id });
  if (rune(65)) add("immolate", actionName("immolate"), "self", { weaponId: rune(65).id });
  if (a.doomRunes?.length) add("doom", actionName("doom"), "self");
  return out;
}

// ------------------------------------------------------------------ engine projection

/** Puts actors on the engine grid so a rank-legal action also passes the engine's own checks. */
function project(b: any, a: any, t: any, kind: ActionKind, ranged: boolean, f: Formation, leap = false) {
  const saved = b.actors.map((x: any) => ({ id: x.id, x: x.x, y: x.y }));
  let ally = 0, enemy = 0;
  for (const x of b.actors) { // park everyone far apart and out of reach
    if (x.team === "allies") { x.x = 0; x.y = Math.min(b.config.height - 1, ally++ * 3); }
    else { x.x = b.config.width - 1; x.y = Math.min(b.config.height - 1, enemy++ * 3); }
  }
  const gap = ranged ? Math.min(8, 2 * (rankOf(f, a.id) + rankOf(f, t.id) - 1)) : leap ? 3 : 1;
  a.x = 6; a.y = 6;
  // Leave `gap` cells between the attacker's far edge and the target (big creatures cover several).
  t.x = Math.min(b.config.width - C.footprint(t), a.x + C.footprint(a) - 1 + gap); t.y = 6;
  return () => { for (const s of saved) { const x = actor(b, s.id); x.x = s.x; x.y = s.y; } };
}

/**
 * Executes a rank action for the current actor and ends their turn.
 * Returns an error message when the engine refuses (the turn is NOT ended then).
 */
export function perform(b: any, f: Formation, a: any, act: RankAction, targetId?: string): string | null {
  // A refused engine call restores the battle from a backup, which replaces the actor
  // objects; always work on the live ones.
  a = actor(b, a.id);
  if (C.current(b)?.id !== a?.id) return "현재 차례가 아닙니다.";
  if (!usable(b, f, a, act)) return "지금 위치에서는 쓸 수 없는 행동입니다.";
  const side = f[a.team as Side];

  if (act.kind === "swap") {
    // targetId names the ally to trade places with; it must stand next to `a`.
    const i = side.indexOf(a.id), j = targetId ? side.indexOf(targetId) : i + 1 < side.length ? i + 1 : i - 1;
    if (j < 0 || Math.abs(i - j) !== 1) return "바로 옆 열의 아군과만 자리를 바꿀 수 있습니다.";
    [side[i], side[j]] = [side[j], side[i]];
    C.perform(b, a.id, "end", {});
    return null;
  }
  if (act.kind === "channel") {
    const sp = C.spellFor(a, act.spellId);
    C.perform(b, a.id, "channel", { spellId: act.spellId, wind: windFor(a, sp) });
    if (C.current(b)?.id === a.id) C.perform(b, a.id, "end", {});
    return null;
  }
  if (act.kind === "skill" && !act.to.length) {
    C.perform(b, a.id, act.action, { techniqueId: act.techniqueId, weaponId: act.weaponId });
    if (b.status === "running" && C.current(b)?.id === a.id) C.perform(b, a.id, "end", {});
    return null;
  }
  if (act.kind === "defend") {
    C.perform(b, a.id, "defend", {});
    if (C.current(b)?.id === a.id) C.perform(b, a.id, "end", {});
    return null;
  }

  const t = actor(b, targetId!);
  if (!t || !legalTargets(b, f, a, act).includes(t.id)) return "그 대상은 지금 닿지 않습니다.";

  if (act.kind === "shove" || act.kind === "pull") {
    // Opposed Strength test; on success the target moves one rank back (shove) or forward (pull).
    const foes = f[t.team as Side], k = foes.indexOf(t.id), dest = act.kind === "shove" ? k + 1 : k - 1;
    const atk = C.rollTest(C.stat(a, "S"), C.random(b)), def = C.rollTest(C.stat(t, "S"), C.random(b));
    const win = C.compareTests(atk, def) > 0;
    b.log.push({ n: ++b.logCounter, round: b.round, kind: "visual", actor: a.id, name: a.name, team: a.team, action: act.kind,
      target: t.id, targetName: t.name, label: act.label, outcome: win ? "성공" : "실패",
      text: `${a.name} · ${act.label} → ${t.name} · ${win ? "성공" : "실패"}`,
      dice: [{ name: a.name, key: "근력", ...atk }, { name: t.name, key: "근력", ...def }], presentationGroup: b.logCounter });
    if (win && dest >= 0 && dest < foes.length) [foes[k], foes[dest]] = [foes[dest], foes[k]];
    C.perform(b, a.id, "end", {});
    return null;
  }

  const w = act.weaponId ? a.weapons.find((x: any) => x.id === act.weaponId) : null;
  const restore = project(b, a, t, act.kind, act.kind === "cast" ? !/touch/i.test(C.spellFor(a, act.spellId)?.range || "") : act.kind === "skill" ? ["throw-rune", "rune-fire"].includes(act.action!) : !!w?.ranged, f, act.techniqueId === "phoenix");
  try {
    if (act.kind === "attack") C.perform(b, a.id, "attack", { target: t.id, weaponId: act.weaponId });
    else if (act.kind === "skill") C.perform(b, a.id, act.action, { target: t.id, weaponId: act.weaponId, techniqueId: act.techniqueId });
    else C.perform(b, a.id, "cast", { target: t.id, spellId: act.spellId });
  } catch (e) {
    restore();
    return (e as Error).message;
  }
  restore();
  compact(b, f);
  if (b.status === "running" && C.current(b)?.id === a.id) C.perform(b, a.id, "end", {});
  return null;
}

// ------------------------------------------------------------------ simple AI

/** Picks an action for a non-player actor: best reachable attack, else reposition, else defend. */
export function aiChoose(b: any, f: Formation, a: any, opts: { noSkills?: boolean } = {}): { act: RankAction; target?: string } {
  const acts = actionsFor(b, f, a).filter(x => !(opts.noSkills && x.kind === "skill"));
  const prefersRanged = a.tactic === "ranged";
  let best: { act: RankAction; target: string; score: number } | null = null;
  for (const act of acts.filter(x => (x.kind === "attack" || x.kind === "cast" || (x.kind === "skill" && x.to.length > 0)) && usable(b, f, a, x))) {
    for (const id of legalTargets(b, f, a, act)) {
      const t = actor(b, id);
      const w = act.weaponId ? a.weapons.find((x: any) => x.id === act.weaponId) : null;
      let score = w ? C.weaponBaseDamage(a, w) : 6;
      if (prefersRanged && (act.kind === "cast" || w?.ranged)) score += 3;
      if (act.kind === "skill") score += 1; // use special moves when they reach
      score += 4 * (1 - t.wounds / Math.max(1, t.maxWounds)); // finish off the wounded
      score += Math.random();
      if (!best || score > best.score) best = { act, target: id, score };
    }
  }
  if (best) return { act: best.act, target: best.target };
  // Nothing in reach: step toward a rank where one of our attacks works.
  const side = f[a.team as Side], i = side.indexOf(a.id);
  const attacks = acts.filter(x => x.kind === "attack" || x.kind === "cast");
  const wantFront = i > 0 && attacks.some(x => x.from.includes(rankOf(f, side[i - 1])));
  const wantBack = i + 1 < side.length && attacks.some(x => x.from.includes(rankOf(f, side[i + 1]) + (f.width[side[i + 1]] ?? 1) - 1));
  const swap = acts.find(x => x.kind === "swap")!;
  if (usable(b, f, a, swap)) {
    if (wantFront && C.conscious(actor(b, side[i - 1]))) return { act: swap, target: side[i - 1] };
    if (wantBack) return { act: swap, target: side[i + 1] };
  }
  return { act: acts.find(x => x.kind === "defend")! };
}

export const swarmSize = (a: any) => (C.trait(a, "Swarm") ? 3 : 1);
export const actionName = (k: string) => D.ACTION_NAMES[k] || k;

/** True when the engine already spent this actor's turn (unconscious, stunned, fast-shot, …). */
export const cannotAct = (a: any) => !C.conscious(a) || a.actionUsed || !!stuckReason(a);

/** Engine conditions that forbid acting this turn (WFRP: Broken flees, Surprised loses the turn). */
export function stuckReason(a: any): string {
  if (a.conditions?.Broken) return "공황 상태";
  if (a.conditions?.Surprised) return "기습당한 상태";
  if (a.effects?.some((e: any) => e.kind === "cannotAct")) return "행동 불가 효과";
  return "";
}

/** Ends a turn that has nothing left to do. */
export function skipTurn(b: any, a: any) {
  if (b.status === "running" && C.current(b)?.id === a.id) C.perform(b, a.id, "end", {});
}

/** Spell wind for channelling, chosen the way the workshop UI did. */
function windFor(a: any, sp: any) {
  return sp?.wind || (sp?.lore === "High Magic" ? "Qhaysh" : Object.keys(a.skills).find(k => k.startsWith("Channelling ("))?.match(/\((.*?)\)/)?.[1]);
}
const canChannel = (a: any) => Object.keys(a.skills || {}).some(k => k.startsWith("Channelling"));

/** Mirrors the engine's casting blocks (burn-out, "cannot cast" effects, a disabled spell). */
const canCastNow = (a: any, id?: string) =>
  (!id || !a.spellIds || a.spellIds.includes(id)) && !a.burnout && !a.effects?.some((e: any) => e.kind === "cannotCast" || (e.kind === "disabledSpell" && (e.id === id || e.disabledSpell === id)));

/**
 * The engine stops on rulings it leaves to the GM (miscast placement, odd armour qualities…).
 * The workshop asked the GM in a dialog; the game has no GM yet, so it records the ruling as
 * a note with no mechanical change (the workshop's "note" ruling) and returns its text.
 */
export function settlePending(b: any): string {
  const p = b.pending;
  if (!p) return "";
  C.adjudicate(b, p.actor, { kind: "note", value: 0, note: `GM 판정 보류 → 효과 없이 진행: ${p.note || p.kind}` });
  return p.note || p.kind;
}
