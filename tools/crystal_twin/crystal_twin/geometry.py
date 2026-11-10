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


def crown(seed, tag, top, y1, tip, apex, ridge, radius):
    """Верхівка як у `geometry.ts` (ADR-0217, поправка «г»): не концентричні
    яруси, а зміщений кінчик із `ridge` точок на різній висоті; кожна грань —
    один трикутник, тож пласка за побудовою."""
    ax, az = apex
    theta0 = unit(seed, f"{tag}:ridge:turn") * math.pi * 2
    q = []
    for k in range(ridge):
        th = theta0 + k * 2 * math.pi / ridge + (unit(seed, f"{tag}:ridge{k}:a") - 0.5) * (math.pi / ridge) * 0.6
        rho = 0.0 if ridge == 1 else radius * (0.3 + 0.16 * unit(seed, f"{tag}:ridge{k}:r"))
        h = y1 + tip if k == 0 else y1 + tip * (0.62 + 0.26 * unit(seed, f"{tag}:ridge{k}:h"))
        q.append(np.array([ax + math.cos(th) * rho, h, az + math.sin(th) * rho]))

    def angle_of(p):
        return math.atan2(p[2] - az, p[0] - ax)

    def owner(p):
        if ridge == 1:
            return 0
        gaps = [abs(math.atan2(math.sin(angle_of(p) - angle_of(r)), math.cos(angle_of(p) - angle_of(r)))) for r in q]
        return gaps.index(min(gaps))

    owners = [owner(p) for p in top]
    tris = []
    n = len(top)
    for i in range(n):
        j = (i + 1) % n
        k, b = owners[i], owners[j]
        guard = 0
        while k != b and guard < ridge:
            nxt = (k + 1) % ridge
            tris.append((top[i], q[k], q[nxt]))
            k = nxt
            guard += 1
        tris.append((top[i], top[j], q[b]))
    for k in range(1, ridge - 1):
        tris.append((q[0], q[k], q[k + 1]))
    inside = np.array([ax * 0.5, y1 - 0.2 * tip, az * 0.5])
    out = []
    for a, b, c in tris:
        nrm = np.cross(b - a, c - a)
        out.append((a, b, c) if np.dot(nrm, (a + b + c) / 3 - inside) >= 0 else (a, c, b))
    return out


# Кристал року: основа, ледь ширший пояс посередині й плече (ADR-0245).
# Кільце профілю: (частка шляху від основи до плеча, множник, зсув осі в радіусах).
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


def body(seed, tag, sides, height, tip, apex, ridge, bury, profile=CHILD_PROFILE) -> list[tuple]:
    """Трикутники тіла як (3×3 вершини, номер грані, які ребра справжні,
    тонова група). Ребро k — навпроти вершини k."""
    ring0 = _ring(sides)
    y0 = -bury
    y1 = height - tip
    radius = max(math.hypot(p[0], p[2]) for p in ring0)
    faces, rings, face = broken_shaft(seed, tag, ring0, profile, y0, y1, radius, 0)
    top = rings[-1]
    _, shoulder_scale, (sx, sz) = profile[-1]
    tip_at = (apex[0] + sx * radius, apex[1] + sz * radius)
    top_y = max(p[1] for p in top)
    for tri in crown(seed, tag, list(top), top_y, height - top_y, tip_at, ridge, radius * shoulder_scale):
        faces.append((np.array(tri), face, TRI, None))
        face += 1
    return faces


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
    `geometry.ts`: стовбур у три пояси (ADR-0244, ADR-0245) і корона
    самоцвіта (ADR-0247) — шов клинами, широкі плечі, зірка граней на
    півкроку, рівне кільце під вістрям."""
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
    corner_drop = [crown_height * (0.04 + 0.22 * unit(seed, f"monarch:crown:drop{i}")) for i in range(n)]
    top_drop = []
    for v in range(len(ring12)):
        if v in corner_at:
            top_drop.append(corner_drop[corner_at.index(v)])
        else:
            side = split_at.index(v)
            top_drop.append(0.25 * (corner_drop[side] + corner_drop[(side + 1) % n]) / 2)
    faces, rings, face = broken_shaft(seed, "monarch", ring12, profile, y0, y1, radius, 0, top_drop)
    shoulder = rings[-1]
    _, last_scale, (lx, lz) = profile[-1]
    sx, sz = lx * radius, lz * radius
    big_r = radius * last_scale

    def side_angle(i):
        c0 = shoulder[corner_at[i]]
        return math.atan2(c0[2] - sz, c0[0] - sx)

    def halfway(a, b):
        return a + math.atan2(math.sin(b - a), math.cos(b - a)) / 2

    inside = np.array([sx, y1 - crown_height * 0.2, sz])

    def add(a, b, c):
        nonlocal face
        nrm = np.cross(b - a, c - a)
        tri = (a, b, c) if np.dot(nrm, (a + b + c) / 3 - inside) >= 0 else (a, c, b)
        faces.append((np.array(tri), face, TRI, None))
        face += 1

    def at(angle, reach, y):
        return np.array([sx + math.cos(angle) * reach, y, sz + math.sin(angle) * reach])

    shoulders = [at(side_angle(i), big_r * (0.88 + 0.06 * unit(seed, f"monarch:crown:shoulder{i}:r")),
                    y1 + crown_height * (0.12 + 0.08 * unit(seed, f"monarch:crown:shoulder{i}:y")))
                 for i in range(n)]
    star = []
    for i in range(n):
        a0, a1 = side_angle(i), side_angle((i + 1) % n)
        gap = math.atan2(math.sin(a1 - a0), math.cos(a1 - a0))
        star.append(at(halfway(a0, a1) + gap * 0.18 * (unit(seed, f"monarch:crown:star{i}:a") - 0.5),
                       big_r * (0.5 + 0.08 * unit(seed, f"monarch:crown:star{i}:r")),
                       y1 + crown_height * (0.5 + 0.12 * unit(seed, f"monarch:crown:star{i}:y"))))
    for i in range(n):
        j = (i + 1) % n
        c0, c1 = shoulder[corner_at[i]], shoulder[corner_at[j]]
        v0, v1 = shoulders[i], shoulders[j]
        if split_at[i] >= 0:
            sp = shoulder[split_at[i]]
            add(c0, sp, v0)
            add(sp, c1, v1)
            add(sp, v1, v0)
        elif unit(seed, f"monarch:crown:diag{i}") < 0.5:
            add(c0, c1, v1)
            add(c0, v1, v0)
        else:
            add(c0, c1, v0)
            add(c1, v1, v0)
    for i in range(n):
        j = (i + 1) % n
        add(shoulders[i], shoulders[j], star[i])
        add(shoulders[j], star[j], star[i])
    count = max(1, ridge) + 2
    qy = y1 + crown_height * 0.85
    turn = unit(seed, "monarch:ridge:turn") * math.pi * 2
    q = [at(turn + k / count * math.pi * 2, big_r * 0.2, qy) for k in range(count)]

    def angle(p):
        return math.atan2(p[2] - sz, p[0] - sx)

    def owner(p):
        gaps = [abs(math.atan2(math.sin(angle(p) - angle(r)), math.cos(angle(p) - angle(r)))) for r in q]
        return gaps.index(min(gaps))

    owners = [owner(p) for p in star]
    for i in range(n):
        j = (i + 1) % n
        k = owners[i]
        guard = 0
        while k != owners[j] and guard < count:
            nxt = (k + 1) % count
            add(star[i], q[k], q[nxt])
            k = nxt
            guard += 1
        add(star[i], star[j], q[owners[j]])
    apex_point = np.array([sx, height, sz])
    for k in range(count):
        add(q[k], q[(k + 1) % count], apex_point)
    return faces


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
