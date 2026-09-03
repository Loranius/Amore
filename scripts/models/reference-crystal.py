#!/usr/bin/env python3
# ============================================================
# ЕТАЛОННИЙ КРИСТАЛ У ЖЕОДІ — мірка, а не асет.
# ------------------------------------------------------------
# Той самий метод, що вже спрацював на дереві (ADR-0104): еталоном була
# ПРОЗА — `amore-crystal-look` розібрав сім присланих власником моделей на
# слова, — і з прози не дістати ні стрункості призми, ні висоти, на якій
# призма переходить у головку, ні того, скільки кристала стоїть НАД
# породою. Тому запит «щоб виглядав як справжній кристал, що росте з жеоди
# в кристальній печері» не було з чим звірити: кожна правка була думкою
# проти думки.
#
# Цей кристал не потрапляє в портал і ніколи не потрапить. Він існує рівно
# для того, щоб `crystalSilhouetteProfile` дістав із нього п'ять чисел, і
# наш генератор виміряли проти них ТІЄЮ САМОЮ функцією. Дві різні мірки
# дали б числа, які не можна класти поруч, — ця помилка в цьому проєкті
# вже коштувала хибних висновків двічі.
#
#   python3 -m pip install bpy
#   python3 scripts/models/reference-crystal.py
#
# ТРИ МЕШІ, А НЕ ОДИН, і це не зручність. Монарх, порода й друза міряються
# ОКРЕМО: якби друза лежала в одному меші з монархом, «найширше місце
# кристала» стало б найдальшим дрібним кристаликом біля стінки, і
# стрункість призми — головне число цього файла — виміряло б не те тіло.
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


# ── ЧИСЛА ЕТАЛОНА ────────────────────────────────────────────
# Усі, крім самої висоти, — БЕЗРОЗМІРНІ: частки висоти кристала або
# відношення до його радіуса. Так мірка порівнює зразок 24 см і кристал
# пари в одиницях сцени, не переводячи нічого.

HEIGHT = 24.0
"""
Повна висота монарха, сантиметри — від підошви (вона в породі) до вістря.

Число взяте з музейного зразка руки, а не зі сцени: еталон мусить бути
кристалом, який існує, інакше він знову стає думкою.
"""

PRISM_ASPECT = 3.2
"""
Довжина призми, поділена на ширину впоперек граней.

Кварц росте вздовж осі c, і в друзі вільна голова дає 2.5–5. Нижче двох
виходить кабанчик, вище шести — голка, яка на екрані читається шпилем.
3.2 — усередині, і свідомо ближче до низу: наш монарх стоїть у кадрі
головним предметом, а не стирчить із нього.
"""

TERMINATION_ANGLE = 52.0
"""
Кут граней головки від горизонталі, градуси.

Це РЕШІТКА, а не пропорція, і саме тут уже була зроблена помилка
(`amore-crystal-look`): кут виводили з видовженості тіла, і в довгого
монарха головка виходила майже пласкою — нахил 12–16°, тобто грані
головки не відрізнялись від граней призми. Кварц тримає кут між призмою
й ромбоедром біля 141.8° хай якої довжини призма, звідки й 52°.
"""

FACE_OFFSETS = (1.00, 0.82, 0.95, 1.00, 0.82, 0.95)
"""
Відстань від осі до кожної з шести граней призми, частками найбільшої.

Грані НЕРІВНІ — це головна ознака вирослого кристала проти виточеного.
Нерівність куплена саме зсувом площин, а не поворотом: дві грані,
розвернуті на 22°, — це дві грані, що ловлять те саме світло, тоді як
зсунута площина міняє ширину, не міняючи, куди вона дивиться.

Візерунок повторюється через три грані, бо кварц тримає тризгортову
симетрію: протилежні грані рівні, сусідні — ні.
"""

BURIED_SHARE = 0.18
"""Частка висоти монарха, схована в породі нижче дна порожнини."""

GEODE_WALL_SHARE = 0.34
"""
Висота породи над підошвою монарха, часткою його висоти.

Це і є число, заради якого все: **дві третини кристала стоять над
породою, третина в ній**. Тарілка під кристалом дає нуль, п'єдестал —
теж нуль, бо він не порода, а підставка. 0.34 узято з еталонних кластерів
(`stalagmite ore cluster`, `low_poly_dirt_crystals`): порода підіймається
кристалові десь до третини, і рівно тому він читається таким, що ВИЛІЗ, а
не таким, що поставлений.
"""

GEODE_MOUTH_SHARE = 1.9
"""Внутрішній радіус порожнини, у радіусах монарха."""

GEODE_OUTER_SHARE = 2.6
"""Зовнішній радіус породи, у радіусах монарха."""

GEODE_FLOOR_SHARE = 0.30
"""Наскільки порода йде НИЖЧЕ підошви монарха, часткою його висоти."""

GEODE_BREAK_COUNT = 3
GEODE_BREAK_DEPTH = 0.55
"""
Розломи в стінці. Три, розставлені насінням, а не через 120°: три
однакові виїмки читаються як деталь моделі, а не як розкол породи.
"""

GEODE_RIM_RAGGED = 0.32
"""
Наскільки рваний вінець: найнижча точка гребеня між розломами стоїть на
цю частку нижче найвищої.

Без цього числа порода з рівним верхом читається ЧАШЕЮ — посудиною, у яку
кристал поставили, — і жоден інший розмір цього не рятує. Множник завжди
≤ 1, щоб `GEODE_WALL_SHARE` лишався тим, що виміряється: інакше вінець
подекуди вилазив би вище оголошеного, і мірка перестала б означати
оголошене.
"""

DRUSE_COUNT = 15
DRUSE_MAX_SHARE = 0.26
"""
Друза — дрібні кристали на дні порожнини, найбільший у чверть монарха.

Вони не декорація: саме вони кажуть, що порожнина ЖЕОДА, а не ямка. У
всіх еталонних кластерах дрібні кристали тиснуться біля підніжжя
великого, і глядач читає масштаб із них.
"""

SEED = 20221226
"""Дата початку стосунків пари. Насіння стале — інакше мірка пливе."""

AZIMUTH_SEGMENTS = 30
"""Скільки граней має порода по колу. Мало — бо камінь ламається пласко."""


# ── ПОХІДНІ ──────────────────────────────────────────────────
# Виводяться з оголошеного, а не оголошуються самі: інакше файл міг би
# суперечити сам собі.

TERMINATION_RISE = math.tan(math.radians(TERMINATION_ANGLE))
"""Підйом головки на одиницю відстані від осі до грані."""

OFFSET_BASE = HEIGHT / (2.0 * PRISM_ASPECT + TERMINATION_RISE)
"""Відстань від осі до найширшої грані призми (радіус вписаного кола)."""

PRISM_LENGTH = 2.0 * PRISM_ASPECT * OFFSET_BASE
APEX_RISE = TERMINATION_RISE * OFFSET_BASE
CRYSTAL_RADIUS = OFFSET_BASE / math.cos(math.pi / 6.0)
"""Радіус описаного кола — саме його бачить силует."""


def corner_ring(offsets, scale=1.0):
    """
    Кути шестикутного перерізу з відстаней до граней.

    Грань `i` — пряма `n_i·p = d_i` з нормаллю на азимуті `i·60°`. Кут між
    гранями `i` та `i+1` — точка, що лежить на обох. Так нерівні відстані
    дають нерівні грані, а не просто зміщений шестикутник.
    """
    points = []
    for index in range(6):
        first = math.radians(index * 60.0)
        second = math.radians((index + 1) * 60.0)
        d_first = offsets[index] * scale
        d_second = offsets[(index + 1) % 6] * scale
        # Розв'язок системи двох прямих; знаменник — синус кута між
        # нормалями, для шестикутника завжди sin60°.
        det = math.cos(first) * math.sin(second) - math.sin(first) * math.cos(second)
        x = (d_first * math.sin(second) - d_second * math.sin(first)) / det
        y = (d_second * math.cos(first) - d_first * math.cos(second)) / det
        points.append((x, y))
    return points


def build_crystal(bm, offsets, height, apex_rise, prism_length, base_z, lean=0.0, bearing=0.0):
    """
    Одне кварцове тіло: нерівна призма плюс шестигранна головка.

    Голова сходиться у ВІСТРЯ, а не в площинку. Зрізана верхівка — це
    зламаний кристал, і в еталоні вона брехала б про форму, яку ми
    вимагаємо від генератора.
    """
    ring = corner_ring(offsets)

    def place(x, y, z):
        """
        Точка тіла у світі, з нахилом навколо ГОРИЗОНТАЛЬНОЇ осі.

        Формула Родрігеса, згорнута під те, що вісь горизонтальна
        (`k = (ax, ay, 0)`): монарх стоїть прямо (`lean = 0`), дрібні
        кристали друзи відхиляються від центру порожнини, як і в кожному
        справжньому кластері.
        """
        if lean == 0.0:
            return Vector((x, y, base_z + z))
        ax, ay = math.cos(bearing), math.sin(bearing)
        c, s = math.cos(lean), math.sin(lean)
        dot = ax * x + ay * y
        return Vector((
            x * c + ay * z * s + ax * dot * (1.0 - c),
            y * c - ax * z * s + ay * dot * (1.0 - c),
            base_z + z * c + (ax * y - ay * x) * s,
        ))

    bottom = [bm.verts.new(place(x, y, 0.0)) for x, y in ring]
    shoulder = [bm.verts.new(place(x, y, prism_length)) for x, y in ring]
    apex = bm.verts.new(place(0.0, 0.0, prism_length + apex_rise))

    for index in range(6):
        nxt = (index + 1) % 6
        bm.faces.new((bottom[index], bottom[nxt], shoulder[nxt], shoulder[index]))
        bm.faces.new((shoulder[index], shoulder[nxt], apex))
    # Підошва закрита: вона в породі, але меш мусить лишатись тілом.
    bm.faces.new(tuple(reversed(bottom)))
    return height


def geode_outline(rng):
    """
    Контур породи по азимуту: внутрішній радіус, зовнішній і висота вінця.

    Нерівність тут не шум заради шуму. Рівне кільце читається шайбою, і
    саме тому попередня жеода (`GEODE_WALL_HEIGHT = 0.026`) виглядала
    швом, а не породою: вона була рівна І низька.
    """
    inner_base = GEODE_MOUTH_SHARE * CRYSTAL_RADIUS
    outer_base = GEODE_OUTER_SHARE * CRYSTAL_RADIUS
    wall_top = GEODE_WALL_SHARE * HEIGHT
    breaks = sorted(rng.random() * math.tau for _ in range(GEODE_BREAK_COUNT))

    rows = []
    for step in range(AZIMUTH_SEGMENTS):
        angle = (step / AZIMUTH_SEGMENTS) * math.tau
        openness = 0.0
        for where in breaks:
            delta = abs(((angle - where + math.pi) % math.tau) - math.pi)
            openness = max(openness, max(0.0, 1.0 - delta / 0.55))
        ragged = 1.0 - GEODE_RIM_RAGGED * rng.random()
        top = wall_top * ragged * (1.0 - GEODE_BREAK_DEPTH * openness ** 2)
        inner = inner_base * (0.90 + 0.20 * rng.random())
        outer = outer_base * (0.86 + 0.28 * rng.random())
        rows.append((angle, inner, max(outer, inner * 1.25), top))
    return rows


GEODE_NODULE: tuple[tuple[float, float], ...] = (
    (0.00, 0.40), (0.26, 0.79), (0.56, 1.00), (0.82, 0.96), (1.00, 0.84),
)
"""
Зовнішній бік породи: (частка висоти, множник радіуса).

ЧОМУ НЕ ПРЯМА СТІНКА. Перша редакція давала зовнішньому боку сталий
радіус — і на першому ж кадрі порода прочиталась ГОРЩИКОМ: рівний
циліндр, у який поставили кристал. Тобто еталон ніс би саме ту ваду,
яку мусить ловити в нас, і мірка визнала б наш п'єдестал нормою.

Жеода — це конкреція: округла ґуля, розколена зверху. Профіль
підбирається донизу й підбирається до вінця, а найширший — трохи нижче
середини.
"""


def build_geode(bm, rows):
    """Порода: дно порожнини, внутрішня стінка, вінець і зовнішня ґуля."""
    floor_z = BURIED_SHARE * HEIGHT
    bottom_z = -GEODE_FLOOR_SHARE * HEIGHT

    centre = bm.verts.new(Vector((0.0, 0.0, floor_z)))
    under = bm.verts.new(Vector((0.0, 0.0, bottom_z)))
    inner, rim_inner = [], []
    outer_rows = [[] for _ in GEODE_NODULE]
    for angle, in_r, out_r, top in rows:
        cos, sin = math.cos(angle), math.sin(angle)
        inner.append(bm.verts.new(Vector((cos * in_r, sin * in_r, floor_z))))
        rim_inner.append(bm.verts.new(Vector((cos * in_r, sin * in_r, top))))
        rim_z = top * 0.82
        for index, (share, factor) in enumerate(GEODE_NODULE):
            radius = out_r * factor
            height = bottom_z + (rim_z - bottom_z) * share
            outer_rows[index].append(
                bm.verts.new(Vector((cos * radius, sin * radius, height))),
            )

    count = len(rows)
    top_row = outer_rows[-1]
    for index in range(count):
        nxt = (index + 1) % count
        bm.faces.new((centre, inner[index], inner[nxt]))
        bm.faces.new((inner[index], rim_inner[index], rim_inner[nxt], inner[nxt]))
        bm.faces.new((rim_inner[index], top_row[index], top_row[nxt], rim_inner[nxt]))
        for level in range(len(GEODE_NODULE) - 1, 0, -1):
            upper, lower = outer_rows[level], outer_rows[level - 1]
            bm.faces.new((upper[index], lower[index], lower[nxt], upper[nxt]))
        bm.faces.new((under, outer_rows[0][nxt], outer_rows[0][index]))


def build_druse(bm, rng, rows):
    """Дрібні кристали на дні порожнини, нахилені від центру."""
    floor_z = BURIED_SHARE * HEIGHT
    inner_min = min(row[1] for row in rows)
    for index in range(DRUSE_COUNT):
        angle = (index / DRUSE_COUNT) * math.tau + (rng.random() - 0.5) * 0.4
        # Між підніжжям монарха й стінкою: кристалик, що стоїть на
        # монархові, — не друза, а помилка.
        span = rng.random()
        radius = CRYSTAL_RADIUS * 1.25 + (inner_min * 0.86 - CRYSTAL_RADIUS * 1.25) * span
        share = 0.08 + (DRUSE_MAX_SHARE - 0.08) * rng.random()
        offsets = tuple(value * (0.86 + 0.28 * rng.random()) for value in FACE_OFFSETS)
        scale = share
        bm_offsets = tuple(value * OFFSET_BASE * scale for value in offsets)
        lean = math.radians(8.0 + 26.0 * rng.random())
        cos, sin = math.cos(angle), math.sin(angle)
        sub = bmesh.new()
        build_crystal(
            sub, bm_offsets, HEIGHT * scale,
            APEX_RISE * scale, PRISM_LENGTH * scale, 0.0,
            lean=lean, bearing=angle + math.pi / 2.0,
        )
        sub.verts.index_update()
        # Без `index_update` кожен `vert.index` дорівнює −1, жодна грань
        # не будується, і експортер тихо викидає порожній меш. Спіймано
        # на першому ж прогоні: «ReferenceDruse has no primitives».
        lookup = [
            bm.verts.new(Vector((
                vert.co.x + cos * radius,
                vert.co.y + sin * radius,
                vert.co.z + floor_z,
            )))
            for vert in sub.verts
        ]
        for face in sub.faces:
            bm.faces.new(tuple(lookup[vert.index] for vert in face.verts))
        sub.free()


def emit(name, bm):
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    mesh.calc_loop_triangles()
    return mesh


def build() -> str:
    rng = random.Random(SEED)
    bpy.ops.wm.read_factory_settings(use_empty=True)

    monarch = bmesh.new()
    build_crystal(
        monarch,
        tuple(value * OFFSET_BASE for value in FACE_OFFSETS),
        HEIGHT, APEX_RISE, PRISM_LENGTH, 0.0,
    )
    crystal_mesh = emit('ReferenceCrystal', monarch)

    rows = geode_outline(rng)
    rock = bmesh.new()
    build_geode(rock, rows)
    geode_mesh = emit('ReferenceGeode', rock)

    druse = bmesh.new()
    build_druse(druse, rng, rows)
    druse_mesh = emit('ReferenceDruse', druse)

    out = os.path.join(
        os.path.dirname(os.path.abspath(__file__)), 'reference', 'crystal-geode.glb',
    )
    os.makedirs(os.path.dirname(out), exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', export_yup=True)
    return out, crystal_mesh, geode_mesh, druse_mesh


if __name__ == '__main__':
    path, crystal_mesh, geode_mesh, druse_mesh = build()
    data = open(path, 'rb').read()
    total = sum(len(m.loop_triangles) for m in (crystal_mesh, geode_mesh, druse_mesh))
    print(f'еталон       {path}')
    print(f'монарх       висота {HEIGHT:.2f}, радіус {CRYSTAL_RADIUS:.3f}, '
          f'стрункість {HEIGHT / (2 * CRYSTAL_RADIUS):.2f}')
    print(f'плече        {PRISM_LENGTH / HEIGHT:.3f} висоти, головка {APEX_RISE / HEIGHT:.3f}')
    print(f'порода       вінець {GEODE_WALL_SHARE:.2f} висоти, '
          f'ширина {GEODE_OUTER_SHARE:.2f} радіуса монарха')
    print(f'трикутників  {total}')
    print(f'GLB          {len(data)} байт, sha256 {hashlib.sha256(data).hexdigest()[:16]}')
