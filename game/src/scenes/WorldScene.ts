import Phaser from "phaser";
import { T, buildTextures } from "../textures";
import { StoryRunner } from "../story/story";
import { runDialogue } from "../ui";

// # tree, . grass, = path, G gate
const MAP = [
  "####################",
  "#..................#",
  "#......G...........#",
  "#......=...........#",
  "#...#..=..#........#",
  "#......=...........#",
  "#..=====...........#",
  "#..=...............#",
  "#..=.......#.......#",
  "####################",
];

const NPCS = [
  { key: "elder", x: 3, y: 7, knot: "elder", name: "촌장" },
  { key: "guard", x: 7, y: 3, knot: "guard", name: "문지기" },
];

export class WorldScene extends Phaser.Scene {
  private runner!: StoryRunner;
  private player!: Phaser.GameObjects.Image;
  private gx = 4;
  private gy = 6;
  private busy = false;
  private moving = false;
  private gate!: Phaser.GameObjects.Image;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;

  constructor() { super("world"); }

  create() {
    buildTextures(this);
    this.runner = new StoryRunner();

    MAP.forEach((row, y) => [...row].forEach((c, x) => {
      const tex = c === "#" ? "tree" : c === "=" ? "path" : c === "G" ? "path" : "grass";
      this.add.image(x * T, y * T, tex).setOrigin(0);
    }));
    this.gate = this.add.image(7 * T, 2 * T, "gate").setOrigin(0);
    this.syncGate();

    NPCS.forEach(n => this.add.image(n.x * T, n.y * T, n.key).setOrigin(0));
    this.player = this.add.image(this.gx * T, this.gy * T, "player").setOrigin(0).setDepth(5);

    const kb = this.input.keyboard!;
    this.keys = kb.addKeys("W,A,S,D,UP,DOWN,LEFT,RIGHT,SPACE,E") as typeof this.keys;
    this.cameras.main.setBounds(0, 0, MAP[0].length * T, MAP.length * T);
    this.cameras.main.startFollow(this.player, true);
  }

  private syncGate() {
    this.gate.setVisible(!this.runner.flag("gate_open"));
  }

  private blocked(x: number, y: number): boolean {
    const c = MAP[y]?.[x];
    if (c === undefined || c === "#") return true;
    if (c === "G" && !this.runner.flag("gate_open")) return true;
    return NPCS.some(n => n.x === x && n.y === y);
  }

  update() {
    if (this.busy || this.moving) return;
    const k = this.keys;
    if (Phaser.Input.Keyboard.JustDown(k.SPACE) || Phaser.Input.Keyboard.JustDown(k.E)) {
      this.interact();
      return;
    }
    let dx = 0, dy = 0;
    if (k.LEFT.isDown || k.A.isDown) dx = -1;
    else if (k.RIGHT.isDown || k.D.isDown) dx = 1;
    else if (k.UP.isDown || k.W.isDown) dy = -1;
    else if (k.DOWN.isDown || k.S.isDown) dy = 1;
    if (!dx && !dy) return;
    const nx = this.gx + dx, ny = this.gy + dy;
    if (this.blocked(nx, ny)) return;
    this.gx = nx; this.gy = ny;
    this.moving = true;
    this.tweens.add({
      targets: this.player, x: nx * T, y: ny * T, duration: 110,
      onComplete: () => { this.moving = false; },
    });
  }

  private async interact() {
    const npc = NPCS.find(n => Math.abs(n.x - this.gx) + Math.abs(n.y - this.gy) === 1);
    if (!npc) return;
    this.busy = true;
    await runDialogue(this.runner, npc.knot, npc.name);
    this.syncGate();
    // swallow the keypress that closed the dialogue so it doesn't reopen it
    Phaser.Input.Keyboard.JustDown(this.keys.SPACE);
    Phaser.Input.Keyboard.JustDown(this.keys.E);
    this.busy = false;
  }
}
