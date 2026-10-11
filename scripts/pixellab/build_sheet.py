#!/usr/bin/env python3
"""Аркуш персонажа з PixelLab для гри «Дєвочка в городі» (ADR-0239, 32×32).

Бере JSON-опис кадрів (посилання PixelLab на повороти й кадри ходи) і
складає один PNG: рядки — напрями (вниз, ліворуч, праворуч, угору),
стовпці — стоїть, далі кадри ходи. «Ліворуч» — дзеркало «праворуч», якщо
окремих кадрів немає; без ходи для напрямку — стоїть у всіх кадрах.
Друкує точку опори (між стопами) для `render/peopleHd.ts`.

    python scripts/pixellab/build_sheet.py spec.json out.png

spec.json: {"cell": 92, "rotations": {"south": url, ...},
            "walk": {"south": [url, ...], "east": [...], ...},
            "eyes": {"band": [0.17, 0.31], "color": "#5a3a26"},
            "pick": {"south": [0, 1, 2, 1]}}

"pick" необов'язкове: які кадри ходи брати для напряму. PixelLab іноді
малює кадр ходи не тим боком — у підлітка двічі останній кадр «униз»
вийшов спиною. Тоді цикл 0-1-2-1 (середній крок двічі) — звичний для
піксельних ігор і не блимає потилицею.

Кадри ходи бувають на більшому полотні, ніж повороти (`skeleton-v3`
кладе людину на 96×96 замість 80×80). Такі кадри стають у клітинку за
центром полотна, а по висоті — так, щоб стопи першого кадру стояли там
само, де в позі «стоїть» того напряму; погойдування ходи лишається.

"eyes" необов'язкове: PixelLab малює блакитні очі навіть тоді, коли просиш
карі. У смузі обличчя (частки висоти силуету кадру, відлік від маківки)
кожен синій піксель стає кольору `color`, трохи темнішим (карі темніші за
блакитні), а співвідношення світла лишається — тінь і відблиск ока на місці.
"""
import colorsys
import io
import json
import subprocess
import sys

from PIL import Image, ImageOps


def fetch(url: str) -> Image.Image:
    data = subprocess.run(['curl', '-sSfL', url], check=True, capture_output=True).stdout
    return Image.open(io.BytesIO(data)).convert('RGBA')


def recolor_eyes(img: Image.Image, band: list, color: str) -> Image.Image:
    """Сині пікселі в смузі обличчя — у барву `color`, на чверть темніше."""
    out = img.copy()
    px = out.load()
    w, h = out.size
    rows = [y for y in range(h) if any(px[x, y][3] > 0 for x in range(w))]
    if not rows:
        return out
    top, bottom = rows[0], rows[-1]
    th, ts, _ = colorsys.rgb_to_hsv(*(int(color[i:i + 2], 16) / 255 for i in (1, 3, 5)))
    for y in range(h):
        rel = (y - top) / max(1, bottom - top)
        if not band[0] <= rel <= band[1]:
            continue
        for x in range(w):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            hh, ss, vv = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
            if 0.5 < hh < 0.75 and ss > 0.15:
                nr, ng, nb = colorsys.hsv_to_rgb(th, min(1.0, ts * max(ss, 0.3) / 0.5), vv * 0.72)
                px[x, y] = (round(nr * 255), round(ng * 255), round(nb * 255), a)
    return out


def bottom_of(img: Image.Image) -> int:
    """Нижній непрозорий рядок — стопи."""
    box = img.getchannel('A').getbbox()
    if not box:
        raise ValueError('порожній кадр')
    return box[3]


def fit(frames: list, idle: Image.Image, cell: int) -> list:
    """Кадри на полотні іншого розміру — у клітинку `cell`, стопи до пози «стоїть»."""
    if all(f.size == (cell, cell) for f in frames):
        return frames
    dy = bottom_of(frames[0]) - bottom_of(idle)
    out = []
    for f in frames:
        dx = (f.width - cell) // 2
        fitted = Image.new('RGBA', (cell, cell), (0, 0, 0, 0))
        fitted.paste(f, (-dx, -dy))
        out.append(fitted)
    return out


def main() -> None:
    spec = json.load(open(sys.argv[1]))
    out = sys.argv[2]
    cell = spec['cell']
    rot = {k: fetch(v) for k, v in spec['rotations'].items()}
    walk = {k: [fetch(u) for u in v] for k, v in spec.get('walk', {}).items()}
    walk = {d: fit(v, rot[d], cell) for d, v in walk.items()}
    for d, order in spec.get('pick', {}).items():
        walk[d] = [walk[d][i] for i in order]
    eyes = spec.get('eyes')
    if eyes:
        # Зі спини очей не видно — «угору» не чіпаємо.
        rot = {k: v if k == 'north' else recolor_eyes(v, eyes['band'], eyes['color']) for k, v in rot.items()}
        walk = {k: v if k == 'north' else [recolor_eyes(f, eyes['band'], eyes['color']) for f in v] for k, v in walk.items()}
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
