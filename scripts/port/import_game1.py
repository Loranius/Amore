"""Люди гри з Godot-порту «Дєвочки в городі» (ADR-0239).

Люди порту — аркуші 56×56: 9 стовпців (стоїть і 8 кадрів ходи), рядки
південь, північ, захід, схід; вбрання й зачіска — окремі шари. Тут шари
зводяться в один аркуш у порядку рядків гри (униз, ліворуч, праворуч,
угору). Піксель порту — `SCALE`×`SCALE` пікселів малюнка: власник
2026-11-03 спершу попросив людей менших («завеликі для декорацій»), а
побачивши піксель у піксель — «вдвічі збільш, вони тепер дуже дрібні».
Усе рахується в пікселях порту, а пишеться збільшеним, точки долонь теж.

Для Лєни ще:
- маска одягу (`-mask.png`: червоний — верх, зелений — низ) з шару вбрання,
  без зачіски, голови й шкіри — за нею перефарбовується одяг із шафи;
- смуга падіння навзнак і підйому (`-fall.png`) — кадр «праворуч»,
  повернутий навколо стоп через суперсемплінг, кадри на лінії стоп;
- пози з руками перед собою (`-poses.png`) — кадр «праворуч» із
  домальованим передпліччям на рівні грудей, низько й на рівні плечей;
- точки долонь у `port.json`.

    python scripts/port/import_game1.py <тека game-1>
"""
import colorsys
import json
import math
import sys
from collections import Counter
from pathlib import Path
from PIL import Image

HD = Path(__file__).resolve().parents[2] / 'src/features/game/life/render/assets/hd'
CELL = 56
# Піксель порту — стільки пікселів малюнка (див. вище); Бася й кури PixelLab намальовані під цей зріст.
SCALE = 2
COLS = 9
FLOOR = 51
FOOT_X = 27.5
# Рядок порту для рядка гри: униз = південь, ліворуч = захід, праворуч = схід, угору = північ.
ROWS = [0, 2, 3, 1]
EAST = 3
HEAD_ROWS = 13
FALL_DOWN = [0, 12, 28, 45, 62, 78, 90]
FALL_UP = [72, 54, 36, 18, 0]
SUPER = 4

# Люди з власними ролями. Лєна — ще з маскою одягу, падінням і позами.
PEOPLE = {
    'lena-kid': ['body_child_girl', 'hair_child_wavy'],
    'lena-teen': ['body_teen_girl', 'hair_teen_ponytail'],
    'lena-adult': ['outfit_terracotta', 'hair_long_center'],
    'mom': ['outfit_wine', 'hair_bangs_bun'],
    'dima': ['outfit_olive', 'hair_side_part'],
    'olya-kid': ['outfit_child_mustard', 'hair_child_bob'],
    'olya-teen': ['outfit_teen_mint', 'hair_teen_bob'],
    'dima-kid': ['outfit_dima_kid', 'hair_child_straight'],
    'vlad-kid': ['outfit_vlad_kid', 'hair_child_curly'],
    'dima-mom': ['outfit_mom_flowers', 'hair_curly_red'],
    'dima-dad': ['outfit_dad_jeans', 'hair_receding'],
}
LENA = ('lena-kid', 'lena-teen', 'lena-adult')

# Мешканці й перехожі: шари і, де треба, перефарбування одягу (барва, насиченість)
# — щоб жоден не носив вбрання Лєни, Олі чи батьків Діми.
FOLK = {
    'man-blue': (['outfit_town_blue', 'hair_plain'], None),
    'man-brown': (['outfit_town_blue', 'hair_side_part'], (0.07, 0.45)),
    'man-grey': (['outfit_town_grey', 'hair_spiked'], None),
    'teen-boy': (['outfit_teen_green', 'hair_teen_spiky'], None),
    'woman-green': (['outfit_town_green', 'hair_bob'], None),
    'woman-navy': (['outfit_town_navy', 'hair_ponytail'], None),
    'woman-granny': (['outfit_town_navy', 'hair_bangs_bun'], (0.83, 0.25)),
    'woman-casual': (['outfit_woman_casual', 'hair_long_wavy'], None),
    'woman-summer': (['outfit_woman_summer', 'hair_bob'], None),
    'woman-formal': (['outfit_woman_formal', 'hair_ponytail'], None),
    'teen-girl': (['outfit_teen_mint', 'hair_teen_long'], (0.95, 0.45)),
    'kid-boy-red': (['outfit_child_red', 'hair_child_messy'], None),
    'kid-boy-summer': (['outfit_child_boy_summer', 'hair_child_short'], None),
    'kid-boy-casual': (['outfit_child_boy_casual', 'hair_child_curly'], None),
    'kid-boy-formal': (['outfit_child_boy_formal', 'hair_child_straight'], None),
    'kid-girl-green': (['outfit_child_mustard', 'hair_child_pigtails'], (0.33, 0.5)),
    'kid-girl-summer': (['outfit_child_girl_summer', 'hair_child_pigtails'], None),
    'kid-girl-casual': (['outfit_child_girl_casual', 'hair_child_bob'], None),
    'kid-girl-formal': (['outfit_child_girl_formal', 'hair_child_wavy'], None),
}


def hsv(c):
    return colorsys.rgb_to_hsv(c[0] / 255, c[1] / 255, c[2] / 255)


def is_skin(c):
    h, s, v = hsv(c)
    return 0.04 <= h <= 0.1 and s < 0.56 and v > 0.6


def hue_in(h, a, b):
    return a <= h <= b if a <= b else h >= a or h <= b


# Одяг Лєни за кольором шару вбрання: верх і низ (заміряно по всіх кадрах).
GARMENTS = {
    'lena-kid': {'top': lambda h, s, v: hue_in(h, 0.97, 0.045) and s >= 0.45 and v >= 0.5,
                 'bottom': lambda h, s, v: hue_in(h, 0.55, 0.68) and s >= 0.3 and v >= 0.2},
    'lena-teen': {'top': lambda h, s, v: hue_in(h, 0.7, 0.8) and s >= 0.2 and v >= 0.5,
                  'bottom': lambda h, s, v: hue_in(h, 0.55, 0.68) and s >= 0.3 and v >= 0.2},
    'lena-adult': {'top': lambda h, s, v: hue_in(h, 0.99, 0.055) and s >= 0.45 and v >= 0.4,
                   'bottom': lambda h, s, v: hue_in(h, 0.55, 0.7) and s >= 0.2 and v >= 0.15},
}
MASK = {'top': (255, 0, 0, 255), 'bottom': (0, 255, 0, 255)}


def cells(width, height):
    for cy in range(0, height, CELL):
        for cx in range(0, width, CELL):
            yield cx, cy


def recolor(sheet, hue, sat):
    """Одяг нижче голови — у барву `hue` з насиченістю не більше `sat`; шкіра й темне не чіпаються."""
    px = sheet.load()
    for cx, cy in cells(*sheet.size):
        box = sheet.crop((cx, cy, cx + CELL, cy + CELL)).getbbox()
        if not box:
            continue
        for y in range(cy + box[1] + HEAD_ROWS, cy + CELL):
            for x in range(cx, cx + CELL):
                c = px[x, y]
                h, s, v = hsv(c)
                if not c[3] or is_skin(c) or s < 0.2 or v < 0.25:
                    continue
                r, g, b = colorsys.hsv_to_rgb(hue, min(s, sat), v)
                px[x, y] = (round(r * 255), round(g * 255), round(b * 255), c[3])


def layered(src, layers, tint=None):
    outfit = Image.open(src / f'{layers[0]}.png').convert('RGBA')
    if outfit.size != (CELL * COLS, CELL * 4):
        raise SystemExit(f'{layers}: аркуш {outfit.size}, чекали {(CELL * COLS, CELL * 4)}')
    if tint:
        recolor(outfit, *tint)
    hair = [Image.open(src / f'{n}.png').convert('RGBA') for n in layers[1:]]
    sheet = outfit.copy()
    for h in hair:
        sheet.alpha_composite(h)
    return sheet, outfit, hair


def garment_mask(name, outfit, hair):
    """Маска одягу Лєни в рядках порту: лише пікселі шару вбрання, не зачіска, не голова, не шкіра."""
    mask = Image.new('RGBA', outfit.size)
    mp, op = mask.load(), outfit.load()
    hps = [h.load() for h in hair]
    for cx, cy in cells(*outfit.size):
        box = outfit.crop((cx, cy, cx + CELL, cy + CELL)).getbbox()
        if not box:
            continue
        for y in range(cy + box[1] + HEAD_ROWS, cy + CELL):
            for x in range(cx, cx + CELL):
                c = op[x, y]
                if not c[3] or is_skin(c) or any(hp[x, y][3] for hp in hps):
                    continue
                h, s, v = hsv(c)
                for part, test in GARMENTS[name].items():
                    if test(h, s, v):
                        mp[x, y] = MASK[part]
                        break
    return mask


def reorder(sheet):
    out = Image.new('RGBA', sheet.size)
    for row, src_row in enumerate(ROWS):
        out.paste(sheet.crop((0, src_row * CELL, CELL * COLS, (src_row + 1) * CELL)), (0, row * CELL))
    return out


def cell_of(sheet, col, row):
    return sheet.crop((col * CELL, row * CELL, (col + 1) * CELL, (row + 1) * CELL))


# ---------------------------------------------------------------- падіння

def rotate(frame, mask, angle):
    """Кадр «праворуч», повернутий навзнак на `angle`° навколо стоп (голова — назад, ліворуч).

    Суперсемплінг: кожен вихідний піксель — найчастіший серед SUPER×SUPER
    точок, кожна з яких бере найближчий піксель джерела. Так контур не
    кришиться, а маска повертається разом з кольором піксель у піксель.
    """
    # Полотно втричі більше за клітинку: лежача фігура довша, ніж півклітинки від стоп.
    big, big_m = pad(frame), pad(mask)
    fp, mp = big.load(), big_m.load()
    size = big.width
    a = math.radians(angle)
    ca, sa = math.cos(a), math.sin(a)
    px, py = CELL + FOOT_X, CELL + FLOOR + 1
    out, out_m = Image.new('RGBA', big.size), Image.new('RGBA', big.size)
    op, omp = out.load(), out_m.load()
    for y in range(CELL // 2, size - CELL // 2):
        for x in range(CELL // 2, size - CELL // 2):
            votes = Counter()
            for j in range(SUPER):
                for i in range(SUPER):
                    dx = x + (i + 0.5) / SUPER - px
                    dy = y + (j + 0.5) / SUPER - py
                    # Обертання проти годинникової стрілки на екрані: голова (угору) іде ліворуч.
                    sx = ca * dx - sa * dy + px
                    sy = sa * dx + ca * dy + py
                    ix, iy = math.floor(sx), math.floor(sy)
                    votes[(ix, iy) if 0 <= ix < size and 0 <= iy < size and fp[ix, iy][3] else None] += 1
            src, _ = votes.most_common(1)[0]
            if src:
                op[x, y] = fp[src]
                omp[x, y] = mp[src]
    return out, out_m


def pad(img):
    out = Image.new('RGBA', (CELL * 3, CELL * 3))
    out.paste(img, (CELL, CELL))
    return out


def place(frame, mask, angle, height):
    """Вирізати клітинку з повернутого полотна: низ фігури — на лінії стоп, лежача — посередині клітинки."""
    box = frame.getbbox()
    left = CELL - round(math.sin(math.radians(angle)) * height / 2)
    top = box[3] - 1 - FLOOR
    window = (left, top, left + CELL, top + CELL)
    return frame.crop(window), mask.crop(window)


def fall_strip(east, east_mask):
    box = east.getbbox()
    height = box[3] - box[1]
    frames = []
    for angle in FALL_DOWN + FALL_UP:
        f, m = rotate(east, east_mask, angle)
        frames.append(place(f, m, angle, height))
    return strip(frames)


def strip(frames):
    img = Image.new('RGBA', (CELL * len(frames), CELL))
    mask = Image.new('RGBA', img.size)
    for k, (f, m) in enumerate(frames):
        img.paste(f, (k * CELL, 0))
        mask.paste(m, (k * CELL, 0))
    return img, mask


# ---------------------------------------------------------------- пози

def skin_hand(frame):
    """Долоня, що висить: найнижчі пікселі шкіри нижче голови. Повертає (x0, x1, y0, y1)."""
    fp = frame.load()
    box = frame.getbbox()
    pts = [(x, y) for y in range(box[1] + HEAD_ROWS, CELL) for x in range(CELL) if fp[x, y][3] and is_skin(fp[x, y])]
    low = max(y for _, y in pts)
    hand = [(x, y) for x, y in pts if y >= low - 2]
    return min(x for x, _ in hand), max(x for x, _ in hand), min(y for _, y in hand), low


def sleeve_color(frame, mask):
    """Найчастіший колір верху (за маскою; без маски — непрозорий не-контур тулуба)."""
    fp, mp = frame.load(), mask.load()
    c = Counter(fp[x, y] for y in range(CELL) for x in range(CELL) if mp[x, y][0] == 255)
    return c.most_common(1)[0][0]


def line(p0, p1):
    (x0, y0), (x1, y1) = p0, p1
    n = max(abs(x1 - x0), abs(y1 - y0), 1)
    return [(round(x0 + (x1 - x0) * k / n), round(y0 + (y1 - y0) * k / n)) for k in range(n + 1)]


def pose(east, east_mask, donor, donor_mask, lift):
    """Кадр «праворуч» з передпліччям уперед.

    Нижня частина руки, що висіла, стирається: ці пікселі беруться з кадру
    ходи, де рука позаду (тулуб там видно). Від ліктя домальовується
    передпліччя в колір рукава з контуром, долоня — колір шкіри.
    `lift` — на скільки пікселів долоня вище ліктя (0 — горизонтально).
    Повертає кадр, маску й точку долоні (x уперед, y угору від стоп).
    """
    f, m = east.copy(), east_mask.copy()
    fp, mp = f.load(), m.load()
    dp, dmp = donor.load(), donor_mask.load()
    hx0, hx1, hy0, hy1 = skin_hand(east)
    top = east.getbbox()[1]
    shoulder = top + HEAD_ROWS + 1
    elbow = (shoulder + hy1) // 2
    for y in range(elbow, hy1 + 2):
        for x in range(hx0 - 1, hx1 + 2):
            fp[x, y] = dp[x, y]
            mp[x, y] = dmp[x, y]
    sleeve = sleeve_color(east, east_mask)
    outline = (42, 26, 20, 255)
    skin = next(fp_ for fp_ in (east.getpixel((x, y)) for y in range(hy0, hy1 + 1) for x in range(hx0, hx1 + 1)) if is_skin(fp_))
    reach = max(4, round((hy1 - shoulder) * 0.45))
    start = (hx1, elbow)
    end = (hx1 + reach, elbow - lift)
    for x, y in line(start, end):
        for dy, col in ((-1, outline), (0, sleeve), (1, sleeve), (2, outline)):
            if fp[x, y + dy][3] == 0 or dy in (0, 1):
                fp[x, y + dy] = col
                mp[x, y + dy] = MASK['top'] if col == sleeve else (0, 0, 0, 0)
    # Долоня 2×2 з контуром.
    ex, ey = end
    for x in range(ex + 1, ex + 4):
        for y in range(ey - 1, ey + 3):
            edge = x == ex + 3 or y in (ey - 1, ey + 2)
            fp[x, y] = outline if edge else skin
            mp[x, y] = (0, 0, 0, 0)
    return f, m, {'x': round(ex + 2.5 - FOOT_X, 1), 'y': FLOOR + 1 - (ey + 2)}


def front_hands(south):
    """Обличчям до нас: висота низу долонь над стопами й де вони ліворуч і праворуч від середини."""
    fp = south.load()
    box = south.getbbox()
    pts = [(x, y) for y in range(box[1] + HEAD_ROWS, CELL) for x in range(CELL) if fp[x, y][3] and is_skin(fp[x, y])]
    pts = [(x, y) for x, y in pts if y < FLOOR - 4]

    def side(xs):
        low = max(y for x, y in xs)
        hand = [x for x, y in xs if y >= low - 2]
        return low, sum(hand) / len(hand)

    # Кожна долоня — своїм низом: руки висять не завжди на одній висоті.
    l_low, l_x = side([p for p in pts if p[0] < FOOT_X])
    r_low, r_x = side([p for p in pts if p[0] > FOOT_X])
    return {'up': round(FLOOR - (l_low + r_low) / 2, 1), 'l': round(l_x - FOOT_X, 1), 'r': round(r_x - FOOT_X, 1)}


def lena_extras(name, sheet, mask):
    """Падіння, пози й точки долонь з кадру «праворуч» (рядок 2 гри)."""
    east, east_mask = cell_of(sheet, 0, 2), cell_of(mask, 0, 2)
    fall, fall_mask = fall_strip(east, east_mask)
    out(fall, HD / f'{name}-fall.png')
    out(fall_mask, HD / f'{name}-fall-mask.png')
    # Рука найдалі позаду — у кадрі ходи з найменшим x долоні.
    donor_col = min(range(1, COLS), key=lambda c: skin_hand(cell_of(sheet, c, 2))[0])
    donor, donor_mask = cell_of(sheet, donor_col, 2), cell_of(mask, donor_col, 2)
    # Донор — той самий зріст: стопи на підлозі, голова з гойданням; вирівнюємо за маківкою.
    dy = east.getbbox()[1] - donor.getbbox()[1]
    donor = shifted(donor, dy)
    donor_mask = shifted(donor_mask, dy)
    poses, hands = [], {}
    height = east.getbbox()[3] - east.getbbox()[1]
    for pose_name, lift in (('chest', 0), ('low', -max(2, height // 9)), ('high', max(3, height // 7))):
        f, m, hand = pose(east, east_mask, donor, donor_mask, lift)
        poses.append((f, m))
        hands[pose_name] = hand
    img, img_mask = strip(poses)
    out(img, HD / f'{name}-poses.png')
    out(img_mask, HD / f'{name}-poses-mask.png')
    return {'hands': hands, 'front': front_hands(cell_of(sheet, 0, 0))}


def shifted(img, dy):
    out = Image.new('RGBA', img.size)
    out.paste(img, (0, dy))
    return out


def out(img, path):
    """Записати збільшеним: кожен піксель порту — квадрат `SCALE`×`SCALE`."""
    img.resize((img.width * SCALE, img.height * SCALE), Image.NEAREST).save(path, optimize=True)


def scaled(meta):
    """Точки долонь — у пікселях малюнка, як аркуш."""
    if isinstance(meta, dict):
        return {k: scaled(v) for k, v in meta.items()}
    return round(meta * SCALE, 1)


def main(root):
    src = Path(root) / 'assets' / 'people56'
    (HD / 'folk').mkdir(parents=True, exist_ok=True)
    meta = {}
    for name, layers in PEOPLE.items():
        sheet, outfit, hair = layered(src, layers)
        sheet = reorder(sheet)
        out(sheet, HD / f'{name}.png')
        if name in LENA:
            mask = reorder(garment_mask(name, outfit, hair))
            out(mask, HD / f'{name}-mask.png')
            meta[name] = lena_extras(name, sheet, mask)
        print(name)
    for name, (layers, tint) in FOLK.items():
        out(reorder(layered(src, layers, tint)[0]), HD / 'folk' / f'{name}.png')
        print(name)
    (HD / 'port.json').write_text(json.dumps(scaled(meta), ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


if __name__ == '__main__':
    main(sys.argv[1])
