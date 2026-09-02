#!/usr/bin/env python3
# ============================================================
# ЕТАЛОННЕ ДЕРЕВО — мірка, а не асет.
# ------------------------------------------------------------
# Досі еталоном дерева були КАРТИНКИ: п'ять моделей, які власник колись
# надіслав, розібрані в `amore-tree-look` на прозу. З прози не дістати ні
# силуету числом, ні висоти, на якій крона найширша, ні того, скільки
# стовбура видно до першої гілки. Тому кожна скарга власника — «замале»,
# «більше на кущ схоже», «ширина крони гуляє» — впиралась у те, що
# порівнювати не було з чим.
#
# Це дерево не потрапляє в портал і ніколи не потрапить. Воно існує рівно
# для того, щоб `scripts/models/measure-tree.mjs` дістав із нього сім
# чисел, і генератор виміряли проти них.
#
# ЧОМУ СКРИПТ, А НЕ ЛІПЛЕННЯ РУКАМИ. Виліплене дерево — це моя думка про
# дерево, і сперечатись із нею нема як. Скрипт тримає СВОЇ ЧИСЛА зверху
# файла названими: власник міняє одне число, перезапускає, і мірка стає
# інша. Плюс детермінізм — два прогони дають побайтово однаковий GLB
# (перевірено), тож мірка не пливе між запусками.
#
#   python3 -m pip install bpy
#   python3 scripts/models/reference-tree.py
#
# ЗВІДКИ ЧИСЛА. Дерево пари стоїть САМО на лузі, а не в лісі — це різні
# форми, і плутати їх не можна: лісове тягнеться вгору й тримає крону
# вузькою під чужими кронами, а вільне розкидається вшир. Усе нижче — про
# вільне листяне дерево, і кожне число написане з тим, що воно означає.
# ============================================================
import hashlib
import math
import os
import random
import sys

try:
    import bpy
    import bmesh
    from mathutils import Vector, Matrix
except ImportError:  # pragma: no cover — скрипт запускають лише з bpy
    sys.exit('Немає bpy. Постав: python3 -m pip install bpy')


# ── ЧИСЛА ЕТАЛОНА ────────────────────────────────────────────
# Кожне — частка ВИСОТИ, крім самої висоти. Так мірка лишається
# безрозмірною: порівнювати можна дерево 12 метрів і дерево 2.7 одиниці
# сцени, не переводячи нічого.

HEIGHT = 12.0
"""Повний зріст, метри. Те саме число, що `TREE_MATURE_HEIGHT_METRES`."""

CLEAR_BOLE = 0.28
"""
Скільки стовбура видно до першої скелетної гілки.

Вільне дерево гілкується НИЗЬКО — крона починається на чверті-третині
зросту; лісове тримає чистий стовбур на дві третини, бо нижні гілки
відмирають у тіні сусідів. Наше стоїть саме, тож 0.28.
"""

CROWN_SPREAD = 0.85
"""
Ширина крони як частка зросту.

Вільне листяне дерево розкидається майже на свій зріст. 0.85 — усередині
того, що дають дорослі поодинокі дуби й клени, і свідомо не 1.0: ширша за
власний зріст крона впирається в `ARTIFACT_FIT_WIDTH` кадру.
"""

WIDEST_AT = 0.60
"""
На якій висоті крона найширша.

Не посередині: маса листяної крони сидить у верхній половині, бо нижні
гілки старші, довші, але вже затінені власною верхівкою. 0.60 дає форму
гриба-переростка, а не кулі й не конуса.
"""

CROWN_BOTTOM = 0.30
CROWN_TOP = 1.0
"""Де крона починається й де кінчається — від першої гілки до верхівки."""

TRUNK_BASE_RADIUS = 0.020
"""
Радіус стовбура біля землі, частка зросту.

12 м на 0.020 дає 0.24 м радіуса, тобто стовбур діаметром майже пів
метра. Відношення зросту до діаметра тут 25 — саме таким кремезним і
буває вільне дерево; лісове дає 60-80 і виглядає жердиною.
"""

TRUNK_TAPER = 0.28
"""Радіус на верхівці як частка нижнього — стовбур сходить нанівець."""

ROOT_FLARE = 1.9
"""Наскільки комель ширший за стовбур на висоті грудей."""

SCAFFOLDS = 6
"""Скелетних гілок від стовбура. Менше — читається виделкою, більше — мітлою."""

TIERS = 5
"""
Ярусів листя — тепер це АМПЛІТУДА горбкуватості оболонки, а не окремі кулі.

БУЛО ТРИ ОКРЕМІ КУЛІ, І ЦЕ ЛАМАЛО САМУ МІРКУ. Крона складалась із трьох
кілець кульок плюс шапки. Куля — це еліпсоїд: біля свого верху й низу вона
сходить у точку, тож МІЖ кільцями огинальна провалювалась. Виміряно у
верхній чверті: 0.40, 0.29, 0.38, 0.23, 0.35, 0.13 — пилка з розмахом у
30%. Проти такої сходинки неможливо судити, чи сходиться крона в НАШОГО
дерева: половина різниці була б шумом еталона, а не формою. Шість кілець
замість трьох пилку не прибрали — вона просто стала частішою.

Тепер крона — ОБОЛОНКА ОБЕРТАННЯ за тим самим профілем, який оголошено
вгорі (`CROWN_SPREAD`, `WIDEST_AT`), із горбами по висоті й по азимуту.
Мірка бере максимальний радіус смуги, тобто саме огинальну, і тепер
огинальна є рівно тим, що файл про себе каже.

Просвіти між ярусами від цього не зникають як ідея — вони лишаються в
горбах оболонки, — але вони й не могли б бути виміряні силуетом: силует
бачить зовнішній край, а не діри всередині крони.
"""

PIPE_EXPONENT = 2.0
"""
Правило да Вінчі: сума квадратів радіусів дочірніх гілок дорівнює
квадрату радіуса батьківської. Той самий закон, який рушій уже рахує
(`pipeExponent`), тож еталон і генератор міряються тим самим.
"""

SEED = 20221226
"""Дата початку стосунків пари. Насіння стале — інакше мірка пливе."""

TRUNK_SEGMENTS = 14
BRANCH_SEGMENTS = 8
FOLIAGE_SUBDIVISIONS = 2


# ── ПОБУДОВА ─────────────────────────────────────────────────

def taper_tube(bm, path, radii, ring=8):
    """
    Труба вздовж ламаної зі змінним радіусом.

    Кільця орієнтуються за напрямком сегмента, а не за світовими осями:
    інакше на гілці, що йде вбік, труба сплющується в стрічку.
    """
    rings = []
    up = Vector((0.0, 0.0, 1.0))
    for index, point in enumerate(path):
        nxt = path[min(index + 1, len(path) - 1)]
        prv = path[max(index - 1, 0)]
        direction = (nxt - prv)
        if direction.length < 1e-6:
            direction = up.copy()
        direction.normalize()
        side = direction.cross(up)
        if side.length < 1e-4:
            side = direction.cross(Vector((1.0, 0.0, 0.0)))
        side.normalize()
        other = direction.cross(side).normalized()
        radius = radii[index]
        verts = []
        for step in range(ring):
            angle = (step / ring) * math.tau
            offset = side * (math.cos(angle) * radius) + other * (math.sin(angle) * radius)
            verts.append(bm.verts.new(point + offset))
        rings.append(verts)

    for index in range(len(rings) - 1):
        lower, upper = rings[index], rings[index + 1]
        for step in range(ring):
            nxt = (step + 1) % ring
            bm.faces.new((lower[step], lower[nxt], upper[nxt], upper[step]))
    return rings


def crown_radius_at(height_share: float) -> float:
    """
    Профіль крони — рівно те, що оголошено вгорі файла.

    Найширше місце на `WIDEST_AT`, звідти звуження в обидва боки; показник
    1.7 робить спад догори крутішим за спад донизу, як у листяної крони,
    що сходить на верхівці й тримає ширину під собою.
    """
    if height_share < CROWN_BOTTOM or height_share > CROWN_TOP:
        return 0.0
    span = max(WIDEST_AT - CROWN_BOTTOM, CROWN_TOP - WIDEST_AT)
    falloff = 1.0 - min(1.0, abs(height_share - WIDEST_AT) / span) ** 1.7
    return CROWN_SPREAD * HEIGHT * 0.5 * falloff


def crown_shell(bm, rng):
    """
    Оболонка крони — поверхня обертання за профілем, із горбами.

    Горби двох родів: по ВИСОТІ (яруси, `TIERS`) і по АЗИМУТУ, плюс дрібний
    шум на кожній вершині. Без них оболонка була б ідеальним тілом обертання
    й читалась би кулею, а не кроною; з ними огинальна лишається тим, що
    оголошено, і при цьому не гладенькою.
    """
    rings = 26
    segments = 20
    grid = []
    for ring in range(rings + 1):
        t = ring / rings
        share = CROWN_BOTTOM + (CROWN_TOP - CROWN_BOTTOM) * t
        base = crown_radius_at(share)
        row = []
        for segment in range(segments):
            angle = (segment / segments) * math.tau
            # Горби тільки ВСЕРЕДИНУ (множники ≤ 1): інакше вони піднімають
            # максимум смуги, і виміряна ширина перестає дорівнювати
            # оголошеній — а саме її еталон і мусить давати.
            tier = 1.0 - 0.10 * (0.5 - 0.5 * math.cos(share * math.tau * TIERS))
            lobe = 1.0 - 0.09 * (0.5 - 0.5 * math.cos(angle * 3.0 + share * 5.0))
            grain = 1.0 - rng.random() * 0.06
            radius = base * tier * lobe * grain
            row.append(bm.verts.new(Vector((
                math.cos(angle) * radius,
                math.sin(angle) * radius,
                share * HEIGHT,
            ))))
        grid.append(row)

    for ring in range(rings):
        lower, upper = grid[ring], grid[ring + 1]
        for segment in range(segments):
            nxt = (segment + 1) % segments
            try:
                bm.faces.new((lower[segment], lower[nxt], upper[nxt], upper[segment]))
            except ValueError:
                pass  # виродилась у лінію на самій верхівці — не біда, це мірка


def build() -> str:
    rng = random.Random(SEED)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bm = bmesh.new()

    base_radius = TRUNK_BASE_RADIUS * HEIGHT
    top_radius = base_radius * TRUNK_TAPER

    # --- стовбур -------------------------------------------------
    trunk_path, trunk_radii = [], []
    for step in range(TRUNK_SEGMENTS + 1):
        t = step / TRUNK_SEGMENTS
        y = t * HEIGHT
        radius = base_radius + (top_radius - base_radius) * t
        # Комель: різке потовщення в найнижчій десятині.
        if t < 0.10:
            radius *= 1.0 + (ROOT_FLARE - 1.0) * (1.0 - t / 0.10) ** 2
        trunk_path.append(Vector((0.0, 0.0, y)))
        trunk_radii.append(radius)
    taper_tube(bm, trunk_path, trunk_radii, ring=10)

    # --- скелетні гілки ------------------------------------------
    # Радіус кожної — з правила да Вінчі: SCAFFOLDS гілок ділять переріз
    # стовбура на місці відходу.
    scaffold_radius = base_radius / (SCAFFOLDS ** (1.0 / PIPE_EXPONENT))
    tips = []
    for index in range(SCAFFOLDS):
        share = index / SCAFFOLDS
        azimuth = share * math.tau + (rng.random() - 0.5) * 0.35
        # Нижні гілки відходять від стовбура нижче й лягають положистіше.
        start_t = CLEAR_BOLE + (CROWN_TOP - 0.12 - CLEAR_BOLE) * share
        elevation = math.radians(58.0 - 26.0 * (1.0 - share))
        # Виліт по горизонталі, а не довжина: саме він робить ширину крони.
        reach = CROWN_SPREAD * HEIGHT * 0.5 * (0.62 + 0.38 * (1.0 - abs(start_t - WIDEST_AT) * 2.2))
        reach = max(reach, CROWN_SPREAD * HEIGHT * 0.22)

        origin = Vector((0.0, 0.0, start_t * HEIGHT))
        direction = Vector((
            math.cos(azimuth) * math.cos(elevation),
            math.sin(azimuth) * math.cos(elevation),
            math.sin(elevation),
        ))
        def arc(span_reach: float):
            points = []
            for step in range(BRANCH_SEGMENTS + 1):
                t = step / BRANCH_SEGMENTS
                # Дуга: гілка виходить угору й вирівнюється — так вона несе
                # власну вагу, і так вона виглядає на кожному живому дереві.
                rise = math.sin(elevation) * (1.0 - t * 0.55)
                horizontal = span_reach * t / max(1e-6, math.cos(elevation))
                points.append(origin + Vector((
                    direction.x * horizontal,
                    direction.y * horizontal,
                    rise * horizontal * 0.9,
                )))
            return points

        """
        ГІЛКА НЕ ВИХОДИТЬ ЗА ОГОЛОШЕНУ КРОНУ, і це не косметика.

        Перша редакція давала верхній скелетній гілці виліт 0.31 висоти й
        підйом майже до маківки — тобто саме той плаский зріз угорі, який
        еталон мусить ЛОВИТИ в нашому дереві. Мірка тоді читала б власну
        ваду еталона як норму.

        Тут виліт підтягується так, щоб кінчик сів усередину профілю крони
        на власній висоті. Дві ітерації, бо підйом сам залежить від вильоту.
        """
        for _ in range(2):
            tip = arc(reach)[-1]
            allowed = crown_radius_at(tip.z / HEIGHT) * 0.92
            radial = math.hypot(tip.x, tip.y)
            if radial > allowed > 0:
                reach *= allowed / radial
        path = arc(reach)
        radii = [scaffold_radius * (1.0 - 0.82 * (step / BRANCH_SEGMENTS))
                 for step in range(BRANCH_SEGMENTS + 1)]
        taper_tube(bm, path, radii, ring=6)
        tips.append((path[-1], scaffold_radius * 0.18, share))

    # --- листя оболонкою -----------------------------------------
    crown_shell(bm, rng)

    mesh = bpy.data.meshes.new('ReferenceTree')
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new('ReferenceTree', mesh)
    bpy.context.scene.collection.objects.link(obj)

    # Blender тримає Z угору, glTF — Y. Експортер повертає сам; лишаємо
    # як є, а мірка читає вже повернутий GLB.
    out = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'reference', 'tree-40y.glb')
    os.makedirs(os.path.dirname(out), exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', export_yup=True)
    return out


if __name__ == '__main__':
    path = build()
    data = open(path, 'rb').read()
    mesh = bpy.data.meshes['ReferenceTree']
    mesh.calc_loop_triangles()
    print(f'еталон      {path}')
    print(f'трикутників {len(mesh.loop_triangles)}, вершин {len(mesh.vertices)}')
    print(f'GLB         {len(data)} байт, sha256 {hashlib.sha256(data).hexdigest()[:16]}')
