#!/usr/bin/env python3
"""Аркуш персонажа з PixelLab для гри «Дєвочка в городі» (ADR-0239, 32×32).

Бере JSON-опис кадрів (посилання PixelLab на повороти й кадри ходи) і
складає один PNG: рядки — напрями (вниз, ліворуч, праворуч, угору),
стовпці — стоїть, далі кадри ходи. «Ліворуч» — дзеркало «праворуч», якщо
окремих кадрів немає; без ходи для напрямку — стоїть у всіх кадрах.
Друкує точку опори (між стопами) для `render/peopleHd.ts`.

    python scripts/pixellab/build_sheet.py spec.json out.png

spec.json: {"cell": 92, "rotations": {"south": url, ...},
            "walk": {"south": [url, ...], "east": [...], ...}}
"""
import io
import json
import subprocess
import sys

from PIL import Image, ImageOps


def fetch(url: str) -> Image.Image:
    data = subprocess.run(['curl', '-sSfL', url], check=True, capture_output=True).stdout
    return Image.open(io.BytesIO(data)).convert('RGBA')


def main() -> None:
    spec = json.load(open(sys.argv[1]))
    out = sys.argv[2]
    cell = spec['cell']
    rot = {k: fetch(v) for k, v in spec['rotations'].items()}
    walk = {k: [fetch(u) for u in v] for k, v in spec.get('walk', {}).items()}
    frames = max([len(v) for v in walk.values()] + [0])
    if 'west' not in walk and 'east' in walk:
        walk['west'] = [ImageOps.mirror(f) for f in walk['east']]
    if 'west' not in rot and 'east' in rot:
        rot['west'] = ImageOps.mirror(rot['east'])
    order = ['south', 'west', 'east', 'north']
    sheet = Image.new('RGBA', (cell * (1 + frames), cell * 4), (0, 0, 0, 0))
    for r, d in enumerate(order):
        sheet.paste(rot[d], (0, r * cell))
        seq = walk.get(d) or [rot[d]] * frames
        for c, f in enumerate(seq):
            sheet.paste(f, ((c + 1) * cell, r * cell))
    sheet.save(out)
    # Опора: найнижчий непрозорий рядок і середина силуету в «стоїть, униз».
    a = rot['south'].getchannel('A')
    w, h = a.size
    px = a.load()
    rows = [y for y in range(h) if any(px[x, y] > 0 for x in range(w))]
    cols = [x for x in range(w) if any(px[x, y] > 0 for y in range(h))]
    print(json.dumps({'cell': cell, 'frames': frames, 'footX': (cols[0] + cols[-1] + 1) / 2, 'footY': rows[-1] + 1, 'top': rows[0], 'height': rows[-1] + 1 - rows[0]}))


if __name__ == '__main__':
    main()
