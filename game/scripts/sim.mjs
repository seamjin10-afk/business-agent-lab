// Headless smoke test for the ported rules engine: runs one auto battle to completion.
// Usage: npm run sim [-- seed]
import { C, D } from "../src/rules/engine.js";

const seed = Number(process.argv[2] ?? 12345);
const unit = id => {
  const p = D.ENEMY_PROFILES.find(x => x.id === id);
  return { ...p, tactic: D.combatTactic(p).id };
};
const b = C.createBattle({
  allies: ["human", "dwarf", "elf"].map(unit),
  enemies: ["orc", "orc", "goblin", "goblin"].map(unit),
  seed, mode: "auto", config: { background: "forest" },
});
let steps = 0;
while (b.status === "running" && steps++ < 5000) C.aiTurn(b);
if (b.status === "running") { console.error("battle did not finish"); process.exit(1); }
console.log(`seed ${seed}: ${b.winner} win in round ${b.round} (${b.log.length} log entries)`);
for (const a of b.actors) console.log(`  ${a.team.padEnd(7)} ${a.name} ${a.wounds}/${a.maxWounds}`);
