"""Render a contact sheet: one row per subject, N samples each, upscaled, labelled with row_id."""
import sys, io
import pyarrow.parquet as pq
from PIL import Image, ImageDraw

path, out, subjects = sys.argv[1], sys.argv[2], sys.argv[3].split('|')
N, S = 12, 4  # samples per row, scale
t = pq.read_table(path, columns=['subject', 'row_id', 'image'])
subs = t.column('subject').to_pylist()
ids = t.column('row_id').to_pylist()
imgs = t.column('image').to_pylist()
by = {}
for s, i, im in zip(subs, ids, imgs):
    if s in subjects and len(by.setdefault(s, [])) < N:
        by[s].append((i, im))
cell = 16 * S + 8
lab = 150
W, H = lab + N * cell, len(subjects) * (cell + 12)
sheet = Image.new('RGBA', (W, H), (40, 36, 48, 255))
d = ImageDraw.Draw(sheet)
for r, s in enumerate(subjects):
    y = r * (cell + 12)
    d.text((4, y + 24), s[:22], fill=(230, 220, 200, 255))
    for c, (rid, im) in enumerate(by.get(s, [])):
        sp = Image.open(io.BytesIO(im['bytes'])).convert('RGBA').resize((16 * S, 16 * S), Image.NEAREST)
        x = lab + c * cell
        sheet.alpha_composite(sp, (x, y + 4))
        d.text((x, y + 16 * S + 4), str(rid), fill=(160, 150, 140, 255))
sheet.save(out)
print('saved', out, W, H, {s: len(v) for s, v in by.items()})
