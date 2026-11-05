// Darkest Dungeon style rank combat on top of the ported WFRP engine.
//
// Each side stands in 4 ranks (1 = front). One actor per rank; an actor with the
// Swarm trait is one engine participant drawn as a crowd. Rank rules decide WHO may
// act on WHOM; the engine still rolls the dice, applies damage, criticals and
// conditions. Right before an engine call the two participants are placed on the
// engine grid at a distance that satisfies its reach / range checks ("projection"),
// everyone else is parked out of the way, and the formation is restored afterwards.
import { C, D } from "../rules/engine.js";

export const RANKS = 4;
export type Side = "allies" | "enemies";

export type ActionKind = "attack" | "cast" | "defend" | "swap" | "shove" | "pull";

export interface RankAction {
  kind: ActionKind;
  label: string;
  weaponId?: string;
  spellId?: string;
  /** ranks the user may stand in */
  from: number[];
  /** enemy ranks it can reach (empty for self/ally actions) */
  to: number[];
}

/** The formation: actor ids per side, index 0 = rank 1. */
export interface Formation { allies: string[]; enemies: string[] }

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
  const side = (team: Side) => b.actors.filter((a: any) => a.team === team).map((a: any) => a.id).slice(0, RANKS);
  return { allies: side("allies"), enemies: side("enemies") };
}

export function sideOf(f: Formation, id: string): Side { return f.allies.includes(id) ? "allies" : "enemies"; }
export function rankOf(f: Formation, id: string): number { return f[sideOf(f, id)].indexOf(id) + 1; }
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
  return foes.filter((id, i) => ranks.includes(i + 1) && C.active(actor(b, id)));
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
    out.push({ kind: "cast", label: `주문 · ${sp.name}`, spellId: sp.id, from: touch ? [1, 2] : ALL, to: touch ? MELEE_TARGETS : ALL });
  }
  out.push({ kind: "shove", label: "밀치기", from: [1], to: [1] });
  out.push({ kind: "pull", label: "끌어오기", from: [1, 2], to: [2, 3] });
  out.push({ kind: "swap", label: "자리 바꾸기", from: ALL, to: [] });
  out.push({ kind: "defend", label: "방어 태세", from: ALL, to: [] });
  return out;
}

/** Enemy ids this action can hit right now (rank of the user and of the targets checked). */
export function legalTargets(b: any, f: Formation, a: any, act: RankAction): string[] {
  if (!act.from.includes(rankOf(f, a.id)) || !act.to.length) return [];
  if (a.actionUsed) return [];
  return targetsIn(b, f, a, act.to);
}

export function usable(b: any, f: Formation, a: any, act: RankAction): boolean {
  if (a.actionUsed || !act.from.includes(rankOf(f, a.id))) return false;
  if (act.kind === "defend") return true;
  if (act.kind === "swap") return f[a.team as Side].length > 1;
  return legalTargets(b, f, a, act).length > 0;
}

// ------------------------------------------------------------------ engine projection

/** Puts actors on the engine grid so a rank-legal action also passes the engine's own checks. */
function project(b: any, a: any, t: any, kind: ActionKind, ranged: boolean, f: Formation) {
  const saved = b.actors.map((x: any) => ({ id: x.id, x: x.x, y: x.y }));
  let ally = 0, enemy = 0;
  for (const x of b.actors) { // park everyone far apart and out of reach
    if (x.team === "allies") { x.x = 0; x.y = Math.min(b.config.height - 1, ally++ * 3); }
    else { x.x = b.config.width - 1; x.y = Math.min(b.config.height - 1, enemy++ * 3); }
  }
  const gap = ranged ? Math.min(8, 2 * (rankOf(f, a.id) + rankOf(f, t.id) - 1)) : 1;
  a.x = 6; a.y = 6;
  t.x = Math.min(b.config.width - C.footprint(t), a.x + gap); t.y = 6;
  return () => { for (const s of saved) { const x = actor(b, s.id); x.x = s.x; x.y = s.y; } };
}

/**
 * Executes a rank action for the current actor and ends their turn.
 * Returns an error message when the engine refuses (the turn is NOT ended then).
 */
export function perform(b: any, f: Formation, a: any, act: RankAction, targetId?: string): string | null {
  if (C.current(b)?.id !== a.id) return "현재 차례가 아닙니다.";
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
  const restore = project(b, a, t, act.kind, act.kind === "cast" ? !/touch/i.test(C.spellFor(a, act.spellId)?.range || "") : !!w?.ranged, f);
  try {
    if (act.kind === "attack") C.perform(b, a.id, "attack", { target: t.id, weaponId: act.weaponId });
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
export function aiChoose(b: any, f: Formation, a: any): { act: RankAction; target?: string } {
  const acts = actionsFor(b, f, a);
  const prefersRanged = a.tactic === "ranged";
  let best: { act: RankAction; target: string; score: number } | null = null;
  for (const act of acts.filter(x => x.kind === "attack" || x.kind === "cast")) {
    for (const id of legalTargets(b, f, a, act)) {
      const t = actor(b, id);
      const w = act.weaponId ? a.weapons.find((x: any) => x.id === act.weaponId) : null;
      let score = w ? C.weaponBaseDamage(a, w) : 6;
      if (prefersRanged && (act.kind === "cast" || w?.ranged)) score += 3;
      score += 4 * (1 - t.wounds / Math.max(1, t.maxWounds)); // finish off the wounded
      score += Math.random();
      if (!best || score > best.score) best = { act, target: id, score };
    }
  }
  if (best) return { act: best.act, target: best.target };
  // Nothing in reach: step toward a rank where one of our attacks works.
  const side = f[a.team as Side], i = side.indexOf(a.id);
  const attacks = acts.filter(x => x.kind === "attack" || x.kind === "cast");
  const wantFront = attacks.some(x => x.from.includes(i)) && i > 0; // rank i (one step forward) works
  const wantBack = attacks.some(x => x.from.includes(i + 2)) && i + 1 < side.length;
  const swap = acts.find(x => x.kind === "swap")!;
  if (wantFront && C.conscious(actor(b, side[i - 1]))) return { act: swap, target: side[i - 1] };
  if (wantBack) return { act: swap, target: side[i + 1] };
  return { act: acts.find(x => x.kind === "defend")! };
}

export const swarmSize = (a: any) => (C.trait(a, "Swarm") ? 3 : 1);
export const actionName = (k: string) => D.ACTION_NAMES[k] || k;

/** True when the engine already spent this actor's turn (unconscious, stunned, fast-shot, …). */
export const cannotAct = (a: any) => !C.conscious(a) || a.actionUsed;

/** Ends a turn that has nothing left to do. */
export function skipTurn(b: any, a: any) {
  if (b.status === "running" && C.current(b)?.id === a.id) C.perform(b, a.id, "end", {});
}
