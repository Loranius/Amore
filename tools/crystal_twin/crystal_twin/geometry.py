"""Геометрія з моделі: пласкі грані, опора — лише жеода.

Кожне тіло — шестигранна призма з ярусною вершиною. Кожен ярус — це
кільце, стиснуте до осі й зсунуте до вершини: ребро кільця j і те саме ребро
кільця j+1 паралельні, тож кожна грань ПЛАСКА за побудовою, а не за
перевіркою. Нерівність дає не шум, а різні кут і відстань кожної грані.

Основа кожного тіла заглиблена в жеоду: зрізу знизу не видно ні збоку, ні
з-під низу, бо його немає над породою (правило цілісності кріплення).
"""
from __future__ import annotations

import math
from typing import Any

import numpy as np

from .hashing import unit


# Веретено, а не стовп: нижнє кільце — FOOT плеча (еталон
# low_poly_dirt_crystals; те саме, що в `geometry.ts`). Фаски немає.
FOOT = 0.72  # 2026-10-06: призма майже паралельна, як у кварцу


def _ring(sides: list[list[float]]) -> np.ndarray:
    pts = []
    for angle, reach in sides:
        a = math.radians(angle)
        pts.append([math.cos(a) * reach, 0.0, math.sin(a) * reach])
    return np.array(pts)


TRI = (True, True, True)


def _clip_half(poly, f):
    """Як `clipHalf` у `geometry.ts`: частина многокутника, де f ≤ 0."""
    out = []
    m = len(poly)
    for i in range(m):
        cur = poly[i]
        prev = poly[(i + m - 1) % m]
        fc = f(cur[0], cur[1])
        fp = f(prev[0], prev[1])

        def cross():
            t = fp / (fp - fc)
            return (prev[0] + (cur[0] - prev[0]) * t, prev[1] + (cur[1] - prev[1]) * t)

        if fc <= 0:
            if fp > 0:
                out.append(cross())
            out.append(cur)
        elif fp <= 0:
            out.append(cross())
    k = len(out)
    return [p for i, p in enumerate(out)
            if k < 2 or math.hypot(p[0] - out[(i + k - 1) % k][0], p[1] - out[(i + k - 1) % k][1]) > 1e-9]


def _plane_y(p, x, z):
    return p[0] + p[1] * x + p[2] * z


def termination(seed, tag, ring, sides, apex, height, crown_height, contrast, facets):
    """Вершина з площин — як `termination` у `geometry.ts` (ADR-0260).
    Повертає (roof_at, faces): висоту даху й многокутники граней."""
    n = len(sides)
    planes, slopes = [], []
    for i in range(n):
        p = ring[sides[i]]
        q = ring[sides[(i + 1) % n]]
        nx = float(q[2] - p[2])
        nz = float(-(q[0] - p[0]))
        length = math.hypot(nx, nz)
        nx /= length
        nz /= length
        mx = float((p[0] + q[0]) / 2 - apex[0])
        mz = float((p[2] + q[2]) / 2 - apex[1])
        if nx * mx + nz * mz < 0:
            nx, nz = -nx, -nz
        turn = (unit(seed, f"{tag}:roof{i}:turn") - 0.5) * 22 * math.pi / 180
        dx = nx * math.cos(turn) - nz * math.sin(turn)
        dz = nx * math.sin(turn) + nz * math.cos(turn)
        reach = max(1e-6, mx * dx + mz * dz)
        sign = 1 if i % 2 == 0 else -1
        factor = 1 + sign * contrast + 0.16 * (unit(seed, f"{tag}:roof{i}:tilt") - 0.5)
        t = (crown_height / reach) * factor
        slopes.append(t)
        planes.append((height + t * (apex[0] * dx + apex[1] * dz), -t * dx, -t * dz))

    def main_roof(x, z):
        return min(_plane_y(p, x, z) for p in planes)

    mean = sum(slopes) / n
    order = sorted(((v, i, unit(seed, f"{tag}:facet{i}:rank")) for i, v in enumerate(sides)), key=lambda e: e[2])
    for v, i, _ in order[:max(0, min(n, facets))]:
        c = ring[v]
        dx = float(c[0] - apex[0])
        dz = float(c[2] - apex[1])
        length = math.hypot(dx, dz)
        dx /= length
        dz /= length
        drop = crown_height * (0.07 + 0.1 * unit(seed, f"{tag}:facet{i}:drop"))
        y = main_roof(float(c[0]), float(c[2])) - drop
        g = mean * (1.25 + 0.3 * unit(seed, f"{tag}:facet{i}:slope"))
        g = max(g, ((height - y) / length) * 1.15)
        planes.append((y + g * (float(c[0]) * dx + float(c[2]) * dz), -g * dx, -g * dz))

    def roof_at(x, z):
        return min(_plane_y(p, x, z) for p in planes)

    base = [(float(p[0]), float(p[2])) for p in ring]
    faces = []
    for k, own in enumerate(planes):
        poly = base
        for j, other in enumerate(planes):
            if j == k or len(poly) < 3:
                continue
            poly = _clip_half(poly, lambda x, z, own=own, other=other: _plane_y(own, x, z) - _plane_y(other, x, z))
        if len(poly) < 3:
            continue
        area = 0.0
        for i in range(len(poly)):
            a, b = poly[i], poly[(i + 1) % len(poly)]
            area += a[0] * b[1] - b[0] * a[1]
        if abs(area) < 1e-7 * crown_height * crown_height:
            continue
        faces.append([np.array([x, roof_at(x, z), z]) for x, z in poly])
    return roof_at, faces


# Тонова група граней вершини — як `ROOF_SHADE`.
ROOF_SHADE = 100000


def roof_tris(shaft_faces, rings, roof_faces, inside, first_face, shade_base):
    """Як `roofTris` у `geometry.ts`: грані вершини віялом і стінки призми
    над верхнім кільцем до лінії даху."""
    top = rings[-1]
    n = len(top)
    tiers = len(rings) - 1

    def facing(a, b, c):
        nrm = np.cross(b - a, c - a)
        return (a, b, c) if np.dot(nrm, (a + b + c) / 3 - inside) >= 0 else (a, c, b)

    out = []
    face = first_face
    for k, poly in enumerate(roof_faces):
        for i in range(1, len(poly) - 1):
            out.append((np.array(facing(poly[0], poly[i], poly[i + 1])), face, TRI, shade_base + k))
            face += 1
    corners = [p for poly in roof_faces for p in poly]
    for i in range(n):
        a = top[i]
        b = top[(i + 1) % n]
        ex = b[0] - a[0]
        ez = b[2] - a[2]
        len2 = ex * ex + ez * ez
        hits = []
        for p in corners:
            t = ((p[0] - a[0]) * ex + (p[2] - a[2]) * ez) / len2
            off = abs((p[0] - a[0]) * ez - (p[2] - a[2]) * ex) / math.sqrt(len2)
            if off < 1e-7 and 1e-6 < t < 1 - 1e-6:
                hits.append((t, p))
        hits.sort(key=lambda h: h[0])
        line = []
        for _, p in hits:
            if not any(math.hypot(q[0] - p[0], q[2] - p[2]) < 1e-7 for q in line):
                line.append(p)
        line.append(b)
        shade = shaft_faces[((tiers - 1) * n + i) * 2][3]
        for k in range(len(line) - 1):
            out.append((np.array(facing(a, line[k], line[k + 1])), face, TRI, shade))
            face += 1
    return out


CHILD_PROFILE = ((0.0, FOOT, (0.0, 0.0)), (0.5, (FOOT + 1) / 2, (0.0, 0.0)), (1.0, 1.0, (0.0, 0.0)))
CHILD_LEAN = 0.5
CHILD_STEP_OUT = 0.35


def _outward(a, b, c, face, edges, shade):
    """Як `outward` у `geometry.ts`: природний порядок дивиться всередину."""
    return (np.array([a, c, b]), face, (edges[0], edges[2], edges[1]), shade)


def broken_shaft(seed, tag, base, profile, y0, y1, radius, first_face, top_drop=()):
    """Стовбур — як `brokenShaft` у `geometry.ts`: ребра прямі, проміжні
    вершини на ребрі на своїй висоті, грань — чотирикутник одного тону."""
    n = len(base)
    last = len(profile) - 1
    f_at, f_scale, (fx, fz) = profile[0]
    t_at, t_scale, (tx, tz) = profile[last]
    span = y1 - y0
    last_gap = span * (t_at - profile[last - 1][0])
    foot_ring = [np.array([p[0] * f_scale + fx * radius, y0, p[2] * f_scale + fz * radius]) for p in base]
    top_ring = []
    for i, p in enumerate(base):
        key = f"{tag}:ring{last}:{i}"
        out = 1 + 0.06 * (unit(seed, f"{key}:r") - 0.5)
        lift = (unit(seed, f"{key}:y") - 0.5) * last_gap * 0.12
        drop = top_drop[i] if i < len(top_drop) else 0.0
        top_ring.append(np.array([p[0] * t_scale * out + tx * radius, y1 + lift - drop, p[2] * t_scale * out + tz * radius]))
    rings = [foot_ring]
    for k in range(1, last):
        at = profile[k][0]
        room = min(at - profile[k - 1][0], profile[k + 1][0] - at)
        ring = []
        for i in range(n):
            key = f"{tag}:ring{k}:{i}"
            t = at + (unit(seed, f"{key}:y") - 0.5) * room * 0.7
            f, u = foot_ring[i], top_ring[i]
            q = f + (u - f) * t
            ax = (fx + (tx - fx) * t) * radius
            az = (fz + (tz - fz) * t) * radius
            out = 1 + 0.04 * (unit(seed, f"{key}:r") - 0.5)
            ring.append(np.array([ax + (q[0] - ax) * out, q[1], az + (q[2] - az) * out]))
        rings.append(ring)
    rings.append(top_ring)
    lift_step = n + (2 if n % 3 == 2 else 1)
    faces = []
    face = first_face
    for k in range(last):
        lower, upper = rings[k], rings[k + 1]
        for i in range(n):
            j = (i + 1) % n
            li, lj, ui, uj = lower[i], lower[j], upper[i], upper[j]
            shade = first_face + k * lift_step + i
            if unit(seed, f"{tag}:diag{k}:{i}") < 0.5:
                faces.append(_outward(li, lj, uj, face, (True, False, True), shade))
                faces.append(_outward(li, uj, ui, face + 1, (True, True, False), shade))
            else:
                faces.append(_outward(li, lj, ui, face, (False, True, True), shade))
                faces.append(_outward(lj, uj, ui, face + 1, (True, False, True), shade))
            face += 2
    return faces, rings, max(face, first_face + last * lift_step)


def monarch_profile(seed):
    """Монарх — як `monarchProfile` у `geometry.ts`: бік — пряма від основи
    до плеча (проміжні кільця на прямій), плече зсунуте від осі."""
    def jitter(key, span):
        return (unit(seed, f"monarch:profile:{key}") - 0.5) * span
    foot = (0.0, 0.86, (0.0, 0.0))
    shoulder = (1.0, 0.97, (jitter("shoulder:x", 0.14), jitter("shoulder:z", 0.14)))

    def on(at):
        return (at, foot[1] + (shoulder[1] - foot[1]) * at, (shoulder[2][0] * at, shoulder[2][1] * at))
    return (foot, on(0.32 + jitter("belly:at", 0.08)), on(0.68 + jitter("upper:at", 0.06)), shoulder)


def year_habit(seed, tag):
    """Габітус кристала року — як `yearHabit` у `geometry.ts` (ADR-0260)."""
    return {
        "tip": 0.8 + 0.75 * unit(seed, f"{tag}:habit:tip"),
        "contrast": 0.12 + 0.2 * unit(seed, f"{tag}:habit:contrast"),
    }


def body(seed, tag, sides, height, tip, apex, ridge, bury, profile=CHILD_PROFILE) -> list[tuple]:
    """Кристал року з вершиною з площин — як `body` у `geometry.ts`
    (ADR-0260). Трикутники як (3×3 вершини, номер грані, які ребра
    справжні, тонова група)."""
    ring0 = _ring(sides)
    habit = year_habit(seed, tag)
    tip_height = min(tip * habit["tip"], height * 0.45)
    y0 = -bury
    y1 = height - tip_height
    radius = max(math.hypot(p[0], p[2]) for p in ring0)
    _, _, (shx, shz) = profile[-1]
    tip_at = (apex[0] + shx * radius, apex[1] + shz * radius)
    _, flat_rings, _ = broken_shaft(seed, tag, ring0, profile, y0, y1, radius, 0)
    top0 = flat_rings[-1]
    roof_at, roof_faces = termination(seed, tag, top0, list(range(len(ring0))), tip_at, height, tip_height,
                                      habit["contrast"], ridge)
    faces, rings, face = broken_shaft(seed, tag, ring0, profile, y0, y1, radius, 0,
                                      [float(p[1]) - roof_at(float(p[0]), float(p[2])) for p in top0])
    inside = np.array([tip_at[0], y1 - 0.2 * tip_height, tip_at[1]])
    return faces + roof_tris(faces, rings, roof_faces, inside, face, ROOF_SHADE)


def monarch_splits(seed, sides):
    """Як `monarchSplits` у `geometry.ts` (ADR-0258): ребро на кожній стороні —
    у нерівному місці й зі своїм зламом, тож циліндра немає."""
    return [True for _ in sides]


# Місце й злам додаткового ребра — як `SPLIT_T` і `SPLIT_FOLD` (ADR-0258).
SPLIT_T = (0.35, 0.65)
SPLIT_FOLD = (20.0, 28.0)


def split_point(a, b, t, fold_deg):
    """Як `splitPoint` у `geometry.ts`: ребро в місці `t` сторони, винесене
    назовні рівно настільки, щоб половини сторони зламались на `fold_deg`."""
    dx, dz = b[0] - a[0], b[2] - a[2]
    length = math.hypot(dx, dz)
    nx, nz = dz / length, -dx / length
    mx, mz = a[0] + dx * 0.5, a[2] + dz * 0.5
    if nx * mx + nz * mz < 0:
        nx, nz = -nx, -nz
    target = math.radians(fold_deg)

    def fold(h):
        return math.atan(h / (t * length)) + math.atan(h / ((1 - t) * length))

    lo, hi = 0.0, length
    for _ in range(40):
        mid = (lo + hi) / 2
        if fold(mid) < target:
            lo = mid
        else:
            hi = mid
    h = (lo + hi) / 2
    return np.array([a[0] + dx * t + nx * h, 0.0, a[2] + dz * t + nz * h])


def monarch_crown_height(height, tip):
    """Висота корони монарха — як `monarchCrownHeight` (ADR-0247)."""
    return min(0.3 * height, max(0.2 * height, tip * 1.2))


def monarch_body(seed, sides, height, tip, ridge, bury, profile):
    """Монарх як великий гранчастий кристал — те саме, що `monarchBody` у
    `geometry.ts`: стовбур у три пояси (ADR-0244, ADR-0245) і корона з
    площин (ADR-0260)."""
    corners = _ring(sides)
    n = len(corners)
    splits = monarch_splits(seed, sides)
    ring12, corner_at, split_at = [], [], []
    for i in range(n):
        a, b = corners[i], corners[(i + 1) % n]
        corner_at.append(len(ring12))
        ring12.append(a)
        if splits[i]:
            t = SPLIT_T[0] + (SPLIT_T[1] - SPLIT_T[0]) * unit(seed, f"monarch:split{i}:t")
            fold = SPLIT_FOLD[0] + (SPLIT_FOLD[1] - SPLIT_FOLD[0]) * unit(seed, f"monarch:split{i}:b")
            split_at.append(len(ring12))
            ring12.append(split_point(a, b, t, fold))
        else:
            split_at.append(-1)
    ring12 = np.array(ring12)
    y0 = -bury
    crown_height = monarch_crown_height(height, tip)
    y1 = height - crown_height
    radius = max(math.hypot(p[0], p[2]) for p in corners)
    _, _, (lx, lz) = profile[-1]
    apex = (lx * radius, lz * radius)
    _, flat_rings, _ = broken_shaft(seed, "monarch", ring12, profile, y0, y1, radius, 0)
    top0 = flat_rings[-1]
    roof_at, roof_faces = termination(seed, "monarch", top0, corner_at, apex, height, crown_height,
                                      0.2 + 0.1 * unit(seed, "monarch:roof:contrast"), max(1, ridge))
    faces, rings, face = broken_shaft(seed, "monarch", ring12, profile, y0, y1, radius, 0,
                                      [float(p[1]) - roof_at(float(p[0]), float(p[2])) for p in top0])
    inside = np.array([apex[0], y1 - 0.2 * crown_height, apex[1]])
    return faces + roof_tris(faces, rings, roof_faces, inside, face, ROOF_SHADE)


# Тон грані — з трьох (ADR-0244), як `FACE_TONES` у `geometry.ts`.
FACE_TONES = (0.74, 1.0, 1.3)


# Найменший злам, який око бачить ребром — як `FOLD_DEG` (ADR-0258).
FOLD_DEG = 12.0


def fold_facets(faces):
    """Як `foldFacets` у `geometry.ts` (ADR-0258): кант лише на зламах від
    `FOLD_DEG`; задумана межа тону (яруси стовбура) лишається; грані вершини,
    зламані менше за поріг, — одна грань; тон із трьох, сусіди різні, і
    пологий сусід важить квадрат косинуса злама."""
    def key(p):
        return ",".join(f"{float(x):.5f}" for x in p)

    normals = []
    for tri, _, _, _ in faces:
        n = np.cross(tri[1] - tri[0], tri[2] - tri[0])
        length = float(np.linalg.norm(n)) or 1.0
        normals.append(n / length)
    owners = {}
    for t, (tri, _, _, _) in enumerate(faces):
        for s in range(3):
            a, b = key(tri[(s + 1) % 3]), key(tri[(s + 2) % 3])
            k = f"{a}|{b}" if a < b else f"{b}|{a}"
            owners.setdefault(k, []).append((t, s))
    min_cos = math.cos(math.radians(FOLD_DEG))

    def group(t):
        shade = faces[t][3]
        return shade if shade is not None else -1 - faces[t][1]

    parent = list(range(len(faces)))

    def find(t):
        r = t
        while parent[r] != r:
            r = parent[r]
        while parent[t] != r:
            parent[t], t = r, parent[t]
        return r

    def join(a, b):
        ra, rb = find(a), find(b)
        if ra != rb:
            parent[max(ra, rb)] = min(ra, rb)

    first = {}
    for t in range(len(faces)):
        g = group(t)
        if g in first:
            join(first[g], t)
        else:
            first[g] = t
    folded = [list(f[2]) for f in faces]
    pairs = []
    for lst in owners.values():
        if len(lst) != 2:
            continue
        (t1, s1), (t2, s2) = lst
        cos = float(np.dot(normals[t1], normals[t2]))
        same = group(t1) == group(t2)
        fold = cos < min_cos and not same
        folded[t1][s1] = fold
        folded[t2][s2] = fold
        if not fold and not same and faces[t1][3] is None and faces[t2][3] is None:
            join(t1, t2)
        pairs.append((t1, t2, cos))
    facet = [find(t) for t in range(len(faces))]
    weights = {}
    for t1, t2, cos in pairs:
        f1, f2 = facet[t1], facet[t2]
        if f1 == f2:
            continue
        w = max(0.0, cos) ** 2
        for a, b in ((f1, f2), (f2, f1)):
            near = weights.setdefault(a, {})
            near[b] = max(near.get(b, 0.0), w)
    roots = list(dict.fromkeys(facet))
    tone = {}

    def clash(root, k):
        return sum(w for f, w in weights.get(root, {}).items() if tone.get(f) == k)

    def best_of(root, start, order):
        best = start
        for k in order:
            if clash(root, k) < clash(root, best) - 1e-9:
                best = k
        return best

    for root in roots:
        wanted = group(root) % 3 if group(root) >= 0 else faces[root][1] % 3
        order = [wanted, (wanted + 1) % 3, (wanted + 2) % 3]
        tone[root] = best_of(root, wanted, order)
    for _ in range(8):
        changed = False
        for root in roots:
            now = tone[root]
            if clash(root, now) == 0:
                continue
            better = best_of(root, now, [0, 1, 2])
            if better != now:
                tone[root] = better
                changed = True
        if not changed:
            break
    return [(tri, f, tuple(folded[t]), facet[t] * 3 + tone[facet[t]])
            for t, (tri, f, _, _) in enumerate(faces)]


def _rotate(points: np.ndarray, lean_deg: float, azimuth_deg: float) -> np.ndarray:
    """Нахил НАЗОВНІ від осі колонії: поворот навколо дотичної осі."""
    az = math.radians(azimuth_deg)
    lean = math.radians(lean_deg)
    out_dir = np.array([math.cos(az), 0.0, math.sin(az)])
    axis = np.cross(np.array([0.0, 1.0, 0.0]), out_dir)
    axis /= np.linalg.norm(axis)
    # Родрігес: +lean відхиляє вісь Y у бік out_dir.
    k = axis
    c, s = math.cos(lean), math.sin(lean)
    kx = np.array([[0, -k[2], k[1]], [k[2], 0, -k[0]], [-k[1], k[0], 0]])
    rot = np.eye(3) * c + s * kx + (1 - c) * np.outer(k, k)
    return points @ rot.T


def colony(model: dict[str, Any]) -> list[dict[str, Any]]:
    """Усі тіла колонії: монарх і по одному на рік."""
    m = model["monarch"]
    bodies = [{
        "kind": "monarch",
        "faces": fold_facets(monarch_body(model["startDate"], m["sides"], m["height"], sum(m["tierHeights"]),
                                          m["tiers"], 0.12 * m["height"],
                                          monarch_profile(model["startDate"]))),
        "sparks": [],
    }]
    seed = model["startDate"]
    for child in model["children"]:
        tip = child["radius"] * 1.28
        key = f"year{child['year']}"
        apex = ((unit(seed, f"{key}:apex:x") - 0.5) * 0.5 * child["radius"],
                (unit(seed, f"{key}:apex:z") - 0.5) * 0.5 * child["radius"])
        faces = fold_facets(body(seed, key, child["sides"], child["height"], tip, apex,
                                 1 + int(unit(seed, f"{key}:ridge") * 2), bury=0.12 * child["height"]))
        az = math.radians(child["azimuth"])
        # Друза — щільний пучок майже вертикальних кристалів (ADR-0245).
        lean = child["lean"] * CHILD_LEAN
        distance = child["distance"] + child["radius"] * CHILD_STEP_OUT
        offset = np.array([math.cos(az) * distance, 0.0, math.sin(az) * distance])
        placed = []
        for tri, f, edges, shade in faces:
            placed.append((_rotate(tri, lean, child["azimuth"]) + offset, f, edges, shade))
        sparks = []
        for s in range(child["sparks"]):
            h = child["height"] * (0.25 + 0.5 * unit(seed, f"child{child['year']}:spark{s}"))
            p = _rotate(np.array([[0.0, h, 0.0]]), lean, child["azimuth"])[0] + offset
            sparks.append(p)
        bodies.append({"kind": f"year{child['year']}", "faces": placed, "sparks": sparks})
    return bodies


def geode(model: dict[str, Any]) -> list[tuple[np.ndarray, int]]:
    """Жеода: купа битих каменів навколо основи — не диск і не плита."""
    seed = model["startDate"]
    reach = model["monarch"]["radius"] + 0.3 + max([c["distance"] for c in model["children"]] + [0.0]) * 0.4
    rocks = []
    count = 16
    for i in range(count):
        a = (i + unit(seed, f"rock{i}:a")) / count * 2 * math.pi
        d = reach * (0.55 + 0.5 * unit(seed, f"rock{i}:d"))
        size = 0.14 + 0.12 * unit(seed, f"rock{i}:s")
        cx, cz = math.cos(a) * d, math.sin(a) * d
        # Гранчасті брили, а не пласкі скалки (ADR-0220), як у `geometry.ts`.
        top = np.array([cx + (unit(seed, f"rock{i}:tx") - 0.5) * size * 0.6, size * 1.0,
                        cz + (unit(seed, f"rock{i}:tz") - 0.5) * size * 0.6])
        bottom = np.array([cx, -size, cz])
        ring = []
        for j in range(5):
            b = a + j / 5 * 2 * math.pi + unit(seed, f"rock{i}:{j}")
            rr = size * (0.8 + 0.5 * unit(seed, f"rock{i}:r{j}"))
            ring.append(np.array([cx + math.cos(b) * rr, size * (0.25 + 0.2 * unit(seed, f"rock{i}:y{j}")), cz + math.sin(b) * rr]))
        for j in range(5):
            k = (j + 1) % 5
            rocks.append((np.array([ring[j], ring[k], top]), 1000 + i * 10 + j, TRI))
            rocks.append((np.array([ring[k], ring[j], bottom]), 1000 + i * 10 + j + 5, TRI))
    return rocks
