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


QUAD_A = (True, False, True)   # [b_i, b_j, t_j]: діагональ t_j–b_i не ребро
QUAD_B = (True, True, False)   # [b_i, t_j, t_i]: діагональ b_i–t_j не ребро
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


# Звичайне тіло року: основа — FOOT плеча, плече — саме кільце.
# Кільце профілю: (частка шляху від основи до плеча, множник, зсув осі в радіусах).
SPINDLE = ((0.0, FOOT, (0.0, 0.0)), (1.0, 1.0, (0.0, 0.0)))


def monarch_profile(seed):
    """Монарх — три кільця, як `monarchProfile` у `geometry.ts`: важка
    основа, ледь ширший пояс на третині висоти й плече, зсунуте від осі."""
    def jitter(key, span):
        return (unit(seed, f"monarch:profile:{key}") - 0.5) * span
    return (
        (0.0, 0.86, (0.0, 0.0)),
        (0.32 + jitter("belly:at", 0.08), 1.05, (jitter("belly:x", 0.06), jitter("belly:z", 0.06))),
        (1.0, 0.97, (jitter("shoulder:x", 0.14), jitter("shoulder:z", 0.14))),
    )


def body(seed, tag, sides, height, tip, apex, ridge, bury, profile=SPINDLE) -> list[tuple[np.ndarray, int, tuple]]:
    """Трикутники тіла як (3×3 вершини, номер грані, які ребра справжні).

    Ребро k — навпроти вершини k. Діагональ, що ділить пласку грань на два
    трикутники, ребром не є, і кант на ній малював би неіснуючу грань.
    Кожне кільце профілю — кільце плеча, стиснуте й зсунуте, тож грані між
    кільцями пласкі за побудовою."""
    ring0 = _ring(sides)
    y0 = -bury
    y1 = height - tip
    radius = max(math.hypot(p[0], p[2]) for p in ring0)
    rings = []
    for at, scale, (sx, sz) in profile:
        y = y0 + (y1 - y0) * at
        rings.append(ring0 * scale + np.array([sx * radius, y, sz * radius]))
    faces: list[tuple[np.ndarray, int]] = []
    face = 0
    n = len(ring0)
    for lower, upper in zip(rings, rings[1:]):
        for i in range(n):
            j = (i + 1) % n
            faces.append((np.array([lower[i], lower[j], upper[j]]), face, QUAD_A))
            faces.append((np.array([lower[i], upper[j], upper[i]]), face, QUAD_B))
            face += 1
    top = rings[-1]
    _, shoulder_scale, (sx, sz) = profile[-1]
    tip_at = (apex[0] + sx * radius, apex[1] + sz * radius)
    for tri in crown(seed, tag, list(top), y1, tip, tip_at, ridge, radius * shoulder_scale):
        faces.append((np.array(tri), face, TRI))
        face += 1
    return faces


def monarch_body(seed, sides, height, tip, apex, ridge, bury, profile):
    """Монарх як великий гранчастий кристал — те саме, що `monarchBody` у
    `geometry.ts` (ADR-0244): 12 поздовжніх граней із 6 сторін, вершина у
    два яруси (пояс над ребрами сторін і кінчик із точок планів)."""
    corners = _ring(sides)
    n = len(corners)
    ring12 = []
    for i in range(n):
        a, b = corners[i], corners[(i + 1) % n]
        t = 0.35 + 0.3 * unit(seed, f"monarch:split{i}:t")
        bulge = 1.06 + 0.08 * unit(seed, f"monarch:split{i}:b")
        ring12.append(a)
        ring12.append((a + (b - a) * t) * bulge)
    ring12 = np.array(ring12)
    m = len(ring12)
    y0 = -bury
    y1 = height - tip
    radius = max(math.hypot(p[0], p[2]) for p in corners)
    rings = []
    for at, scale, (sx, sz) in profile:
        y = y0 + (y1 - y0) * at
        rings.append(ring12 * scale + np.array([sx * radius, y, sz * radius]))
    faces = []
    face = 0
    for k in range(len(rings) - 1):
        lower, upper = rings[k], rings[k + 1]
        for i in range(m):
            j = (i + 1) % m
            faces.append((np.array([lower[i], lower[j], upper[j]]), face, (True, False, False)))
            faces.append((np.array([lower[i], upper[j], upper[i]]), face, (k + 2 == len(rings), True, False)))
            face += 1
    shoulder = rings[-1]
    _, last_scale, (lx, lz) = profile[-1]
    sx, sz = lx * radius, lz * radius
    mid_height = tip * 0.42
    mid = []
    for i in range(n):
        s = shoulder[2 * i + 1]
        a = math.atan2(s[2] - sz, s[0] - sx)
        r = radius * last_scale * 0.5 * (0.85 + 0.3 * unit(seed, f"monarch:mid{i}:r"))
        y = y1 + mid_height * (0.7 + 0.6 * unit(seed, f"monarch:mid{i}:y"))
        mid.append(np.array([sx + math.cos(a) * r, y, sz + math.sin(a) * r]))
    inside = np.array([sx, y1 - tip * 0.2, sz])

    def facing(a, b, c):
        nrm = np.cross(b - a, c - a)
        return (a, b, c) if np.dot(nrm, (a + b + c) / 3 - inside) >= 0 else (a, c, b)

    for i in range(n):
        c0, s, c1 = shoulder[2 * i], shoulder[2 * i + 1], shoulder[(2 * i + 2) % m]
        m0, m1 = mid[i], mid[(i + 1) % n]
        for tri in (facing(c0, s, m0), facing(s, c1, m0), facing(c1, m1, m0)):
            faces.append((np.array(tri), face, TRI))
            face += 1
    tip_at = (apex[0] + sx, apex[1] + sz)
    mid_top = max(p[1] for p in mid)
    for tri in crown(seed, "monarch", mid, mid_top, height - mid_top, tip_at, ridge, radius * last_scale * 0.3):
        faces.append((np.array(tri), face, TRI))
        face += 1
    return faces


# Тон грані — з трьох (ADR-0244), як `FACE_TONES` у `geometry.ts`.
FACE_TONES = (0.74, 1.0, 1.3)


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
        "faces": monarch_body(model["startDate"], m["sides"], m["height"], sum(m["tierHeights"]),
                              (m["apex"][0] * 4, m["apex"][1] * 4), m["tiers"], 0.12 * m["height"],
                              monarch_profile(model["startDate"])),
        "sparks": [],
    }]
    seed = model["startDate"]
    for child in model["children"]:
        tip = child["radius"] * 1.28
        key = f"year{child['year']}"
        apex = ((unit(seed, f"{key}:apex:x") - 0.5) * 0.5 * child["radius"],
                (unit(seed, f"{key}:apex:z") - 0.5) * 0.5 * child["radius"])
        faces = body(seed, key, child["sides"], child["height"], tip, apex,
                     1 + int(unit(seed, f"{key}:ridge") * 2), bury=0.12 * child["height"])
        az = math.radians(child["azimuth"])
        offset = np.array([math.cos(az) * child["distance"], 0.0, math.sin(az) * child["distance"]])
        placed = []
        for tri, f, edges in faces:
            placed.append((_rotate(tri, child["lean"], child["azimuth"]) + offset, f, edges))
        sparks = []
        for s in range(child["sparks"]):
            h = child["height"] * (0.25 + 0.5 * unit(seed, f"child{child['year']}:spark{s}"))
            p = _rotate(np.array([[0.0, h, 0.0]]), child["lean"], child["azimuth"])[0] + offset
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
