// Darkest Dungeon's stress, driven by what actually happens in the WFRP engine.
//
// Each party member carries stress 0–200. After every engine call the battle is compared
// with its state before the call and stress moves on concrete events (criticals, falling
// to 0 Wounds, fear and panic, comrades falling, landing the killing blow). At 100 the
// character makes a WFRP Cool test: success is a moment of resolve (virtue), failure an
// affliction. At 200 the heart gives out: the character drops to 0 Wounds, unconscious.
// The numbers below are the tuning knobs.
import { C } from "../rules/engine.js";

export const STRESS_MAX = 200, RESOLVE_AT = 100;

const GAIN = {
  critical: 20,      // took a critical wound
  zeroWounds: 15,    // reduced to 0 Wounds (death's door)
  broken: 15,        // gained Broken (failed fear / terror / panic)
  allyDown: 10,      // a comrade went down
  allyDead: 20,      // a comrade died
  afflictedTurn: 4,  // an afflicted comrade lashes out at the start of their turn
};
const RELIEF = {
  dealtCritical: 8,  // inflicted a critical wound
  felledFoe: 6,      // took an enemy out
  teamFelled: 2,     // anyone on the side took an enemy out
};

export type Resolve = "afflicted" | "virtuous" | null;
export interface StressState { value: number; resolve: Resolve }
export type StressBook = Record<string, StressState>;

export interface Snapshot { id: string; team: string; conscious: boolean; dead: boolean; wounds: number; criticals: number; broken: boolean }
export const snapshot = (b: any): Snapshot[] => b.actors.map((a: any) => ({
  id: a.id, team: a.team, conscious: C.conscious(a), dead: !!a.dead, wounds: a.wounds,
  criticals: (a.criticals || []).length, broken: !!a.conditions?.Broken,
}));

export function newBook(b: any): StressBook {
  const book: StressBook = {};
  for (const a of b.actors) if (a.team === "allies") book[a.id] = { value: 0, resolve: null };
  return book;
}

/** Messages to show/log; `actor` is who it concerns. */
export interface StressNote { actor: string; text: string; delta?: number; kind: "gain" | "relief" | "virtue" | "affliction" | "heart" }

/**
 * Applies stress for everything that changed between `before` and the battle now.
 * `actorId` is whoever took the action (for relief from their own blows).
 */
export function settle(b: any, book: StressBook, before: Snapshot[], actorId: string | null): StressNote[] {
  const notes: StressNote[] = [];
  const add = (id: string, n: number, why: string) => {
    const s = book[id], a = b.actors.find((x: any) => x.id === id);
    if (!s || !a || a.dead || a.escaped || !n) return;
    if (n > 0 && s.resolve === "virtuous") n = Math.ceil(n / 2); // resolve steels the nerves
    s.value = Math.max(0, Math.min(STRESS_MAX, s.value + n));
    notes.push({ actor: id, text: `${a.name} · ${why} (스트레스 ${n > 0 ? "+" : ""}${n})`, delta: n, kind: n > 0 ? "gain" : "relief" });
  };
  for (const was of before) {
    const a = b.actors.find((x: any) => x.id === was.id);
    if (!a) continue;
    const crits = (a.criticals || []).length - was.criticals;
    if (was.team === "allies") {
      if (crits > 0) add(a.id, GAIN.critical * crits, "치명상");
      if (was.wounds > 0 && a.wounds === 0 && !a.dead) add(a.id, GAIN.zeroWounds, "죽음의 문턱");
      if (!was.broken && a.conditions?.Broken) add(a.id, GAIN.broken, "공황");
    } else if (crits > 0 && actorId && book[actorId]) {
      add(actorId, -RELIEF.dealtCritical * crits, "치명타를 꽂음");
    }
    if (was.conscious && !C.conscious(a)) {
      const comrades = Object.keys(book).filter(id => id !== a.id);
      if (was.team === "allies") for (const id of comrades) add(id, a.dead ? GAIN.allyDead : GAIN.allyDown, `${a.name} ${a.dead ? "전사" : "쓰러짐"}`);
      else {
        if (actorId && book[actorId]) add(actorId, -RELIEF.felledFoe, "적을 쓰러뜨림");
        for (const id of Object.keys(book)) if (id !== actorId) add(id, -RELIEF.teamFelled, "적이 쓰러짐");
      }
    }
  }
  notes.push(...checkThresholds(b, book));
  return notes;
}

/** Resolve test at 100, heart attack at 200. */
function checkThresholds(b: any, book: StressBook): StressNote[] {
  const notes: StressNote[] = [];
  for (const [id, s] of Object.entries(book)) {
    const a = b.actors.find((x: any) => x.id === id);
    if (!a || a.dead || a.escaped) continue;
    if (s.value >= STRESS_MAX) {
      s.value = 150;
      a.wounds = 0;
      C.addCondition(b, a, "Unconscious", 1);
      notes.push({ actor: id, kind: "heart", text: `${a.name} · 심장이 버티지 못했다 — 체력 0, 의식 잃음` });
    } else if (s.value >= RESOLVE_AT && !s.resolve) {
      const target = a.skills?.Cool ?? C.stat(a, "WP");
      const test = C.rollTest(target, C.random(b));
      if (test.success) {
        s.resolve = "virtuous";
        s.value = 45;
        a.fortune = (a.fortune || 0) + 1;
        for (const c of ["Broken", "Fatigued"]) if (a.conditions?.[c]) C.removeCondition(b, a, c, a.conditions[c]);
        notes.push({ actor: id, kind: "virtue", text: `${a.name} · 냉정 ${test.roll}/${target} 성공 → 각성! 스트레스 45, 행운점 +1, 공황·피로 해소` });
      } else {
        s.resolve = "afflicted";
        a.corruption = (a.corruption || 0) + 1;
        C.addCondition(b, a, "Fatigued", 1);
        notes.push({ actor: id, kind: "affliction", text: `${a.name} · 냉정 ${test.roll}/${target} 실패 → 고난. 타락 +1, 피로` });
      }
    }
  }
  return notes;
}

/** An afflicted character unsettles the rest of the party at the start of their turn. */
export function afflictedTurn(b: any, book: StressBook, actorId: string): StressNote[] {
  if (book[actorId]?.resolve !== "afflicted") return [];
  const a = b.actors.find((x: any) => x.id === actorId);
  const notes: StressNote[] = [];
  for (const id of Object.keys(book)) {
    if (id === actorId) continue;
    const t = b.actors.find((x: any) => x.id === id);
    if (!t || !C.conscious(t)) continue;
    book[id].value = Math.min(STRESS_MAX, book[id].value + GAIN.afflictedTurn);
    notes.push({ actor: id, delta: GAIN.afflictedTurn, kind: "gain", text: `${a.name}의 고난이 ${t.name}을(를) 흔듦 (스트레스 +${GAIN.afflictedTurn})` });
  }
  return [...notes, ...checkThresholds(b, book)];
}

/** WFRP "death's door": at 0 Wounds every further hit risks a critical; Fate can save them. */
export const atDeathsDoor = (a: any) => a.wounds === 0 && !a.dead && !a.escaped && !a.banished;
