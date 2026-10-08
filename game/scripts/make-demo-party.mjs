// Builds the fixed demo party through the workshop's own creation rules and saves the
// character states, so every run of the demo battle starts from the same characters.
// Usage: npm run demo-party
import fs from "fs";
import { E } from "../src/rules/engine.js";
import { rules as R, autoEquip } from "../src/rules/builder.js";

const PARTY = [
  { name: "인간 검사", species: "Human", careerId: "96", sprite: "human-swordsman" },
  { name: "드워프 전사", species: "Dwarf", careerId: "dwarf-dwarf-soldier-axefighter", sprite: "dwarf-warrior" },
  { name: "엘프 마법사", species: "High Elf", careerId: "elf-mage", sprite: "elf-mage", spells: ["Dart", "Shock"] },
];

const out = PARTY.map(p => {
  const s = E.randomCharacter(R, { species: p.species, careerId: p.careerId, name: p.name });
  E.finalize(R, s);
  for (const name of p.spells || []) E.learnSpell(R, s, R.spells.find(sp => sp.name === name && sp.lore === "Petty").id);
  autoEquip(s);
  return { sprite: p.sprite, state: s };
});
fs.writeFileSync(new URL("../src/data/demo-party.json", import.meta.url), JSON.stringify(out, null, 1));
console.log(out.map(x => `${x.state.profile.name} (${x.state.species}/${x.state.career}) equipped=${x.state.equipped.length} spells=${x.state.knownSpells.length}`).join("\n"));
