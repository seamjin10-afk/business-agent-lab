#!/usr/bin/env python3
"""Pull cut-out illustrations (image + soft mask) out of a rulebook PDF.

Usage: python3 tools/extract_pdf_art.py book.pdf out_dir/
Keeps images at least 350px on the short side that carry a transparency mask,
skips full-page backgrounds and the blank paper-texture panels, crops to the
visible figure and writes p<page>-<image no>.webp. Needs poppler's pdfimages.
The curated set in docs/art/pdf/ was then picked by eye from this output.
"""
import glob, os, shutil, subprocess, sys
import numpy as np
from PIL import Image

pdf, out = sys.argv[1], sys.argv[2]
rows = [l.split() for l in subprocess.run(["pdfimages", "-list", pdf], capture_output=True, text=True).stdout.splitlines()[2:]]
want, seen = {}, set()
for i, r in enumerate(rows):
    if r[2] != "image":
        continue
    page, num, w, h, obj = int(r[0]), int(r[1]), int(r[3]), int(r[4]), r[10]
    nxt = rows[i + 1] if i + 1 < len(rows) else None
    if not (nxt and nxt[2] == "smask" and nxt[10] == obj):
        continue
    if min(w, h) < 350 or (w > 1500 and h > 1900) or obj in seen:
        continue
    seen.add(obj)
    want[num] = page

raw = os.path.join(out, "_raw")
shutil.rmtree(raw, ignore_errors=True)
os.makedirs(raw)
subprocess.run(["pdfimages", "-all", pdf, f"{raw}/x"], capture_output=True)  # one pass, native formats
files = {int(os.path.basename(f)[2:].split(".")[0]): f for f in glob.glob(f"{raw}/x-*")}

n = 0
for num, page in sorted(want.items()):
    if num not in files or num + 1 not in files:
        continue
    im = Image.open(files[num]).convert("RGB")
    mask = Image.open(files[num + 1]).convert("L")
    im.putalpha(mask if mask.size == im.size else mask.resize(im.size))
    box = im.getchannel("A").point(lambda v: 255 if v > 20 else 0).getbbox()
    if not box:
        continue
    im = im.crop(box)
    if min(im.size) < 250:
        continue
    a = np.asarray(im.resize((96, 96))).astype(float)
    rgb = a[..., :3][a[..., 3] > 128]
    if len(rgb) < 200 or ((rgb.max(1) > 175) & (np.ptp(rgb, 1) < 45)).mean() > 0.55:
        continue  # blank parchment panel
    im.save(os.path.join(out, f"p{page:03d}-{num:04d}.webp"), quality=88)
    n += 1
shutil.rmtree(raw, ignore_errors=True)
print(f"{n} illustrations -> {out}")
