import { C, D } from "../rules/engine.js";
import { rules, ownedItems } from "../rules/builder.js";
import { LOADOUT_SIZE, loadoutOptions, skillKey } from "./ranks";
import demoParty from "../data/demo-party.json";

/** How the player's side is driven. The engine itself only knows "manual" (one controlled actor) and "auto". */
export type ControlMode = "auto" | "single" | "all";

export interface BattleSetup {
  mode: ControlMode;
  controlled: number; // party index, used by "single"
  enemies: string[];  // D.ENEMY_PROFILES ids
  background: string;
  seed: number;
  /** party index → equipped special-skill keys (max 4); missing = first four */
  loadout?: Record<number, string[]>;
}

export const DEFAULT_SETUP: BattleSetup = {
  mode: "all",
  controlled: 0,
  enemies: ["orc", "goblin-swarm", "goblin"],
  background: "forest",
  seed: 7,
};

export interface Roster {
  battle: any;
  /** actor id → sprite unit id (docs/SPRITE_SPEC.md) */
  sprites: Record<string, string>;
}

/** The demo party as battle participants (also used to list loadout choices). */
export function partyActors(): any[] {
  return (demoParty as any[]).map(p => ({
    ...C.fromBuilder(rules, structuredClone(p.state), ownedItems(p.state)),
    careerId: p.state.career, // picks the rig (cavalry careers get mounted rigs)
    careerClass: rules.careers.find((c: any) => c.id === p.state.career)?.class,
    tactic: p.sprite === "elf-mage" ? "ranged" : "melee",
  }));
}

export function createDemoBattle(setup: BattleSetup): Roster {
  const allies = partyActors().map((a, i) => {
    const keys = loadoutOptions(a).map(skillKey);
    return { ...a, loadout: setup.loadout?.[i] ?? keys.slice(0, LOADOUT_SIZE) };
  });
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
  setup.enemies.forEach((id, i) => { sprites["enemy-" + i] = id.replace(/-swarm$/, ""); });
  return { battle, sprites };
}

/** Whether the player picks this actor's action, given the control mode. */
export function playerControls(setup: BattleSetup, battle: any, actor: any): boolean {
  if (!actor || actor.team !== "allies" || setup.mode === "auto") return false;
  return setup.mode === "all" || actor.id === "ally-" + setup.controlled;
}
