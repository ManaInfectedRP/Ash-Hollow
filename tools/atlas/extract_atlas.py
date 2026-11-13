"""Extract chosen sprites from a Pixel Art Atlas parquet shard into public/assets/atlas/.

Usage:
  python -I tools/atlas/extract_atlas.py <path/to/train-000.parquet> [more shards...]

Reads tools/atlas/picks.json (name -> row_id), writes <group>/<name>.png (16x16 RGBA)
and manifest.json with subject/caption/row_id for attribution and lookup.
Dataset: https://huggingface.co/datasets/Angais/pixel-art-atlas-1.4m (CC0 1.0)
"""
import io, json, os, sys
import pyarrow.parquet as pq
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
picks = json.load(open(os.path.join(ROOT, 'tools/atlas/picks.json'), encoding='utf-8'))
want = {}
for group in ('items', 'props'):
    for name, rid in picks[group].items():
        want[rid] = (group, name)

out_dir = os.path.join(ROOT, 'public/assets/atlas')
manifest = {}
for shard in sys.argv[1:]:
    t = pq.read_table(shard, columns=['row_id', 'subject', 'caption', 'image'])
    for rid, subj, cap, im in zip(*(t.column(c).to_pylist() for c in ('row_id', 'subject', 'caption', 'image'))):
        if rid not in want or rid in manifest:
            continue
        group, name = want[rid]
        os.makedirs(os.path.join(out_dir, group), exist_ok=True)
        img = Image.open(io.BytesIO(im['bytes'])).convert('RGBA')
        img.save(os.path.join(out_dir, group, f'{name}.png'))
        manifest[rid] = {'group': group, 'name': name, 'row_id': rid, 'subject': subj, 'caption': cap}

missing = [f'{g}/{n} ({r})' for r, (g, n) in want.items() if r not in manifest]
by_name = {f"{m['group']}/{m['name']}": m for m in manifest.values()}
json.dump({'source': 'Angais/pixel-art-atlas-1.4m', 'license': 'CC0-1.0', 'sprites': by_name},
          open(os.path.join(out_dir, 'manifest.json'), 'w', encoding='utf-8'), indent=2)
print(f'extracted {len(manifest)} sprites; missing: {missing or "none"}')
