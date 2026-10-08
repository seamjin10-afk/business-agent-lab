import Phaser from "phaser";
import { BattleScene } from "./battle/BattleScene";

// 20×12 board of 32px tiles plus a 40px strip on top for tall sprites.
new Phaser.Game({
  type: Phaser.AUTO,
  parent: "board",
  width: 640,
  height: 424,
  pixelArt: true,
  backgroundColor: "#0b0a0e",
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH, expandParent: false },
  scene: [BattleScene],
});
