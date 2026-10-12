#!/usr/bin/env python3
"""Аркуші курей і півня з PixelLab для гри «Дєвочка в городі» (ADR-0239).

Власник, 2026-10-12: «модельки курей коричневих і білих і одного півня …
замість тих курей-кругляшків, що дригаються з місця на місце». Складає два
PNG з кадрів персонажів PixelLab: 32×32 (піксель аркуша — пів світового,
як у людей) і 16×16 (піксель аркуша — світовий; той самий малюнок, зменшений
удвічі).

    python scripts/pixellab/build_birds.py spec.json birds-hd.png birds.png

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

16×16: зовнішня обвідка знімається, кожен квадрат 2×2 стає одним пікселем
(найчастіший колір; за рівності — насиченіший, щоб гребінь, дзьоб і лапи не
зникали), а обвідка малюється наново, як `outline` у `render/pixel.ts`:
темна з тіні, а згори-зліва — затемнений сусідній колір.
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
PIXEL_OUTLINE = (0x1c, 0x14, 0x19)


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
    птаха. Зменшені вдвічі, крихти читалися б смітом."""
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


def strip_outline(img: Image.Image) -> Image.Image:
    """Знімає темну обвідку: темні пікселі на краю силуету."""
    out = img.copy()
    src = img.load()
    px = out.load()
    w, h = img.size
    for y in range(h):
        for x in range(w):
            c = src[x, y]
            if c[3] == 0 or hsv(c)[2] > 0.16:
                continue
            if any(not (0 <= x + dx < w and 0 <= y + dy < h) or src[x + dx, y + dy][3] == 0 for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                px[x, y] = (0, 0, 0, 0)
    return out


def eyes(img: Image.Image) -> set:
    """Очі: піксель у голові (верхні 40% силуету), набагато темніший за всіх
    чотирьох сусідів. Нижче — темні риски на крилах коричневої курки, які
    зменшеними читалися б плямами-очима на тулубі."""
    w, h = img.size
    src = img.load()
    box = img.getchannel('A').getbbox()
    if not box:
        return set()
    head = box[1] + (box[3] - box[1]) * 0.4
    out = set()
    for y in range(max(1, box[1]), min(h - 1, int(head) + 1)):
        for x in range(1, w - 1):
            c = src[x, y]
            near = [src[x + dx, y + dy] for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))]
            if c[3] and all(n[3] for n in near) and hsv(c)[2] + 0.3 < min(hsv(n)[2] for n in near):
                out.add((x, y))
    return out


def halve(img: Image.Image, keep_eyes: bool) -> Image.Image:
    """Квадрат 2×2 — один піксель: найчастіший колір, за рівності — насиченіший.

    Профілем око (один темний піксель на світлому) у квадраті завжди
    перемагає — інакше в 16×16 птахи сліпі. Анфас — ні: два ока там на
    три пікселі одне від одного, і вдвічі менші вони злипаються в темну
    риску, що читається ротом."""
    w, h = img.size
    src = img.load()
    eye = eyes(img) if keep_eyes else set()
    out = Image.new('RGBA', (w // 2, h // 2), (0, 0, 0, 0))
    px = out.load()
    for y in range(h // 2):
        for x in range(w // 2):
            cells = [(2 * x + i, 2 * y + j) for j in (0, 1) for i in (0, 1)]
            solid = [src[c] for c in cells if src[c][3] > 0]
            if len(solid) < 2:
                continue
            seen = [src[c] for c in cells if c in eye]
            if seen:
                px[x, y] = seen[0]
                continue
            counts = Counter(solid)
            px[x, y] = max(counts, key=lambda c: (counts[c], hsv(c)[1], -hsv(c)[2]))
    return out


def pixel_outline(img: Image.Image) -> Image.Image:
    """Обвідка 16×16 — як `outline` у `render/pixel.ts`."""
    w, h = img.size
    out = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    out.paste(img, (0, 0))
    src = img.load()
    px = out.load()

    def solid(x: int, y: int) -> bool:
        return 0 <= x < w and 0 <= y < h and src[x, y][3] > 0

    for y in range(h):
        for x in range(w):
            if solid(x, y):
                continue
            below, right, left, above = solid(x, y + 1), solid(x + 1, y), solid(x - 1, y), solid(x, y - 1)
            if not (below or right or left or above):
                continue
            rgb = PIXEL_OUTLINE
            if (below or right) and not left and not above:
                hh, ss, vv = hsv(src[x, y + 1] if below else src[x + 1, y])
                rgb = tuple(round(c * 255) for c in colorsys.hsv_to_rgb(hh, min(1.0, ss * 1.15 + 0.08), vv * 0.5))
            px[x, y] = rgb + (255,)
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
    small = Image.new('RGBA', (cell // 2 * cols, cell // 2 * 4 * len(kinds)), (0, 0, 0, 0))
    for k, (kind, frames) in enumerate(zip(kinds, built)):
        for r, d in enumerate(ORDER):
            row = (k * 4 + r)
            for c, img in enumerate(frames.get(d, [])):
                drawn = add_outline(img, color) if kind.get('outline') else img
                hd.paste(drawn, (c * cell, row * cell))
                bare = img if kind.get('outline') else strip_outline(img)
                small.paste(pixel_outline(halve(bare, keep_eyes=d != 'south')), (c * cell // 2, row * cell // 2))
    hd.save(sys.argv[2])
    small.save(sys.argv[3])
    print(json.dumps({'cell': cell, 'cols': cols, 'walk': WALK, 'peck': cols - 1 - WALK, 'footX': foot[0], 'footY': foot[1], 'kinds': [k['name'] for k in kinds]}))


if __name__ == '__main__':
    main()
