import Phaser from "phaser";
import { WorldScene } from "./scenes/WorldScene";

new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game",
  width: 320,
  height: 180,
  pixelArt: true,
  backgroundColor: "#0e0b14",
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: [WorldScene],
});
