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
FOOT = 0.5


def _ring(sides: list[list[float]]) -> np.ndarray:
    pts = []
    for angle, reach in sides:
        a = math.radians(angle)
        pts.append([math.cos(a) * reach, 0.0, math.sin(a) * reach])
    return np.array(pts)


QUAD_A = (True, False, True)   # [b_i, b_j, t_j]: діагональ t_j–b_i не ребро
QUAD_B = (True, True, False)   # [b_i, t_j, t_i]: діагональ b_i–t_j не ребро
TRI = (True, True, True)


def body(sides, height, tier_heights, apex, bury) -> list[tuple[np.ndarray, int, tuple]]:
    """Трикутники тіла як (3×3 вершини, номер грані, які ребра справжні).

    Ребро k — навпроти вершини k. Діагональ, що ділить пласку грань на два
    трикутники, ребром не є, і кант на ній малював би неіснуючу грань."""
    ring0 = _ring(sides)
    tip = sum(tier_heights)
    y0 = -bury
    y1 = height - tip
    faces: list[tuple[np.ndarray, int]] = []
    face = 0
    n = len(ring0)
    bottom = ring0 * FOOT + np.array([0, y0, 0])
    shoulder = ring0
    top = shoulder + np.array([0, y1, 0])
    for i in range(n):
        j = (i + 1) % n
        faces.append((np.array([bottom[i], bottom[j], top[j]]), face, QUAD_A))
        faces.append((np.array([bottom[i], top[j], top[i]]), face, QUAD_B))
        face += 1
    tiers = len(tier_heights)
    prev = top
    y = y1
    apex_v = np.array([apex[0], 0.0, apex[1]])
    for t in range(tiers):
        s = 1.0 - (t + 1) / tiers
        y += tier_heights[t]
        centre = apex_v * (1 - s)
        nxt = shoulder * s + centre + np.array([0, y, 0])
        for i in range(n):
            j = (i + 1) % n
            if s > 1e-9:
                faces.append((np.array([prev[i], prev[j], nxt[j]]), face, QUAD_A))
                faces.append((np.array([prev[i], nxt[j], nxt[i]]), face, QUAD_B))
            else:
                faces.append((np.array([prev[i], prev[j], nxt[i]]), face, TRI))
            face += 1
        prev = nxt
    return faces


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
        "faces": body(m["sides"], m["height"], m["tierHeights"], m["apex"], bury=0.12 * m["height"]),
        "sparks": [],
    }]
    seed = model["startDate"]
    for child in model["children"]:
        tip = child["radius"] * 1.28
        faces = body(child["sides"], child["height"], [tip], [0.0, 0.0], bury=0.12 * child["height"])
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
        size = 0.16 + 0.14 * unit(seed, f"rock{i}:s")
        cx, cz = math.cos(a) * d, math.sin(a) * d
        top = np.array([cx, size * 0.7, cz])
        bottom = np.array([cx, -size, cz])
        ring = []
        for j in range(5):
            b = a + j / 5 * 2 * math.pi + unit(seed, f"rock{i}:{j}")
            rr = size * (0.8 + 0.5 * unit(seed, f"rock{i}:r{j}"))
            ring.append(np.array([cx + math.cos(b) * rr, size * 0.05, cz + math.sin(b) * rr]))
        for j in range(5):
            k = (j + 1) % 5
            rocks.append((np.array([ring[j], ring[k], top]), 1000 + i * 10 + j, TRI))
            rocks.append((np.array([ring[k], ring[j], bottom]), 1000 + i * 10 + j + 5, TRI))
    return rocks
