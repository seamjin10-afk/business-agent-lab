#!/usr/bin/env python3
"""Turn a GPT-made "pixel-art looking" image into a true low-res sprite.

GPT images are ~1024px with soft, uneven "pixels". This tool:
  1. removes a flat background (or keeps existing transparency),
  2. crops to the character,
  3. scales it so the character is exactly --height pixels tall,
  4. reduces it to --colors colours without dithering,
  5. pastes it bottom-centre (feet on the baseline) into a --size x --size canvas.

Single file:  python3 tools/pixelize.py raw.png out.png --size 64 --height 56
Whole folder: python3 tools/pixelize.py --batch art_src/<unit> game/src/assets/sprites/<unit> --height 56
Add --preview to also write <out>.preview.png enlarged 8x for checking.
"""
import argparse, os, sys
import numpy as np
from PIL import Image, ImageDraw

BASELINE_MARGIN = 2  # empty rows under the feet


def remove_background(im: Image.Image, tol: int) -> Image.Image:
    im = im.convert("RGBA")
    a = np.asarray(im)[..., 3]
    border = np.concatenate([a[0], a[-1], a[:, 0], a[:, -1]])
    if (border < 250).mean() > 0.5:
        return im  # already transparent
    w, h = im.size
    corner = np.asarray(im.getpixel((0, 0))[:3], int)
    r, g, b = corner
    if (r > 200 and b > 200 and g < 80) or (g > 200 and r < 80 and b < 80):
        # Chroma key (magenta / green screen): safe to clear every matching pixel,
        # including gaps between legs or arms that don't touch the border.
        px = np.asarray(im).copy()
        dist = np.abs(px[..., :3].astype(int) - corner).max(axis=2)
        px[dist <= tol + 40, 3] = 0
        return Image.fromarray(px)
    # Other backgrounds (white, grey): only clear what touches the border, so a
    # white beard or robe is kept.
    for xy in [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)]:
        if im.getpixel(xy)[3] != 0:
            ImageDraw.floodfill(im, xy, (0, 0, 0, 0), thresh=tol)
    return im


def pixelize(src: Image.Image, size: int, height: int, colors: int, tol: int) -> Image.Image:
    im = remove_background(src, tol)
    alpha = np.asarray(im)[..., 3] > 128
    ys, xs = np.nonzero(alpha)
    if not len(ys):
        raise ValueError("no character found (background removal took everything)")
    im = im.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))
    scale = height / im.height
    w = max(1, round(im.width * scale))
    if w > size:  # very wide pose: fit width instead
        scale = size / im.width
        w = size
    h = max(1, round(im.height * scale))
    small = im.resize((w, h), Image.BOX)

    rgba = np.asarray(small).copy()
    solid = rgba[..., 3] > 128
    rgb = Image.fromarray(rgba[..., :3])
    pal = rgb.quantize(colors=colors, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    out = np.asarray(pal.convert("RGB"))
    sprite = np.zeros((h, w, 4), np.uint8)
    sprite[..., :3] = out
    sprite[..., 3] = np.where(solid, 255, 0)

    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    canvas.paste(Image.fromarray(sprite), ((size - w) // 2, size - BASELINE_MARGIN - h))
    return canvas


def run(src_path, dst_path, a):
    out = pixelize(Image.open(src_path), a.size, a.height, a.colors, a.bg_tol)
    os.makedirs(os.path.dirname(dst_path) or ".", exist_ok=True)
    out.save(dst_path)
    if a.preview:
        out.resize((a.size * 8, a.size * 8), Image.NEAREST).save(dst_path[:-4] + ".preview.png")
    print(f"{src_path} -> {dst_path}")


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("src")
    p.add_argument("dst")
    p.add_argument("--batch", action="store_true", help="src/dst are folders; keeps sub-folders")
    p.add_argument("--size", type=int, default=64, help="canvas size (64 normal, 128 large)")
    p.add_argument("--height", type=int, default=56, help="character height in pixels")
    p.add_argument("--colors", type=int, default=24)
    p.add_argument("--bg-tol", type=int, default=40, help="background colour tolerance (0-255)")
    p.add_argument("--preview", action="store_true")
    a = p.parse_args()
    if not a.batch:
        return run(a.src, a.dst, a)
    exts = (".png", ".webp", ".jpg", ".jpeg")
    for root, _, files in os.walk(a.src):
        for f in sorted(files):
            if f.lower().endswith(exts) and ".preview." not in f:
                rel = os.path.relpath(os.path.join(root, f), a.src)
                run(os.path.join(root, f), os.path.join(a.dst, os.path.splitext(rel)[0] + ".png"), a)


if __name__ == "__main__":
    sys.exit(main())
