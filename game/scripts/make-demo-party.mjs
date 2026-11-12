// Builds the fixed demo party through the workshop's own creation rules and saves the
// character states, so every run of the demo battle starts from the same characters.
// Usage: npm run demo-party
import fs from "fs";
import { E } from "../src/rules/engine.js";
import { rules as R, autoEquip } from "../src/rules/builder.js";

const PARTY = [
  { name: "드워프 전사", species: "Dwarf", careerId: "dwarf-dwarf-soldier-axefighter", sprite: "dwarf-warrior" },
  { name: "인간 검사", species: "Human", careerId: "96", sprite: "human-swordsman" },
  { name: "엘프 마법사", species: "High Elf", careerId: "elf-mage", sprite: "elf-mage", spells: ["Dart", "Shock"] },
  { name: "엘프 소드마스터", species: "High Elf", careerId: "elf-swordmaster", sprite: "elf-swordmaster", swordmaster: true },
];

/**
 * Swordmaster with sword dances, earned the workshop way: fill the level-1 advance track,
 * promote to Swordmaster, buy Sword-dancing, learn three dances, carry a Greatsword of Hoeth.
 */
function makeSwordmaster(s) {
  s.xp += 2000;
  const career = R.careers.find(c => c.id === s.career);
  for (const k of career.levels[0].skills) for (let i = 0; i < 3 && s.tracker < 10; i++) { try { E.buy(R, s, "skill", k); } catch { break; } }
  E.promote(s, R);
  E.buy(R, s, "talent", "Sword-dancing");
  for (const id of ["phoenix", "hawk", "storm"]) E.learnSwordTechnique(s, id);
  s.extraGear.push({ item: "Greatsword of Hoeth", specId: "supp-greatsword-of-hoeth", automatic: false });
}

const out = PARTY.map(p => {
  const s = E.randomCharacter(R, { species: p.species, careerId: p.careerId, name: p.name });
  E.finalize(R, s);
  for (const name of p.spells || []) E.learnSpell(R, s, R.spells.find(sp => sp.name === name && sp.lore === "Petty").id);
  if (p.swordmaster) makeSwordmaster(s);
  autoEquip(s);
  return { sprite: p.sprite, state: s };
});
fs.writeFileSync(new URL("../src/data/demo-party.json", import.meta.url), JSON.stringify(out, null, 1));
console.log(out.map(x => `${x.state.profile.name} (${x.state.species}/${x.state.career}) equipped=${x.state.equipped.length} spells=${x.state.knownSpells.length}`).join("\n"));
