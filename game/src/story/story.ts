import { Compiler } from "inkjs/compiler/Compiler";
import { Story } from "inkjs/engine/Story";
import source from "./main.ink?raw";

export type Stats = Record<string, number>;

export const stats: Stats = { str: 1, cha: 3 };

export interface RollInfo { stat: string; dc: number; roll: number; total: number; ok: boolean }

const SAVE_KEY = "branch-tale-save";

export class StoryRunner {
  story: Story;
  onRoll: (r: RollInfo) => void = () => {};

  constructor() {
    this.story = new Compiler(source).Compile();
    this.story.BindExternalFunction("check", (stat: string, dc: number) => {
      const roll = 1 + Math.floor(Math.random() * 20);
      const total = roll + (stats[stat] ?? 0);
      const ok = total >= dc;
      this.onRoll({ stat, dc, roll, total, ok });
      return ok ? 1 : 0;
    });
    const saved = this.load();
    if (saved) this.story.state.LoadJson(saved);
  }

  start(knot: string) { this.story.ChoosePathString(knot); }

  /** Reads text until the next choice point. */
  advance(): { lines: string[]; choices: string[]; done: boolean } {
    const lines: string[] = [];
    while (this.story.canContinue) {
      const t = this.story.Continue()?.trim();
      if (t) lines.push(t);
    }
    const choices = this.story.currentChoices.map(c => c.text);
    return { lines, choices, done: choices.length === 0 };
  }

  choose(i: number) { this.story.ChooseChoiceIndex(i); }

  flag(name: string): boolean { return !!this.story.variablesState.$(name); }

  save() {
    try { localStorage.setItem(SAVE_KEY, this.story.state.toJson()); } catch {}
  }
  private load(): string | null {
    try { return localStorage.getItem(SAVE_KEY); } catch { return null; }
  }
}
