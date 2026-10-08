#!/usr/bin/env python3
"""Extract embedded illustrations from the legacy workshop HTML into docs/art/.

Usage: python3 tools/extract_art.py [path/to/workshop.html]
Output:
  docs/art/<original asset path>        keyed assets (species, combatants, backgrounds)
  docs/art/careers/<id>-<name>.webp     career art stored inline on career records
  docs/art/index.tsv                    file list with pixel sizes
"""
import base64, glob, os, re, sys

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
src = sys.argv[1] if len(sys.argv) > 1 else glob.glob(os.path.join(root, "docs", "*.html"))[0]
out = os.path.join(root, "docs", "art")
raw = open(src, encoding="utf-8").read()
# Swap each base64 blob for a short token so record lookups stay within a small text.
blobs = []
def stash(m):
    blobs.append(m.group(1))
    return f"BLOB{len(blobs) - 1}"
html = re.sub(r"data:[a-z/+\-]+;base64,([A-Za-z0-9+/=]+)", stash, raw)
B64 = r"BLOB(\d+)"
slug = lambda s: re.sub(r"[^A-Za-z0-9]+", "-", s).strip("-").lower()
written = []
written_blob = {}

def save(rel, b64):
    path = os.path.join(out, rel)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "wb") as f:
        f.write(base64.b64decode(blobs[int(b64)]))
    written.append(rel)

for m in re.finditer(r"\"(art/[^\"]+\.(?:webp|png|jpe?g))\"\s*:\s*\"" + B64, html):
    save(m.group(1)[len("art/"):], m.group(2))

career = re.compile(r"\{\"id\": \"([^\"]+)\", \"name\": \"([^\"]+)\"")
for m in re.finditer(r"\"art\"\s*:\s*\"" + B64, html):
    owners = list(career.finditer(html, max(0, m.start() - 200000), m.start()))
    cid, name = (owners[-1].group(1), owners[-1].group(2)) if owners else ("unknown", str(m.start()))
    rel = f"careers/{slug(cid)}.webp" if slug(cid).endswith(slug(name)) else f"careers/{slug(cid)}-{slug(name)}.webp"
    if rel in written and blobs[int(m.group(1))] != blobs[int(written_blob[rel])]:
        rel = rel.replace(".webp", f"-{m.group(1)}.webp")
    written_blob[rel] = m.group(1)
    save(rel, m.group(1))

try:
    from PIL import Image
    rows = [f"{r}\t{'x'.join(map(str, Image.open(os.path.join(out, r)).size))}" for r in sorted(set(written))]
except ImportError:
    rows = sorted(set(written))
with open(os.path.join(out, "index.tsv"), "w") as f:
    f.write("\n".join(rows) + "\n")
print(f"{len(set(written))} files -> {out}")
