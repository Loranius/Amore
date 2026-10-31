#!/usr/bin/env python3
"""Аркуші курей і півня з PixelLab для гри «Дєвочка в городі» (ADR-0239).

Власник, 2026-10-12: «модельки курей коричневих і білих і одного півня …
замість тих курей-кругляшків, що дригаються з місця на місце». Складає PNG
32×32 з кадрів персонажів PixelLab: піксель аркуша — пів світового, як у
людей. (Зменшений удвічі аркуш 16×16 гра більше не має: власник 2026-10-31,
«повністю відмовляємось від 16×16».)

    python scripts/pixellab/build_birds.py spec.json birds.png

Рядки — птаха × напрям (вниз, ліворуч, праворуч, угору), птахи в порядку
`kinds`. Стовпці — стоїть, 4 кадри ходи, далі кадри дзьобання. Дзьобання є
лише збоку («ліворуч» — дзеркало «праворуч»), тож у рядках «вниз» і «угору»
ці клітинки порожні: птаха дзьобає профілем (`sim/birds.ts`). Порожні й
клітинки напрямів, яких птаха не має: півень ходить лише профілем (у
шаблонній ході «вниз» його хвіст перескакував з боку на бік щокроку, а
поворот «угору» PixelLab намалював збоку) і лише стоячи інколи дивиться на
глядача.

spec.json:
  {"cell": 40, "foot": [20, 35], "outline": "#0a0605",
   "kinds": [{"name": "white", "rotations": {"south": url, "east": url, "north": url},
              "walk": {"south": [4 url], "east": [...], "north": [...]},
              "peck": [url, ...], "outline": true,
              "clean": {"south": "feet", "north": "white"}}, ...]}

- `foot` — де в клітинці 32×32 стоять лапи (піксель під ними); кадри кожної
  птахи стають так, щоб лапи пози «стоїть, униз» були там, а середина
  полотна PixelLab — на `foot[0]`.
- `outline: true` — PixelLab намалював птаху без обвідки (біла курка,
  півень), а коричнева має чорну: обвідку додано, щоб усі три були однакові.
- `clean` — шаблон людської ходи малює під лапами білі «черевики»:
  `feet` — білі пікселі нижче тулуба стають кольором лап (біла курка);
  `white` — білих пікселів у птахи немає ніде, тож кожен стає кольором
  сусідів (коричнева курка, хода «угору»).

"""
import colorsys
import io
import json
import subprocess
import sys
from collections import Counter

from PIL import Image, ImageOps

ORDER = ['south', 'west', 'east', 'north']
WALK = 4


def fetch(url: str) -> Image.Image:
    """Кадр PixelLab; напівпрозоре (буває в кадрах v3) — або піксель, або ні."""
    data = subprocess.run(['curl', '-sSfL', url], check=True, capture_output=True).stdout
    img = Image.open(io.BytesIO(data)).convert('RGBA')
    img.putalpha(img.getchannel('A').point(lambda a: 255 if a >= 128 else 0))
    return img


def hex_rgb(color: str) -> tuple:
    return tuple(int(color[i:i + 2], 16) for i in (1, 3, 5))


def hsv(rgb: tuple) -> tuple:
    return colorsys.rgb_to_hsv(*(c / 255 for c in rgb[:3]))


def bottom_of(img: Image.Image) -> int:
    box = img.getchannel('A').getbbox()
    if not box:
        raise ValueError('порожній кадр')
    return box[3]


def opaque(img: Image.Image) -> int:
    return sum(1 for a in img.getchannel('A').tobytes() if a > 0)


def place(img: Image.Image, cell: int, dx: int, dy: int) -> Image.Image:
    """Кадр у клітинку `cell` зі зсувом; обрізати птаху не можна."""
    out = Image.new('RGBA', (cell, cell), (0, 0, 0, 0))
    out.paste(img, (dx, dy), img)
    if opaque(out) != opaque(img):
        raise ValueError(f'кадр {img.size} зі зсувом {dx},{dy} не вміщається в клітинку {cell}')
    return drop_crumbs(out)


def drop_crumbs(img: Image.Image) -> Image.Image:
    """Крихти біля дзьоба (v3 малює зерно й пил окремими цятками й
    рисками) — геть: лишається тільки найбільший острів пікселів, сама
    птаха. Окремими цятками крихти читаються смітом."""
    out = img.copy()
    px = out.load()
    w, h = out.size
    seen = set()
    islands = []
    for y in range(h):
        for x in range(w):
            if px[x, y][3] == 0 or (x, y) in seen:
                continue
            comp, stack = [], [(x, y)]
            seen.add((x, y))
            while stack:
                cx, cy = stack.pop()
                comp.append((cx, cy))
                for nx in (cx - 1, cx, cx + 1):
                    for ny in (cy - 1, cy, cy + 1):
                        if 0 <= nx < w and 0 <= ny < h and (nx, ny) not in seen and px[nx, ny][3] > 0:
                            seen.add((nx, ny))
                            stack.append((nx, ny))
            islands.append(comp)
    islands.sort(key=len)
    for comp in islands[:-1]:
        for c in comp:
            px[c] = (0, 0, 0, 0)
    return out


def clean_white(img: Image.Image) -> Image.Image:
    """Майже білі пікселі — у найчастіший не білий колір сусідів."""
    out = img.copy()
    px = out.load()
    w, h = out.size
    white = is_white
    for _ in range(4):
        todo = [(x, y) for y in range(h) for x in range(w) if white(px[x, y])]
        if not todo:
            return out
        for x, y in todo:
            near = Counter(px[x + dx, y + dy] for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))
                           if 0 <= x + dx < w and 0 <= y + dy < h and px[x + dx, y + dy][3] > 0 and not white(px[x + dx, y + dy]))
            if near:
                px[x, y] = near.most_common(1)[0][0]
    if any(white(px[x, y]) for y in range(h) for x in range(w)):
        raise ValueError('білі пікселі не вдалося прибрати')
    return out


def is_white(c: tuple) -> bool:
    _, s, v = hsv(c)
    return c[3] > 0 and s < 0.18 and v > 0.78


def clean_feet(img: Image.Image) -> Image.Image:
    """Білі «черевики» нижче тулуба — кольором лап.

    Лапи починаються з першого рядка під найширшим, де силует уже не
    суцільний (між лапами — прозоре)."""
    out = img.copy()
    px = out.load()
    w, h = out.size
    rows = [[x for x in range(w) if px[x, y][3] > 0] for y in range(h)]
    widest = max(range(h), key=lambda y: len(rows[y]))
    start = next((y for y in range(widest, h) if rows[y] and rows[y][-1] - rows[y][0] + 1 != len(rows[y])), None)
    if start is None:
        raise ValueError('лап не знайдено')
    legs = Counter(px[x, y] for y in range(start, h) for x in rows[y]
                   if 0.06 <= hsv(px[x, y])[0] <= 0.17 and hsv(px[x, y])[1] > 0.4)
    if not legs:
        raise ValueError('колір лап не знайдено')
    leg = legs.most_common(1)[0][0]
    for y in range(start, h):
        for x in rows[y]:
            if is_white(px[x, y]):
                px[x, y] = leg
    return out


def add_outline(img: Image.Image, color: tuple) -> Image.Image:
    """Обвідка в один піксель довкола силуету (4 сусіди), як у PixelLab."""
    out = img.copy()
    src = img.load()
    px = out.load()
    w, h = img.size
    for y in range(h):
        for x in range(w):
            if src[x, y][3] > 0:
                continue
            if any(0 <= x + dx < w and 0 <= y + dy < h and src[x + dx, y + dy][3] > 0 for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                px[x, y] = color + (255,)
    return out


def kind_frames(kind: dict, cell: int, foot: tuple) -> dict:
    """Напрям → [стоїть, хода × 4, дзьобання …] у клітинках `cell`."""
    rot = {d: fetch(u) for d, u in kind['rotations'].items()}
    walk = {d: [fetch(u) for u in us] for d, us in kind['walk'].items()}
    peck = [fetch(u) for u in kind.get('peck', [])]
    canvas = rot['south'].size
    for d, imgs in walk.items():
        if any(i.size != canvas for i in imgs) or len(imgs) != WALK:
            raise ValueError(f"{kind['name']}: хода {d} — {len(imgs)} кадрів на {[i.size for i in imgs]}")
    for d, how in kind.get('clean', {}).items():
        fix = {'white': clean_white, 'feet': clean_feet}[how]
        rot[d] = fix(rot[d])
        walk[d] = [fix(i) for i in walk.get(d, [])]
    dx = foot[0] - canvas[0] // 2
    dy = foot[1] - bottom_of(rot['south'])
    frames = {d: [place(rot[d], cell, dx, dy)] + [place(i, cell, dx, dy) for i in walk.get(d, [])] for d in rot}
    if peck:
        # Дзьобання — на полотні v3 (іншого розміру); його перший кадр — сам
        # поворот «праворуч», тож решту кадрів ставимо так, щоб він ліг на поворот.
        eb = rot['east'].getchannel('A').getbbox()
        pb = peck[0].getchannel('A').getbbox()
        pdx = dx + eb[0] - pb[0]
        pdy = dy + eb[1] - pb[1]
        frames['east'] += [place(i, cell, pdx, pdy) for i in peck[1:]]
    frames['west'] = [ImageOps.mirror(i) for i in frames['east']]
    return frames


def main() -> None:
    spec = json.load(open(sys.argv[1]))
    cell = spec['cell']
    foot = tuple(spec['foot'])
    color = hex_rgb(spec['outline'])
    kinds = spec['kinds']
    built = [kind_frames(k, cell, foot) for k in kinds]
    pecks = {len(f['east']) - 1 - WALK for f in built}
    if len(pecks) != 1:
        raise ValueError(f'у птахів різна кількість кадрів дзьобання: {pecks}')
    cols = 1 + WALK + pecks.pop()
    hd = Image.new('RGBA', (cell * cols, cell * 4 * len(kinds)), (0, 0, 0, 0))
    for k, (kind, frames) in enumerate(zip(kinds, built)):
        for r, d in enumerate(ORDER):
            row = (k * 4 + r)
            for c, img in enumerate(frames.get(d, [])):
                drawn = add_outline(img, color) if kind.get('outline') else img
                hd.paste(drawn, (c * cell, row * cell))
    hd.save(sys.argv[2])
    print(json.dumps({'cell': cell, 'cols': cols, 'walk': WALK, 'peck': cols - 1 - WALK, 'footX': foot[0], 'footY': foot[1], 'kinds': [k['name'] for k in kinds]}))


if __name__ == '__main__':
    main()
