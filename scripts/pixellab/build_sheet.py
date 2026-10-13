#!/usr/bin/env python3
"""Аркуш персонажа з PixelLab для гри «Дєвочка в городі» (ADR-0239, 32×32).

Бере JSON-опис кадрів (посилання PixelLab на повороти й кадри ходи) і
складає один PNG: рядки — напрями (вниз, ліворуч, праворуч, угору),
стовпці — стоїть, далі кадри ходи. «Ліворуч» — дзеркало «праворуч», якщо
окремих кадрів немає; без ходи для напрямку — стоїть у всіх кадрах.
Друкує точку опори (між стопами) для `render/peopleHd.ts`.

    python scripts/pixellab/build_sheet.py spec.json out.png

Смуга (`"strip"`): один ряд кадрів на полотні людини — падіння й підйом
Лєни «праворуч» (`render/fall.ts`); «ліворуч» — дзеркало при малюванні.
{"cell": 92, "rotation": url повороту «праворуч», "strip": [url, ...],
 "air": [3, 4, 5], "stand_end": true, "eyes": {"color": "#5a3a26"}} —
кадри на землі стають на лінію стоп (`ground`), очі виправляються в межах
голови (`fix_strip_eyes`), бо Лєна тут і лежить, і сидить.

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

"face" необов'язкове: очі, перемальовані вручну за шаблоном. PixelLab
малює дрібні очі по-різному в кожному кадрі — у підлітка відблиск стрибав,
то зникав, під очима були темні риски, а збоку око розсипалось на два білі
пікселі. Для кожного напряму: `erase` — прямокутники [x0, y0, x1, y1]
(включно), де все, що не шкіра, стає кольору `skin`; `eyes` — шаблони
[x, y, "left" | "right" | "profile"]. `y` відміряні від маківки кадру,
тож око йде за головою, коли та підстрибує в ході. Кольори: `lid` —
повіко й зіниця, `white` — біле ока, `iris` — райдужка.

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


# Шаблони ока, як у малої й дорослої: зверху темне повіко, з зовнішнього
# боку — біле, з боку носа — карий зіниця. L — повіко й зіниця, W — біле,
# I — райдужка. «profile» дивиться праворуч; ліворуч — дзеркало аркуша.
EYE_STAMPS = {
    'left': ['LLL', 'WIL', 'WII'],
    'right': ['LLL', 'LIW', 'IIW'],
    'profile': ['LL', 'WL', 'WI'],
}


def hex_rgb(color: str) -> tuple:
    return tuple(int(color[i:i + 2], 16) for i in (1, 3, 5))


def is_skin(r: int, g: int, b: int) -> bool:
    h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
    return h <= 0.1 and 0.15 <= s <= 0.5 and v >= 0.75


def paint_face(img: Image.Image, face: dict, direction: str) -> Image.Image:
    """Стирає старі очі до кольору шкіри й ставить нові з шаблону."""
    plan = face.get(direction)
    if not plan:
        return img
    out = img.copy()
    px = out.load()
    box = out.getchannel('A').getbbox()
    if not box:
        raise ValueError('порожній кадр')
    top = box[1]
    skin = hex_rgb(face['skin']) + (255,)
    for x0, y0, x1, y1 in plan.get('erase', []):
        for y in range(top + y0, top + y1 + 1):
            for x in range(x0, x1 + 1):
                r, g, b, a = px[x, y]
                if a and not is_skin(r, g, b):
                    px[x, y] = skin
    colors = {'L': hex_rgb(face['lid']), 'W': hex_rgb(face['white']), 'I': hex_rgb(face['iris'])}
    for x, y, kind in plan.get('eyes', []):
        for dy, row in enumerate(EYE_STAMPS[kind]):
            for dx, key in enumerate(row):
                px[x + dx, top + y + dy] = colors[key] + (255,)
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


def head_box(img: Image.Image, hair: set) -> tuple:
    """Межі голови в кадрі: пікселі точно тих кольорів волосся, що й на
    повороті «праворуч» (верх силуету), з полем у 2 пікселі."""
    px = img.load()
    w, h = img.size
    pts = [(x, y) for y in range(h) for x in range(w) if px[x, y][3] and px[x, y][:3] in hair]
    if not pts:
        raise ValueError('у кадрі немає волосся — голову не знайдено')
    return (min(x for x, _ in pts) - 2, min(y for _, y in pts) - 2, max(x for x, _ in pts) + 2, max(y for _, y in pts) + 2)


def fix_strip_eyes(img: Image.Image, hair: set, color: str) -> Image.Image:
    """Очі в кадрі, де Лєна падає чи лежить (смуга висоти тут не діє).

    Око — острівець синюватих пікселів до 6 штук у межах голови
    (`head_box`), довкола якого — обличчя: щонайменше 8 пікселів шкіри на
    відстані до 3 (саму райдужку від шкіри відділяє біле ока й повіко).
    Так не чіпаються ні блакитна сукня дорослої, ні джинси й комір
    підлітка, ні відблиски на шкарпетках: усе це або велике, або далеко
    від волосся, або біля руки, а не обличчя."""
    out = img.copy()
    px = out.load()
    w, h = out.size
    box = head_box(img, hair)

    def bluish(c: tuple) -> bool:
        hh, ss, vv = colorsys.rgb_to_hsv(*(v / 255 for v in c[:3]))
        return c[3] > 0 and 0.5 < hh < 0.75 and ss > 0.08 and vv > 0.3

    seen = set()
    th, ts, _ = colorsys.rgb_to_hsv(*(int(color[i:i + 2], 16) / 255 for i in (1, 3, 5)))
    for y in range(h):
        for x in range(w):
            if (x, y) in seen or not bluish(px[x, y]):
                continue
            comp, stack = [], [(x, y)]
            seen.add((x, y))
            while stack:
                a, b = stack.pop()
                comp.append((a, b))
                for dx in (-1, 0, 1):
                    for dy in (-1, 0, 1):
                        n = (a + dx, b + dy)
                        if 0 <= n[0] < w and 0 <= n[1] < h and n not in seen and bluish(px[n]):
                            seen.add(n)
                            stack.append(n)
            inside = all(box[0] <= a <= box[2] and box[1] <= b <= box[3] for a, b in comp)
            face = {(a + dx, b + dy) for a, b in comp for dx in range(-3, 4) for dy in range(-3, 4)
                    if 0 <= a + dx < w and 0 <= b + dy < h and px[a + dx, b + dy][3] and is_skin(*px[a + dx, b + dy][:3])}
            if len(comp) > 6 or not inside or len(face) < 8:
                continue
            for c in comp:
                r, g, b, a = px[c]
                _, ss, vv = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
                nr, ng, nb = colorsys.hsv_to_rgb(th, min(1.0, ts * max(ss, 0.3) / 0.5), vv * 0.72)
                px[c] = (round(nr * 255), round(ng * 255), round(nb * 255), a)
    return out


def hair_palette(rot: Image.Image) -> set:
    """Кольори волосся: каштанові пікселі верхніх 15% силуету повороту."""
    px = rot.load()
    w, h = rot.size
    box = rot.getchannel('A').getbbox()
    top = box[1] + (box[3] - box[1]) * 0.15
    out = set()
    for y in range(box[1], int(top) + 1):
        for x in range(w):
            r, g, b, a = px[x, y]
            hh, ss, vv = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
            if a and 0.02 <= hh <= 0.12 and ss >= 0.25 and vv <= 0.85:
                out.add((r, g, b))
    if not out:
        raise ValueError('на повороті немає волосся')
    return out


def shift(img: Image.Image, dy: int) -> Image.Image:
    """Кадр, зсунутий на `dy` пікселів униз; обрізати не можна."""
    out = Image.new('RGBA', img.size, (0, 0, 0, 0))
    out.paste(img, (0, dy))
    before = sum(1 for a in img.getchannel('A').tobytes() if a)
    after = sum(1 for a in out.getchannel('A').tobytes() if a)
    if before != after:
        raise ValueError(f'зсув на {dy} обрізав кадр')
    return out


def ground(frames: list, rot: Image.Image, air: list) -> list:
    """Кадри на землі — низом силуету на лінію стоп повороту.

    Шаблони PixelLab малюють падіння й підйом кожен зі своєю лінією землі:
    підйом — на 4–10 пікселів вище за стопи на аркуші ходи, а доросла Лєна
    лежала на 9 пікселів вище, ніж стояла. Кожен кадр, де Лєна торкається
    землі (стопами, спиною чи сідницями), опускається на лінію стоп; кадри
    в повітрі (`air`) — на проміжне між сусідніми кадрами на землі, тож
    падіння лишається плавним."""
    line = bottom_of(rot)
    dys = [None if i in air else line - bottom_of(f) for i, f in enumerate(frames)]
    for i, dy in enumerate(dys):
        if dy is not None:
            continue
        a = max(j for j in range(i) if dys[j] is not None)
        b = min(j for j in range(i + 1, len(dys)) if dys[j] is not None)
        dys[i] = round(dys[a] + (dys[b] - dys[a]) * (i - a) / (b - a))
    return [shift(f, dy) for f, dy in zip(frames, dys)]


def strip(spec: dict, out: str) -> None:
    """Смуга кадрів одного напряму (падіння й підйом, «праворуч»): кадри на
    тому самому полотні, що й аркуш людини, тож стопи стоять там само.

    "air" — номери кадрів у повітрі (`ground`); "stand_end" — останній кадр
    замінити самим поворотом: шаблон підйому закінчується вищою й тоншою
    Лєною, ніж на аркуші ходи, і вона б «стрибала», щойно рушить."""
    cell = spec['cell']
    rot = fetch(spec['rotation'])
    frames = [fetch(u) for u in spec['strip']]
    for f in frames:
        if f.size != (cell, cell):
            raise ValueError(f'кадр {f.size} не на полотні {cell}×{cell}')
    if spec.get('stand_end'):
        frames[-1] = rot
    frames = ground(frames, rot, spec.get('air', []))
    eyes = spec.get('eyes')
    if eyes:
        hair = hair_palette(rot)
        frames = [fix_strip_eyes(f, hair, eyes['color']) for f in frames]
    sheet = Image.new('RGBA', (cell * len(frames), cell), (0, 0, 0, 0))
    for c, f in enumerate(frames):
        sheet.paste(f, (c * cell, 0))
    sheet.save(out)
    print(json.dumps({'cell': cell, 'frames': len(frames)}))


def main() -> None:
    spec = json.load(open(sys.argv[1]))
    out = sys.argv[2]
    if 'strip' in spec:
        strip(spec, out)
        return
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
    face = spec.get('face')
    if face:
        rot = {k: paint_face(v, face, k) for k, v in rot.items()}
        walk = {k: [paint_face(f, face, k) for f in v] for k, v in walk.items()}
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
