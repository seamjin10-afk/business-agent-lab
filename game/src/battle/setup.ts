import { C, D } from "../rules/engine.js";
import { rules, ownedItems } from "../rules/builder.js";
import demoParty from "../data/demo-party.json";

/** How the player's side is driven. The engine itself only knows "manual" (one controlled actor) and "auto". */
export type ControlMode = "auto" | "single" | "all";

export interface BattleSetup {
  mode: ControlMode;
  controlled: number; // party index, used by "single"
  enemies: string[];  // D.ENEMY_PROFILES ids
  background: string;
  seed: number;
}

export const DEFAULT_SETUP: BattleSetup = {
  mode: "all",
  controlled: 0,
  enemies: ["orc", "goblin", "goblin"],
  background: "forest",
  seed: 7,
};

export interface Roster {
  battle: any;
  /** actor id → sprite unit id (docs/SPRITE_SPEC.md) */
  sprites: Record<string, string>;
}

export function createDemoBattle(setup: BattleSetup): Roster {
  const allies = (demoParty as any[]).map(p => ({
    ...C.fromBuilder(rules, structuredClone(p.state), ownedItems(p.state)),
    tactic: p.sprite === "elf-mage" ? "ranged" : "melee",
  }));
  const enemies = setup.enemies.map(id => {
    const p = D.ENEMY_PROFILES.find((x: any) => x.id === id);
    if (!p) throw new Error(`unknown enemy profile: ${id}`);
    return { ...p, tactic: D.combatTactic(p).id };
  });
  const battle = C.createBattle({
    allies, enemies, seed: setup.seed,
    mode: setup.mode === "auto" ? "auto" : "manual",
    controlled: "ally-" + setup.controlled,
    config: { background: setup.background },
  });
  const sprites: Record<string, string> = {};
  (demoParty as any[]).forEach((p, i) => { sprites["ally-" + i] = p.sprite; });
  setup.enemies.forEach((id, i) => { sprites["enemy-" + i] = id; });
  return { battle, sprites };
}

/** Whether the player picks this actor's action, given the control mode. */
export function playerControls(setup: BattleSetup, battle: any, actor: any): boolean {
  if (!actor || actor.team !== "allies" || setup.mode === "auto") return false;
  return setup.mode === "all" || actor.id === "ally-" + setup.controlled;
}
