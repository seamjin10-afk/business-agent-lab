import Phaser from "phaser";
import { BattleScene } from "./battle/BattleScene";

// The scene works in a 640×424 world; the canvas is 2x so the painted rig parts stay sharp
// (BattleScene zooms its camera by 2).
new Phaser.Game({
  type: Phaser.AUTO,
  parent: "board",
  width: 1280,
  height: 848,
  pixelArt: true,
  backgroundColor: "#0b0a0e",
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH, expandParent: false },
  scene: [BattleScene],
});
