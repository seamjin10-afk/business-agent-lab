// @ts-nocheck
// Character-builder glue ported from the legacy workshop app (it lived next to the UI there).
// ownedItems() is what C.fromBuilder() needs to know a character's weapons and armour.
import { E, CATALOG } from "./engine.js";
import R from "./rules.json" with { type: "json" };

const { ITEMS, SUPPLEMENTAL_ITEMS, RUNES, resolveItemSpec } = CATALOG;
E.configureRunes(RUNES);

export const rules = R;

export function initialGear(state) {
  const first = E.career(R, { ...state, career: state.originCareer || state.career });
  if (!first) return [];
  return ["Clothing", "Dagger", "Pouch",
    ...E.CLASS_GEAR[first.class].flatMap(t => E.dwarfTrapping(state, t)),
    ...first.levels[0].trappings,
    ...state.bonusGear.flatMap(t => E.dwarfTrapping(state, t))]
    .filter(x => x !== "None").map(x => state.gearChoices[x] || x);
}

export function ownedItems(state) {
  const all = [...ITEMS, ...SUPPLEMENTAL_ITEMS];
  const rows = initialGear(state).map((name, i) => ({ key: "start-" + i, name, source: "시작 장비", item: resolveItemSpec(name) }));
  state.extraGear.forEach((g, i) => rows.push({ key: "extra-" + i, name: g.item, source: g.automatic ? "커리어 지급" : "모험 중 확보", item: all.find(x => x.id === g.specId) || resolveItemSpec(g.item) }));
  state.purchases.forEach((p, i) => {
    const item = ITEMS.find(x => x.id === p.id && x.zones.includes(p.zone)) || ITEMS.find(x => x.legacyId === p.id && x.zones.includes(p.zone));
    if (item) for (let j = 0; j < p.quantity; j++) rows.push({ key: "purchase-" + i + "-" + j, name: item.english, source: "상점 구매", item });
  });
  (state.customItems || []).forEach(item => rows.push({ key: item.id, name: item.name, source: item.questReward ? "퀘스트 보상" : item.magicalArtifact ? "마법 유물 제작" : "사용자 제작", item }));
  return rows.map(row => ({
    ...row,
    item: row.item?.magicalArtifact ? row.item : (all.find(x => x.id === state.itemSpecs[row.key]) || row.item),
    equipped: state.equipped.includes(row.key),
    runes: (state.runeItems[row.key] || []).map(n => RUNES.find(r => r.No === n)).filter(Boolean),
  }));
}

const apOf = row => {
  const n = row.item?.fields?.["핵심 수치"] || "";
  const ap = Number(n.match(/AP\s*[:+]?\s*(\d+)/i)?.[1]);
  const slots = [/Head|머리/i, /Body|몸통/i, /Arms|팔/i, /Legs|다리/i].map(re => re.test(n));
  return { ap: Number.isFinite(ap) ? ap : 0, slots };
};

/** Equip every weapon/shield and, per body location, the single best armour piece. */
export function autoEquip(state) {
  const rows = ownedItems(state);
  const keep = new Set();
  const best = [null, null, null, null];
  for (const row of rows) {
    if (!row.item) continue;
    if (row.item.category === "방어구") {
      const { ap, slots } = apOf(row);
      if (ap <= 0) continue;
      slots.forEach((on, i) => { if (on && (!best[i] || apOf(best[i]).ap < ap)) best[i] = row; });
    } else if (String(row.item.category).startsWith("무기")) keep.add(row.key);
  }
  best.forEach(row => row && keep.add(row.key));
  state.equipped = rows.filter(r => keep.has(r.key)).map(r => r.key);
  return state;
}
