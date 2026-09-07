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

# ── ЧИСТО BLENDER: З КІЛЕЦЬ РОБИТЬСЯ БИТИЙ КАМІНЬ ────────────
# Кільцевий каркас вище — це ФОРМА, і на цьому вона й закінчувалась:
# гладка баня з гладким шумом по колу. Виміряно двогранним кутом між
# сусідніми гранями: плато 11.9° середнього при 5.5° медіани, тобто горб,
# а не порода.
#
# Далі працює те, чого процедурний код у сцені зробити не може й не
# мусить: зміщення за об'ємною текстурою і ПЛОСКЕ спрощення. Перше ламає
# поверхню, друге зливає майже-компланарні трикутники в СПРАВЖНІ пласкі
# грані різного розміру — рівно те, чим злам породи відрізняється від
# тріангульованої сфери.

ROCK_DISPLACE = 0.085
"""Розмах зміщення поверхні, у радіусах острова."""

ROCK_GRAIN = 0.42
"""
Розмір зерна текстури зміщення, у радіусах острова.

Дрібніше — і скеля стає наждаком: на екрані порталу таке зерно менше за
піксель і читається шумом. Більше — і лишаються ті самі кілька горбів.
"""

FACET_ANGLE_DEG = 11.0
"""
Кут, нижче за який сусідні грані зливаються в одну.

Це і є «пласка грань» у числі: нуль лишив би тріангульовану кулю, а
тридцять з'їв би всю форму разом із карнизом.
"""

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


# ── ЧИСЛА ЕТАЛОНА: ХМАРА ─────────────────────────────────────
# Хмару від столової гори відрізняє не форма взагалі, а РІЗНИЦЯ між
# верхом і низом: у кумулуса верх бугристий, а основа майже пласка — її
# ріже рівень конденсації, той самий на всю хмару. Гора пласка з обох
# боків, хребет рваний з обох.

CLOUD_LOBES = 5
"""Скільки горбів у пасмі. Хмара — не одна куля, а купа."""

CLOUD_LOBE_ASPECT = 1.0
"""
Ширина одного горба на його висоту НАД ОСНОВОЮ.

Кумулус росте вгору так само швидко, як убік: класична «цвітна капуста»
приблизно така сама заввишки, як завширшки. Розтягнутий горб перестає
бути хмарою й стає пасмом туману.
"""

CLOUD_BASE_CUT = 0.42
"""
Яку частку радіуса нижнього горба зрізає рівень конденсації.

Це і є пласке дно. Без зрізу метакулі дають картоплину, а картоплина в
небі читається островом, а не хмарою.
"""

CLOUD_RESOLUTION = 0.14
"""Крок сітки метакуль. Дрібніше — дорожче, грубіше — гранчаста хмара."""


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


def build_cloud(rng):
    """
    Пасмо кумулусів на спільній пласкій основі.

    МЕТАКУЛІ, А НЕ СІТКА, і це те, заради чого Blender тут стоїть: злиття
    куль дає перетяжки між горбами, яких кільцевий генератор сцени не
    зробить жодним шумом. Потім `bisect_plane` зрізає низ — рівень
    конденсації однаковий на всю хмару, тож основа виходить пласкою за
    побудовою, а не за наміром.
    """
    ball = bpy.data.metaballs.new('CloudBall')
    ball.resolution = CLOUD_RESOLUTION
    ball.render_resolution = CLOUD_RESOLUTION
    obj = bpy.data.objects.new('CloudSource', ball)
    bpy.context.scene.collection.objects.link(obj)

    step = 2.0 / CLOUD_LOBE_ASPECT
    for lobe in range(CLOUD_LOBES):
        radius = 0.8 + rng.random() * 0.45
        element = ball.elements.new(type='BALL')
        element.co = Vector((
            (lobe - (CLOUD_LOBES - 1) / 2) * step + (rng.random() - 0.5) * 0.5,
            (rng.random() - 0.5) * 0.6,
            (rng.random() - 0.5) * 0.35,
        ))
        element.radius = radius
        # Другий, менший горб над першим: кумулус росте догори купками, і
        # саме вони дають бугристий верх.
        if rng.random() < 0.7:
            crest = ball.elements.new(type='BALL')
            crest.co = element.co + Vector((
                (rng.random() - 0.5) * 0.6,
                (rng.random() - 0.5) * 0.4,
                radius * (0.5 + rng.random() * 0.4),
            ))
            crest.radius = radius * (0.5 + rng.random() * 0.3)

    depsgraph = bpy.context.evaluated_depsgraph_get()
    baked = bpy.data.meshes.new_from_object(obj.evaluated_get(depsgraph))
    bpy.data.objects.remove(obj)

    bm = bmesh.new()
    bm.from_mesh(baked)
    bpy.data.meshes.remove(baked)
    lowest = min(vert.co.z for vert in bm.verts)
    cut = lowest + (0.8 * CLOUD_BASE_CUT)
    bmesh.ops.bisect_plane(
        bm,
        geom=list(bm.verts) + list(bm.edges) + list(bm.faces),
        plane_co=Vector((0.0, 0.0, cut)),
        plane_no=Vector((0.0, 0.0, 1.0)),
        clear_inner=True,
    )
    return bm


def emit(name, bm, rock=False):
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    if rock:
        break_stone(obj)
    mesh = obj.data
    mesh.calc_loop_triangles()
    return mesh


def break_stone(obj):
    """
    Кільцевий каркас → битий камінь.

    Три модифікатори поспіль, і порядок серед них єдино можливий:

      1. `SUBSURF` простим поділом — зміщенню потрібні вершини, яких у
         каркасі з восьми кілець просто немає. Без цього кроку зміщення
         рухає кільця цілком, і форма лишається тією самою, тільки
         кривішою.
      2. `DISPLACE` за об'ємною текстурою — сам злам.
      3. `DECIMATE` у ПЛАСКОМУ режимі — зливає майже-компланарні грані в
         одну справжню пласку. Саме цей крок робить грані різного розміру,
         а різний розмір і є те, чим порода відрізняється від виточеного:
         однакова ширина граней читається токарним верстатом.
    """
    texture = bpy.data.textures.new('RockGrain', type='CLOUDS')
    texture.noise_scale = ROCK_GRAIN
    texture.noise_depth = 3
    texture.noise_basis = 'BLENDER_ORIGINAL'

    sub = obj.modifiers.new('Dense', 'SUBSURF')
    sub.subdivision_type = 'SIMPLE'
    sub.levels = 2
    sub.render_levels = 2

    push = obj.modifiers.new('Break', 'DISPLACE')
    push.texture = texture
    push.strength = ROCK_DISPLACE * 2
    push.mid_level = 0.5
    push.texture_coords = 'LOCAL'

    flat = obj.modifiers.new('Facets', 'DECIMATE')
    flat.decimate_type = 'DISSOLVE'
    flat.angle_limit = math.radians(FACET_ANGLE_DEG)

    depsgraph = bpy.context.evaluated_depsgraph_get()
    baked = bpy.data.meshes.new_from_object(obj.evaluated_get(depsgraph))
    original = obj.data
    obj.modifiers.clear()
    obj.data = baked
    # ІМ'Я МУСИТЬ ЛИШИТИСЬ ТИМ САМИМ. `new_from_object` створює новий
    # датаблок, і Blender дає йому «…001», бо старе ім'я ще зайняте. Мірка
    # шукає меш за іменем, тож без цих трьох рядків вона падає з «у GLB
    # немає меша ReferenceIsland» — саме так це й знайшлось.
    name = original.name
    bpy.data.meshes.remove(original)
    baked.name = name


def build():
    rng = random.Random(SEED)
    bpy.ops.wm.read_factory_settings(use_empty=True)

    rock = bmesh.new()
    build_island(rock, rng)
    island_mesh = emit('ReferenceIsland', rock, rock=True)

    stone = bmesh.new()
    build_temple(stone)
    temple_mesh = emit('ReferenceTemple', stone)

    cloud_mesh = emit('ReferenceCloud', build_cloud(rng))

    out = os.path.join(
        os.path.dirname(os.path.abspath(__file__)), 'reference', 'island-temple.glb',
    )
    os.makedirs(os.path.dirname(out), exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', export_yup=True)
    return out, island_mesh, temple_mesh, cloud_mesh


if __name__ == '__main__':
    path, island_mesh, temple_mesh, cloud_mesh = build()
    data = open(path, 'rb').read()
    total = sum(len(m.loop_triangles) for m in (island_mesh, temple_mesh, cloud_mesh))
    print(f'еталон       {path}')
    print(f'острів       баня {CROWN_RISE:.2f} радіуса, корінь {ROOT_DEPTH:.2f} радіуса')
    print(f'карниз       найширше {WIDEST_OVER_TOP:.2f} радіуса, '
          f'на {OVERHANG_DROP:.2f} нижче за кромку')
    print(f'порода       зміщення {ROCK_DISPLACE:.3f}, зерно {ROCK_GRAIN:.2f}, '
          f'грань від {FACET_ANGLE_DEG:.0f}°')
    print(f'хмара        {CLOUD_LOBES} горбів, стрункість {CLOUD_LOBE_ASPECT:.1f}, '
          f'зріз основи {CLOUD_BASE_CUT:.2f}')
    print(f'храм         стрункість {COLUMN_SLENDER:.1f}, просвіт {INTERCOLUMN:.2f}, '
          f'фронтон {PEDIMENT_SLOPE_DEG:.1f}°')
    print(f'трикутників  {total}')
    print(f'GLB          {len(data)} байт, sha256 {hashlib.sha256(data).hexdigest()[:16]}')
