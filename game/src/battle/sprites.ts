import Phaser from "phaser";

/** Poses delivered per unit (docs/SPRITE_SPEC.md). Missing poses fall back to idle. */
export const POSES = ["idle", "move", "melee", "ranged", "cast", "hit", "death"] as const;
export type Pose = (typeof POSES)[number];

// Final sprites: src/assets/sprites/<unit>/<pose>.png (from tools/pixelize.py).
const finals = import.meta.glob("../assets/sprites/*/*.png", { eager: true, query: "?url", import: "default" }) as Record<string, string>;
// Stand-ins downscaled from the reference illustrations until GPT sprites arrive.
const placeholders = import.meta.glob("../assets/placeholder/*.png", { eager: true, query: "?url", import: "default" }) as Record<string, string>;

const available = new Set<string>();

export function preloadSprites(scene: Phaser.Scene) {
  for (const [path, url] of Object.entries(finals)) {
    const [, unit, pose] = path.match(/sprites\/([^/]+)\/([^/]+)\.png$/)!;
    scene.load.image(`${unit}:${pose}`, url);
    available.add(`${unit}:${pose}`);
  }
  for (const [path, url] of Object.entries(placeholders)) {
    const unit = path.match(/placeholder\/([^/]+)\.png$/)![1];
    scene.load.image(`${unit}:placeholder`, url);
    available.add(`${unit}:placeholder`);
  }
}

/** Texture key for a unit pose: exact pose → idle → placeholder → generic token. */
export function spriteKey(unit: string, pose: Pose): string {
  for (const k of [`${unit}:${pose}`, `${unit}:idle`, `${unit}:placeholder`]) if (available.has(k)) return k;
  return "generic:idle";
}

/** True when the unit has a drawn death pose (otherwise the scene tips the idle sprite over). */
export const hasPose = (unit: string, pose: Pose) => available.has(`${unit}:${pose}`);

export function buildGenericTextures(scene: Phaser.Scene) {
  const g = scene.add.graphics();
  g.fillStyle(0x888899).fillRect(24, 20, 16, 30).fillStyle(0xd8c0a0).fillRect(26, 10, 12, 10);
  g.generateTexture("generic:idle", 64, 64);
  g.destroy();
}
