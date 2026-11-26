import Phaser from "phaser";

export const T = 16;

type Px = (g: Phaser.GameObjects.Graphics) => void;

function make(scene: Phaser.Scene, key: string, draw: Px) {
  const g = scene.add.graphics();
  draw(g);
  g.generateTexture(key, T, T);
  g.destroy();
}

const dots = (g: Phaser.GameObjects.Graphics, color: number, pts: [number, number][]) => {
  g.fillStyle(color);
  pts.forEach(([x, y]) => g.fillRect(x, y, 1, 1));
};

/** Procedural placeholder pixel art so the game runs with zero asset files. */
export function buildTextures(scene: Phaser.Scene) {
  make(scene, "grass", g => {
    g.fillStyle(0x3c8d4a).fillRect(0, 0, T, T);
    dots(g, 0x2f7a3d, [[2, 3], [9, 2], [13, 8], [5, 11], [11, 13], [1, 14]]);
    dots(g, 0x58b366, [[6, 5], [12, 4], [3, 9], [8, 14]]);
  });
  make(scene, "path", g => {
    g.fillStyle(0xb99a6b).fillRect(0, 0, T, T);
    dots(g, 0x9c7f52, [[3, 3], [10, 6], [6, 12], [13, 13]]);
  });
  make(scene, "wall", g => {
    g.fillStyle(0x6b6b7a).fillRect(0, 0, T, T);
    g.fillStyle(0x4a4a58);
    g.fillRect(0, 7, T, 1).fillRect(0, 15, T, 1).fillRect(7, 0, 1, 7).fillRect(3, 8, 1, 7).fillRect(11, 8, 1, 7);
  });
  make(scene, "tree", g => {
    g.fillStyle(0x3c8d4a).fillRect(0, 0, T, T);
    g.fillStyle(0x5a3b1e).fillRect(7, 10, 2, 6);
    g.fillStyle(0x1f5a2b).fillCircle(8, 7, 6);
    g.fillStyle(0x2f7a3d).fillCircle(6, 5, 3);
  });
  make(scene, "gate", g => {
    g.fillStyle(0xb99a6b).fillRect(0, 0, T, T);
    g.fillStyle(0x5a3b1e).fillRect(1, 1, 14, 14);
    g.fillStyle(0x3a2512).fillRect(7, 1, 2, 14).fillRect(1, 7, 14, 2);
    dots(g, 0xffd166, [[5, 8], [10, 8]]);
  });
  const person = (key: string, body: number, hair: number) =>
    make(scene, key, g => {
      g.fillStyle(0xf1c27d).fillRect(5, 2, 6, 5);
      g.fillStyle(hair).fillRect(5, 1, 6, 2);
      g.fillStyle(body).fillRect(4, 7, 8, 6);
      g.fillStyle(0x333344).fillRect(5, 13, 2, 3).fillRect(9, 13, 2, 3);
      dots(g, 0x000000, [[6, 4], [9, 4]]);
    });
  person("player", 0x3f6fd1, 0x4a2c10);
  person("elder", 0x8e44ad, 0xdddddd);
  person("guard", 0xb03a2e, 0x222222);
}
