"""Мешканці й перехожі 32×32 з людей Godot-порту (ADR-0239, етап 2).

Люди порту — аркуші 56×56: 9 стовпців (стоїть і 8 кадрів ходи), рядки
південь, північ, захід, схід; вбрання й зачіска — окремі шари. Тут шари
зводяться в одного, рядки стають у порядку гри (униз, ліворуч, праворуч,
угору), а кожен піксель — квадратом 2×2: піксель порту — світовий піксель,
тобто два пікселі малюнка, як у 16-піксельних спрайтів, яких ці аркуші
заміняють.

    python scripts/folk/import_game1.py <тека game-1>
"""
import sys
from pathlib import Path
from PIL import Image

OUT = Path(__file__).resolve().parents[2] / 'src/features/game/life/render/assets/hd/folk'
CELL = 56
COLS = 9
# Рядок порту для рядка гри: униз = південь, ліворуч = захід, праворуч = схід, угору = північ.
ROWS = [0, 2, 3, 1]

# Ім'я в грі -> шари порту знизу вгору. Без купальників і зимового (поза сезоном
# на вулиці не ходять) і без людей, які в грі вже мають свої аркуші PixelLab
# (Лєна, мама, Діма, Оля).
FOLK = {
    'man-jeans': ['outfit_dad_jeans', 'hair_receding'],
    'man-blue': ['outfit_town_blue', 'hair_plain'],
    'man-grey': ['outfit_town_grey', 'hair_spiked'],
    'teen-boy': ['outfit_teen_green', 'hair_teen_spiky'],
    'woman-flowers': ['outfit_mom_flowers', 'hair_curly_red'],
    'woman-green': ['outfit_town_green', 'hair_bob'],
    'woman-navy': ['outfit_town_navy', 'hair_ponytail'],
    'woman-granny': ['outfit_town_navy', 'hair_bangs_bun'],
    'woman-casual': ['outfit_woman_casual', 'hair_long_wavy'],
    'woman-summer': ['outfit_woman_summer', 'hair_bob'],
    'woman-formal': ['outfit_woman_formal', 'hair_ponytail'],
    'teen-girl': ['outfit_teen_mint', 'hair_teen_long'],
    'kid-boy-red': ['outfit_child_red', 'hair_child_messy'],
    'kid-boy-summer': ['outfit_child_boy_summer', 'hair_child_short'],
    'kid-boy-casual': ['outfit_child_boy_casual', 'hair_child_curly'],
    'kid-boy-formal': ['outfit_child_boy_formal', 'hair_child_straight'],
    'kid-girl-mustard': ['outfit_child_mustard', 'hair_child_pigtails'],
    'kid-girl-plain': ['body_child_girl', 'hair_child_bob'],
    'kid-girl-summer': ['outfit_child_girl_summer', 'hair_child_pigtails'],
    'kid-girl-casual': ['outfit_child_girl_casual', 'hair_child_bob'],
}


def build(src: Path, layers: list[str]) -> Image.Image:
    sheet = Image.open(src / f'{layers[0]}.png').convert('RGBA')
    for name in layers[1:]:
        sheet.alpha_composite(Image.open(src / f'{name}.png').convert('RGBA'))
    if sheet.size != (CELL * COLS, CELL * 4):
        raise SystemExit(f'{layers}: аркуш {sheet.size}, чекали {(CELL * COLS, CELL * 4)}')
    out = Image.new('RGBA', sheet.size)
    for row, src_row in enumerate(ROWS):
        out.paste(sheet.crop((0, src_row * CELL, CELL * COLS, (src_row + 1) * CELL)), (0, row * CELL))
    return out.resize((out.width * 2, out.height * 2), Image.NEAREST)


def main(root: str) -> None:
    src = Path(root) / 'assets' / 'people56'
    OUT.mkdir(parents=True, exist_ok=True)
    for name, layers in FOLK.items():
        build(src, layers).save(OUT / f'{name}.png', optimize=True)
        print(name)


if __name__ == '__main__':
    main(sys.argv[1])
