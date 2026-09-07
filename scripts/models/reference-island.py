#!/usr/bin/env python3
# ============================================================
# ЕТАЛОННИЙ ЛІТАЮЧИЙ ОСТРІВ ІЗ ХРАМОМ — мірка, а не асет.
# ------------------------------------------------------------
# Той самий метод, що вже спрацював на дереві (ADR-0104) і на кристалі
# (ADR-0114): доти еталоном була ПРОЗА — «древній маленький храм, який
# знаходиться на літаючому острові», — а з прози не дістати ні того,
# наскільки глибокий корінь, ні того, чи нависає обрив, ні стрункості
# колони. Кожна правка форми була думкою проти думки.
#
# Цей острів не потрапляє в портал і ніколи не потрапить. Він існує рівно
# для того, щоб `islandSilhouetteProfile` і `templeFrontProfile` дістали
# з нього числа, і наш генератор виміряли проти них ТІЄЮ САМОЮ функцією.
# Дві різні мірки дали б числа, які не можна класти поруч — ця помилка в
# цьому проєкті вже коштувала хибних висновків двічі.
#
#   python3 -m pip install bpy
#   python3 scripts/models/reference-island.py
#
# ДВА МЕШІ, А НЕ ОДИН. Скеля й храм міряються окремо: якби храм лежав в
# одному меші з островом, «найширше місце тіла» стало б кутом стилобата,
# а нависання обриву — головне число цього файла — виміряло б не те тіло.
# ============================================================
import hashlib
import math
import os
import random
import sys

try:
    import bpy
    import bmesh
    from mathutils import Vector
except ImportError:  # pragma: no cover — скрипт запускають лише з bpy
    sys.exit('Немає bpy. Постав: python3 -m pip install bpy')


SEED = 20221226

# ── ЧИСЛА ЕТАЛОНА: ОСТРІВ ────────────────────────────────────
# Усі безрозмірні — частки радіуса верхньої кромки. Так мірка порівнює
# еталон і сцену пари в одиницях сцени, не переводячи нічого.

RADIUS = 1.0
"""Радіус верхньої кромки. Одиниця, до якої зведено все інше."""

CROWN_RISE = 0.14
"""
Висота бані верху, у радіусах.

Плато літаючого острова НЕ пласке. Вивітрений верх — це м'яка баня, яка
до країв опадає; плаский диск читається тарілкою, і жодне зерно каменю
цього не рятує. 0.14 — помітно оком і не перетворює острів на пагорб.
"""

ROOT_DEPTH = 1.8
"""
Глибина кореня, у радіусах верху.

ГОЛОВНЕ ЧИСЛО ЖАНРУ. Літаючий острів читається літаючим тому, що під ним
висить більше каменю, ніж видно згори: корінь довший за половину ширини
острова майже вдвічі. Коротший корінь дає млинець, який просто ні на чому
не лежить, — а це вже не острів, а помилка.
"""

WIDEST_OVER_TOP = 1.09
"""
Найширший радіус тіла, у радіусах верхньої кромки.

ДРУГЕ ГОЛОВНЕ ЧИСЛО. Верх острова — НЕ найширше його місце: скеля під
кромкою нависає, бо м'яку породу вимило, а тверда лишилась карнизом. Якщо
найширше місце збігається з верхом, тіло — усічений конус, тобто плита.
"""

OVERHANG_DROP = 0.13
"""На скільки радіусів нижче за кромку лежить найширше місце."""

RIM_RAGGED = 0.09
"""
Рваність обрису: відхилення радіуса кромки, поділене на середній радіус.

Нижче 0.04 коло читається виточеним; вище 0.15 обрис розсипається на
зубці й перестає бути силуетом.
"""

ROOT_SEGMENTS = 64
CROWN_RINGS = 7

# ── ЧИСЛА ЕТАЛОНА: ХРАМ ──────────────────────────────────────
# Дорика, бо саме її силует упізнають як «древній храм». Усі числа —
# у НИЖНІХ ДІАМЕТРАХ КОЛОНИ, як їх і писали античні майстри.

COLUMN_SLENDER = 5.6
"""
Висота колони на її нижній діаметр.

Грецька дорика тримається 4–6.5; нижче виходить тумба, вище — іонічна
стрункість, яка з малого храму робить павільйон.
"""

INTERCOLUMN = 1.35
"""
Просвіт між колонами на нижній діаметр.

Класична дорика — 1.2–1.5. Ширше — і ряд розсипається на окремі стовпи;
вужче — і фасад читається суцільною стіною.
"""

COLUMN_TAPER = 0.80
"""Верхній діаметр колони на нижній. Дорика — 0.75–0.85."""

PEDIMENT_SLOPE_DEG = 14.0
"""
Нахил фронтону від горизонталі.

Грецькі фронтони — 12.5–16°. Крутіший читається двосхилим дахом хати,
пологіший зникає й лишає просто балку.
"""

STYLOBATE_OVERHANG = 0.55
"""Виступ стилобата за вісь крайньої колони, у нижніх діаметрах."""

ENTABLATURE = 1.6
"""Висота антаблемента (архітрав + фриз) у нижніх діаметрах."""

FRONT_COLUMNS = 4
SIDE_COLUMNS = 3
COLUMN_SIDES = 12

TEMPLE_COLUMN_DIAMETER = 0.10
"""
Нижній діаметр колони в радіусах острова.

Єдине розмірне число храму: воно каже, наскільки храм МАЛИЙ проти
острова. Решта пропорцій — від нього.
"""


def crown_radius_at(rng_values, angle):
    """Радіус кромки в напрямку `angle` — гладкий шум по колу."""
    points = len(rng_values)
    turns = angle / (2 * math.pi)
    scaled = (turns - math.floor(turns)) * points
    index = int(scaled)
    t = scaled - index
    left = rng_values[index % points]
    right = rng_values[(index + 1) % points]
    eased = t * t * (3 - 2 * t)
    return RADIUS * (1 + (left + (right - left) * eased) * 2 * RIM_RAGGED - RIM_RAGGED)


def build_island(bm, rng):
    """
    Скеля: баня верху, карниз під кромкою й корінь, що тоне.

    Профіль по вертикалі задається списком (частка радіуса, висота):
    верх — баня, далі кромка, далі НАЙШИРШЕ місце нижче за неї, і аж тоді
    звуження в корінь. Саме третій рядок і робить острів островом.
    """
    noise = [rng.random() for _ in range(17)]
    profile = [
        # частка радіуса кромки, висота у радіусах
        (0.0, CROWN_RISE),
        (0.42, CROWN_RISE * 0.86),
        (0.74, CROWN_RISE * 0.5),
        (1.0, 0.0),
        (WIDEST_OVER_TOP, -OVERHANG_DROP),
        (0.86, -ROOT_DEPTH * 0.24),
        (0.58, -ROOT_DEPTH * 0.5),
        (0.3, -ROOT_DEPTH * 0.78),
    ]

    rings = []
    for share, height in profile:
        ring = []
        for segment in range(ROOT_SEGMENTS):
            angle = (segment / ROOT_SEGMENTS) * 2 * math.pi
            radius = crown_radius_at(noise, angle) * share
            # Корінь ще й рваний по глибині: рівний конус читається бурулькою.
            sag = 0.0
            if height < 0:
                sag = (rng.random() - 0.5) * ROOT_DEPTH * 0.09
            ring.append(bm.verts.new(Vector((
                math.cos(angle) * radius,
                math.sin(angle) * radius,
                height + sag,
            ))))
        rings.append(ring)

    hub = bm.verts.new(Vector((0.0, 0.0, CROWN_RISE)))
    for segment in range(ROOT_SEGMENTS):
        nxt = (segment + 1) % ROOT_SEGMENTS
        bm.faces.new((hub, rings[0][segment], rings[0][nxt]))
    for level in range(len(rings) - 1):
        upper, lower = rings[level], rings[level + 1]
        for segment in range(ROOT_SEGMENTS):
            nxt = (segment + 1) % ROOT_SEGMENTS
            bm.faces.new((upper[segment], upper[nxt], lower[nxt], lower[segment]))

    tip = bm.verts.new(Vector((0.0, 0.0, -ROOT_DEPTH)))
    for segment in range(ROOT_SEGMENTS):
        nxt = (segment + 1) % ROOT_SEGMENTS
        bm.faces.new((rings[-1][nxt], rings[-1][segment], tip))


def build_temple(bm):
    """
    Малий дорійський храм: стилобат, периптер, антаблемент, фронтон.

    Стоїть на нулі — на тій самій площині, що й кромка острова, — бо
    мірка порівнює ПРОПОРЦІЇ, а не місце.
    """
    d = TEMPLE_COLUMN_DIAMETER
    radius = d / 2
    height = d * COLUMN_SLENDER
    step = d * (1 + INTERCOLUMN)
    half_x = step * (FRONT_COLUMNS - 1) / 2
    half_z = step * (SIDE_COLUMNS - 1) / 2
    over = d * STYLOBATE_OVERHANG
    stylo = d * 0.42

    def box(cx, cy, cz, hx, hy, hz):
        verts = [
            bm.verts.new(Vector((cx + sx * hx, cy + sy * hy, cz + sz * hz)))
            for sz in (-1, 1) for sy in (-1, 1) for sx in (-1, 1)
        ]
        # Порядок вище дає індекси 0..7 як (sx, sy, sz) у двійковому коді.
        quads = (
            (0, 1, 3, 2), (4, 6, 7, 5), (0, 4, 5, 1),
            (2, 3, 7, 6), (0, 2, 6, 4), (1, 5, 7, 3),
        )
        for quad in quads:
            bm.faces.new(tuple(verts[i] for i in quad))

    # Стилобат — три сходинки, кожна ширша за попередню.
    for level in range(3):
        grow = over * (1 + level * 0.6)
        box(0.0, 0.0, -stylo * (level + 0.5),
            half_x + radius + grow, half_z + radius + grow, stylo / 2)

    # Периптер: колони по периметру, зрізаний конус із COLUMN_SIDES граней.
    spots = []
    for index in range(FRONT_COLUMNS):
        x = -half_x + step * index
        spots.append((x, half_z))
        spots.append((x, -half_z))
    for index in range(1, SIDE_COLUMNS - 1):
        z = -half_z + step * index
        spots.append((half_x, z))
        spots.append((-half_x, z))

    for cx, cz in spots:
        lower, upper = [], []
        for corner in range(COLUMN_SIDES):
            angle = (corner / COLUMN_SIDES) * 2 * math.pi
            lower.append(bm.verts.new(Vector((
                cx + math.cos(angle) * radius, cz + math.sin(angle) * radius, 0.0))))
            upper.append(bm.verts.new(Vector((
                cx + math.cos(angle) * radius * COLUMN_TAPER,
                cz + math.sin(angle) * radius * COLUMN_TAPER,
                height))))
        for corner in range(COLUMN_SIDES):
            nxt = (corner + 1) % COLUMN_SIDES
            bm.faces.new((lower[corner], lower[nxt], upper[nxt], upper[corner]))
        bm.faces.new(tuple(reversed(upper)))

    # Антаблемент — суцільний пояс на колонах.
    entab = d * ENTABLATURE
    box(0.0, 0.0, height + entab / 2, half_x + radius, half_z + radius, entab / 2)

    # Фронтон: трикутник на фасаді, витягнутий на товщину карниза.
    peak = (half_x + radius) * math.tan(math.radians(PEDIMENT_SLOPE_DEG))
    base = height + entab
    thickness = d * 0.5
    for side in (1, -1):
        y = (half_z + radius) * side
        left = bm.verts.new(Vector((-(half_x + radius), y, base)))
        right = bm.verts.new(Vector((half_x + radius, y, base)))
        top = bm.verts.new(Vector((0.0, y, base + peak)))
        bm.faces.new((left, right, top) if side > 0 else (top, right, left))
    for edge in (-1, 1):
        x_out = (half_x + radius) * edge
        a = bm.verts.new(Vector((x_out, half_z + radius, base)))
        b = bm.verts.new(Vector((0.0, half_z + radius, base + peak)))
        c = bm.verts.new(Vector((0.0, half_z + radius - thickness, base + peak)))
        e = bm.verts.new(Vector((x_out, half_z + radius - thickness, base)))
        bm.faces.new((a, b, c, e))


def emit(name, bm):
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    mesh.calc_loop_triangles()
    return mesh


def build():
    rng = random.Random(SEED)
    bpy.ops.wm.read_factory_settings(use_empty=True)

    rock = bmesh.new()
    build_island(rock, rng)
    island_mesh = emit('ReferenceIsland', rock)

    stone = bmesh.new()
    build_temple(stone)
    temple_mesh = emit('ReferenceTemple', stone)

    out = os.path.join(
        os.path.dirname(os.path.abspath(__file__)), 'reference', 'island-temple.glb',
    )
    os.makedirs(os.path.dirname(out), exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', export_yup=True)
    return out, island_mesh, temple_mesh


if __name__ == '__main__':
    path, island_mesh, temple_mesh = build()
    data = open(path, 'rb').read()
    total = len(island_mesh.loop_triangles) + len(temple_mesh.loop_triangles)
    print(f'еталон       {path}')
    print(f'острів       баня {CROWN_RISE:.2f} радіуса, корінь {ROOT_DEPTH:.2f} радіуса')
    print(f'карниз       найширше {WIDEST_OVER_TOP:.2f} радіуса, '
          f'на {OVERHANG_DROP:.2f} нижче за кромку')
    print(f'храм         стрункість {COLUMN_SLENDER:.1f}, просвіт {INTERCOLUMN:.2f}, '
          f'фронтон {PEDIMENT_SLOPE_DEG:.1f}°')
    print(f'трикутників  {total}')
    print(f'GLB          {len(data)} байт, sha256 {hashlib.sha256(data).hexdigest()[:16]}')
