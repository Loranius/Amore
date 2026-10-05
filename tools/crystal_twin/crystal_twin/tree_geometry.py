"""Геометрія дерева v2 з моделі (ADR-0218). Той самий алгоритм — у
`src/engine/species/treeV2/geometry.ts`; звірку тримає `summary()`.

Скелет росте рекурсивно: стовбур → скелетні гілки (плани) і провідник
угору → на кожному порядку продовження й бічна гілка. Кут, азимут і
довжина кожної гілки — з хешу її шляху, тож те саме дерево росте однаково
щоразу. Крона — гранчасті кластери на кінцях гілок: низькополігональна
стилізація з пласкими гранями, а не шум.
"""
from __future__ import annotations

import math
from typing import Any

from .grammar import year_boost
from .hashing import unit
from .tree_model import height_at

UP = (0.0, 1.0, 0.0)
# Товщина деревини відносно моделі (ADR-0222) — дзеркало TREE_GIRTH у TS.
TREE_GIRTH = 1.5


def _add(a, b):
    return (a[0] + b[0], a[1] + b[1], a[2] + b[2])


def _mul(a, k):
    return (a[0] * k, a[1] * k, a[2] * k)


def _cross(a, b):
    return (a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0])


def _norm(a):
    length = math.sqrt(a[0] * a[0] + a[1] * a[1] + a[2] * a[2])
    return (a[0] / length, a[1] / length, a[2] / length)


def _basis(d):
    ref = UP if abs(d[1]) < 0.99 else (1.0, 0.0, 0.0)
    a = _norm(_cross(d, ref))
    b = _cross(d, a)
    return a, b


def _deviate(d, angle_deg, turn_deg):
    """Відхилити напрям на `angle` у площині, повернутій на `turn` навколо нього."""
    a, b = _basis(d)
    al = math.radians(angle_deg)
    ps = math.radians(turn_deg)
    side = _add(_mul(a, math.cos(ps)), _mul(b, math.sin(ps)))
    out = _add(_mul(d, math.cos(al)), _mul(side, math.sin(al)))
    # Гілки тягнуться до світла: легкий ухил угору.
    return _norm(_add(out, (0.0, 0.15, 0.0)))


def tier_height(model: dict[str, Any], tier: int) -> float:
    """Висота, на якій ярус `tier` виходить зі стовбура (ADR-0237)."""
    opened = next((b["year"] for b in model["yearBranches"] if b["tier"] == tier), 0)
    return 0.62 * min(height_at(opened + 1), model["height"])


def _trunk_at(d, y):
    return _mul(d, y / d[1])


def trunk_point(model: dict[str, Any], trunk_dir, y: float):
    """Живий стовбур: нахил + м'який S-вигин (власник, 2026-10-05) — дзеркало
    `treeV2TrunkPoint` у TS (форма дуба; ялину двійник не будує)."""
    base = _trunk_at(trunk_dir, y)
    H = model["height"]
    t = max(0.0, min(1.0, y / (0.86 * H)))
    az = 2.0 * math.pi * unit(model["startDate"], "bend:a")
    amp = 0.045 * H
    bow = math.sin(math.pi * t) * amp
    back = math.sin(2.0 * math.pi * t) * amp * 0.35
    return (base[0] + math.cos(az) * bow - math.sin(az) * back, base[1],
            base[2] + math.sin(az) * bow + math.cos(az) * back)


def skeleton(model: dict[str, Any]) -> dict[str, Any]:
    """Стовбур сегментами до ярусів, гілки років, гілки верхівки — в одиницях сцени."""
    seed = model["startDate"]
    H = model["height"]
    leafiness = model["leafiness"]
    lean = math.radians(model["lean"])
    lean_az = math.radians(model["leanAzimuth"])
    trunk_dir = (math.sin(lean) * math.cos(lean_az), math.cos(lean), math.sin(lean) * math.sin(lean_az))

    branches: list[dict[str, Any]] = []
    clusters: list[dict[str, Any]] = []

    def trunk_rel(y):
        return 1.0 - 0.55 * min(1.0, y / H)

    def grow(start, direction, length, order, last, key, radius, thinning):
        end = _add(start, _mul(direction, length))
        r1 = max(radius * thinning, 0.004)
        branches.append({"start": start, "end": end, "r0": radius, "r1": r1, "order": order, "key": key})
        if order >= last - 1 and order > 0:
            size = (0.08 + 0.34 * length) * leafiness * (0.9 if order == last else 0.7)
            clusters.append({"centre": end, "radius": size, "key": key})
        if order == last:
            return
        turn = 137.5 * order + 360.0 * unit(seed, f"{key}:turn")
        cont = _deviate(direction, 18.0 + 16.0 * unit(seed, f"{key}:ca") - 8.0, turn)
        side = _deviate(direction, 42.0 + 24.0 * unit(seed, f"{key}:sa") - 12.0, turn + 180.0)
        thin = 0.7 if order + 1 < last else 0.5
        grow(end, cont, length * 0.74, order + 1, last, f"{key}.c", r1, thin)
        grow(end, side, length * 0.62, order + 1, last, f"{key}.s", r1 * 0.65, thin)

    stops = [tier_height(model, t) for t in range(model["tiers"])]
    top_y = 0.86 * H
    heights = [y for y in stops if y < top_y - 1e-9] + [top_y]
    # Проміжні вузли: плавний вигин і наплив біля землі.
    nodes = list(heights)
    for e in [0.03 * H, 0.08 * H] + [(k + 1) / 7.0 * top_y for k in range(6)]:
        if e < top_y and all(abs(n - e) > 0.01 * H for n in nodes):
            nodes.append(e)
    nodes.sort()
    start = (0.0, 0.0, 0.0)
    start_y = 0.0
    for i, y in enumerate(nodes):
        to = trunk_point(model, trunk_dir, y)
        branches.append({"start": start, "end": to, "r0": trunk_rel(start_y), "r1": trunk_rel(y), "order": 0, "key": f"t{i}"})
        start, start_y = to, y

    for yb in model["yearBranches"]:
        key = f"y{yb['year']}"
        y = stops[yb["tier"]]
        az = yb["slot"] * 360.0 / yb["size"] + yb["tier"] * 137.5 + (unit(seed, f"{key}:az") - 0.5) * 24.0
        el = 50.0 - 30.0 * yb["fertility"] + (unit(seed, f"{key}:el") - 0.5) * 8.0
        d = (math.cos(math.radians(el)) * math.cos(math.radians(az)), math.sin(math.radians(el)),
             math.cos(math.radians(el)) * math.sin(math.radians(az)))
        grown = 1.0 - math.exp(-(yb["age"] + 0.25) / 2.0)
        # 0.5 → 0.4 (власник, 2026-09-29: «гілки дерев занадто довгі»).
        reach = 0.4 * H / (1.0 + 0.18 * yb["tier"])
        length = reach * (0.35 + 0.65 * grown) * year_boost(yb["activity"]) * (0.9 + 0.2 * unit(seed, f"{key}:len"))
        last = 1 + min(2, int(yb["age"] // 2))
        # Плавний вихід зі стовбура: спершу вздовж нього, потім назовні.
        start = trunk_point(model, trunk_dir, y)
        a = trunk_point(model, trunk_dir, max(0.0, y - 0.02))
        b = trunk_point(model, trunk_dir, y + 0.02)
        along = _norm((b[0] - a[0], b[1] - a[1], b[2] - a[2]))
        exit_dir = _norm(_add(_mul(d, 0.65), _mul(along, 0.35)))
        mid = _add(start, _mul(exit_dir, length * 0.3))
        r0 = trunk_rel(y) * 0.34 * (0.6 + 0.4 * grown) * (0.75 + 0.45 * unit(seed, f"{key}:girth"))
        branches.append({"start": start, "end": mid, "r0": r0 * 1.06, "r1": r0, "order": 1, "key": f"{key}~"})
        grow(mid, d, length * 0.8, 1, last, key, r0, 0.6)

    top = trunk_point(model, trunk_dir, top_y)
    n = model["crownLimbs"]
    for i in range(n):
        key = f"c{i}"
        az = i * 360.0 / n + (unit(seed, f"{key}:az") - 0.5) * 40.0
        el = 55.0 + 15.0 * unit(seed, f"{key}:el")
        d = (math.cos(math.radians(el)) * math.cos(math.radians(az)), math.sin(math.radians(el)),
             math.cos(math.radians(el)) * math.sin(math.radians(az)))
        grow(top, d, 0.28 * H * (0.85 + 0.3 * unit(seed, f"{key}:len")), 1, 2, key, trunk_rel(top_y) * 0.6, 0.6)

    girth = model["trunkRadius"] * TREE_GIRTH
    for b in branches:
        b["r0"] *= girth
        b["r1"] *= girth
    return {"branches": branches, "clusters": clusters}


def roots(model: dict[str, Any]) -> list[dict[str, Any]]:
    """Коріння по землі: дві ланки на корінь, що вигинаються дугою."""
    seed = model["startDate"]
    n = model["roots"]
    out = []
    r = model["trunkRadius"] * TREE_GIRTH
    for i in range(n):
        phi = math.radians(i * 360.0 / n + (unit(seed, f"root{i}:az") - 0.5) * 40.0)
        length = model["rootReach"] * (0.7 + 0.5 * unit(seed, f"root{i}:len"))
        c, s = math.cos(phi), math.sin(phi)
        a = (c * r * 0.12, r * 1.5, s * r * 0.12)
        out_r = max(r * 1.75, length * 0.4)
        mid = (c * out_r, r * 0.12, s * out_r)
        end = (c * length, -length * 0.14, s * length)
        out.append({"start": a, "end": mid, "r0": r * 0.5, "r1": r * 0.32, "key": f"root{i}a"})
        out.append({"start": mid, "end": end, "r0": r * 0.32, "r1": r * 0.06, "key": f"root{i}b"})
    return out


def ornaments(model: dict[str, Any], clusters: list[dict[str, Any]]) -> dict[str, Any]:
    """Квіти (бажання), плоди (віхи), світлячки (медіа), польові квіти (вихідні)."""
    seed = model["startDate"]
    n = len(clusters)

    def on_cluster(tag: str, upward: bool, depth: float, pool=None):
        pool = pool if pool else clusters
        c = pool[min(len(pool) - 1, int(unit(seed, f"{tag}:c") * len(pool)))]
        y = 0.2 + 0.8 * unit(seed, f"{tag}:y")
        if not upward:
            y = -(0.3 + 0.5 * unit(seed, f"{tag}:y"))
        ring = math.sqrt(max(0.0, 1.0 - y * y))
        phi = 2.0 * math.pi * unit(seed, f"{tag}:phi")
        d = (ring * math.cos(phi), y, ring * math.sin(phi))
        return _add(c["centre"], _mul(d, c["radius"] * depth))

    # Стрічка бажання — знизу на кроні гілки свого року (ADR-0237, поправка 2026-10-04).
    blossoms = []
    for b in model["blossoms"]:
        own = [c for c in clusters if c["key"] == f"y{b['year']}" or c["key"].startswith(f"y{b['year']}.")]
        blossoms.append({"position": on_cluster(f"blossom{b['id']}", False, 1.0, own)})
    fruits = [on_cluster(f"fruit{k}", False, 0.92) for k in range(model["fruits"])]

    crown_mid = sum(c["centre"][1] for c in clusters) / n
    crown_r = max(math.hypot(c["centre"][0], c["centre"][2]) + c["radius"] for c in clusters)
    fireflies = []
    for k in range(model["fireflies"]):
        phi = 2.0 * math.pi * unit(seed, f"fly{k}:phi")
        rr = crown_r * (0.6 + 0.7 * unit(seed, f"fly{k}:r"))
        y = crown_mid + (unit(seed, f"fly{k}:y") - 0.5) * model["height"] * 0.8
        fireflies.append((math.cos(phi) * rr, max(0.15, y), math.sin(phi) * rr))

    inner = max(0.35, model["rootReach"] * 1.1)
    outer = inner + 1.2 + crown_r * 0.8
    flowers = []
    for k in range(model["flowers"]):
        phi = 2.0 * math.pi * unit(seed, f"flower{k}:phi")
        rr = math.sqrt(inner * inner + (outer * outer - inner * inner) * unit(seed, f"flower{k}:r"))
        flowers.append({"position": (math.cos(phi) * rr, 0.0, math.sin(phi) * rr),
                        "tint": int(unit(seed, f"flower{k}:tint") * 4)})
    return {"blossoms": blossoms, "fruits": fruits, "fireflies": fireflies, "flowers": flowers,
            "crownRadius": crown_r, "meadowRadius": outer + 0.6}


def summary(model: dict[str, Any]) -> dict[str, Any]:
    """Що звіряє портал: скільки чого й де межі дерева (округлено до 10⁻⁴)."""
    sk = skeleton(model)
    orn = ornaments(model, sk["clusters"])
    q = lambda x: math.floor(x * 1e4 + 0.5) / 1e4  # noqa: E731
    reach = max(max(abs(b["end"][0]), abs(b["end"][2])) for b in sk["branches"])
    return {
        "branches": len(sk["branches"]),
        "clusters": len(sk["clusters"]),
        "top": q(max(c["centre"][1] + c["radius"] for c in sk["clusters"])),
        "reach": q(reach),
        "crownRadius": q(orn["crownRadius"]),
        "meadowRadius": q(orn["meadowRadius"]),
        "firstBlossom": [q(v) for v in orn["blossoms"][0]["position"]] if orn["blossoms"] else None,
    }


# ── Меш (для рендера двійника; портал будує той самий у TS) ────
def _icosphere() -> tuple[list[tuple[float, float, float]], list[tuple[int, int, int]]]:
    t = (1.0 + math.sqrt(5.0)) / 2.0
    verts = [_norm(v) for v in [(-1, t, 0), (1, t, 0), (-1, -t, 0), (1, -t, 0), (0, -1, t), (0, 1, t),
                                 (0, -1, -t), (0, 1, -t), (t, 0, -1), (t, 0, 1), (-t, 0, -1), (-t, 0, 1)]]
    faces = [(0, 11, 5), (0, 5, 1), (0, 1, 7), (0, 7, 10), (0, 10, 11), (1, 5, 9), (5, 11, 4), (11, 10, 2),
             (10, 7, 6), (7, 1, 8), (3, 9, 4), (3, 4, 2), (3, 2, 6), (3, 6, 8), (3, 8, 9), (4, 9, 5),
             (2, 4, 11), (6, 2, 10), (8, 6, 7), (9, 8, 1)]
    cache: dict[tuple[int, int], int] = {}

    def mid(i, j):
        k = (min(i, j), max(i, j))
        if k not in cache:
            a, b = verts[i], verts[j]
            verts.append(_norm(((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2)))
            cache[k] = len(verts) - 1
        return cache[k]

    out = []
    for a, b, c in faces:
        ab, bc, ca = mid(a, b), mid(b, c), mid(c, a)
        out += [(a, ab, ca), (b, bc, ab), (c, ca, bc), (ab, bc, ca)]
    return verts, out


ICO_VERTS, ICO_FACES = _icosphere()


def cluster_triangles(seed: str, cluster: dict[str, Any]):
    """Гранчастий кластер листя: ікосфера з поштучним радіальним зсувом вершин."""
    c, r, key = cluster["centre"], cluster["radius"], cluster["key"]
    pts = []
    for i, v in enumerate(ICO_VERTS):
        k = r * 1.14 * (0.82 + 0.3 * unit(seed, f"{key}:v{i}"))
        pts.append((c[0] + v[0] * k, c[1] + v[1] * k * 0.82, c[2] + v[2] * k))
    return [(pts[a], pts[b], pts[cc]) for a, b, cc in ICO_FACES]


def prism_triangles(start, end, r0, r1, sides: int = 6):
    d = _norm((end[0] - start[0], end[1] - start[1], end[2] - start[2]))
    a, b = _basis(d)
    ring0, ring1 = [], []
    for i in range(sides):
        ang = 2.0 * math.pi * i / sides
        o = _add(_mul(a, math.cos(ang)), _mul(b, math.sin(ang)))
        ring0.append(_add(start, _mul(o, r0)))
        ring1.append(_add(end, _mul(o, r1)))
    tris = []
    for i in range(sides):
        j = (i + 1) % sides
        # Закручено НАЗОВНІ, як у `geometry.ts` (портал відсікає задні грані).
        tris.append((ring0[i], ring0[j], ring1[j]))
        tris.append((ring0[i], ring1[j], ring1[i]))
    return tris
