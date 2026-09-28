"""Геометрія рифу v2 з моделі (ADR-0219). Той самий алгоритм — у
`src/engine/species/reefV2/geometry.ts`; звірку тримає `summary()`.

Голова рифу — приплюснута гранчаста ікосфера на піску. Колонія кожного
року сидить на її поверхні по спіралі (золотий кут) і нахилена за схилом.
Шість форм колоній — пласкі грані, без шуму: мозковик (гранчастий купол),
гіллястий (розгалужені призми), віяло (пласка сітка), трубки, стіл
(ніжка й плита) і пальці.
"""
from __future__ import annotations

import math
from typing import Any

from .hashing import unit
from .tree_geometry import ICO_FACES, ICO_VERTS, _add, _basis, _mul, _norm

# Висота кожної форми в частках розміру колонії: з неї — верх рифу.
FORM_HEIGHT = {"brain": 0.6, "branch": 1.0, "fan": 1.1, "tube": 0.9, "table": 0.5, "finger": 0.85}


def surface_y(model: dict[str, Any], d: float) -> float:
    r = model["radius"]
    t = min(1.0, d / r)
    return model["rise"] * math.sqrt(max(0.0, 1.0 - t * t))


def _lean_dir(model: dict[str, Any], azimuth_deg: float, d: float) -> tuple[float, float, float]:
    """Вісь колонії: вертикаль, нахилена назовні на 60% схилу голови."""
    r, rise = model["radius"], model["rise"]
    t = min(0.97, d / r)
    slope = rise * t / (r * math.sqrt(1.0 - t * t))
    tilt = math.atan(slope) * 0.6
    a = math.radians(azimuth_deg)
    return (math.sin(tilt) * math.cos(a), math.cos(tilt), math.sin(tilt) * math.sin(a))


def placements(model: dict[str, Any]) -> list[dict[str, Any]]:
    """Тіла колоній: перше — у точці колонії, решта — довкола, трохи менші."""
    seed = model["startDate"]
    out = []
    for c in model["colonies"]:
        d0 = c["reach"] * model["radius"]
        a0 = math.radians(c["azimuth"])
        cx, cz = math.cos(a0) * d0, math.sin(a0) * d0
        for j in range(c["bodies"]):
            key = f"colony{c['year']}:body{j}"
            if j == 0:
                x, z, scale = cx, cz, 1.0
            else:
                ang = 2.0 * math.pi * (j / c["bodies"] + unit(seed, f"{key}:a") * 0.2)
                off = c["size"] * (0.45 + 0.25 * unit(seed, f"{key}:d"))
                x, z = cx + math.cos(ang) * off, cz + math.sin(ang) * off
                scale = 0.55 + 0.3 * unit(seed, f"{key}:s")
            d = math.hypot(x, z)
            az = math.degrees(math.atan2(z, x))
            size = c["size"] * scale
            base = (x, surface_y(model, d) - 0.03 * size, z)
            out.append({"colony": c, "body": j, "key": key, "size": size, "base": base,
                        "axis": _lean_dir(model, az, d)})
    return out


UNDERGROWTH_FORMS = ("finger", "brain", "branch", "tube", "finger", "fan")


def undergrowth(model: dict[str, Any]) -> list[dict[str, Any]]:
    """Дрібні корали по всьому каменю: форма й відтінок кожного — з хешу."""
    seed = model["startDate"]
    out = []
    for k in range(model["undergrowth"]):
        key = f"under{k}"
        a = 2.0 * math.pi * unit(seed, f"{key}:a")
        # Більше до схилів: вершину й так вкривають колонії років.
        u = unit(seed, f"{key}:d")
        # Кожен третій — кільцем біля підніжжя, на межі каменю й піску:
        # інакше нижній пояс каменю лишався голою смугою.
        d = model["radius"] * (0.92 + 0.26 * u if k % 3 == 2 else 0.3 + 0.66 * math.sqrt(u))
        x, z = math.cos(a) * d, math.sin(a) * d
        size = 0.1 + 0.13 * unit(seed, f"{key}:s")
        form = UNDERGROWTH_FORMS[min(5, int(unit(seed, f"{key}:f") * 6))]
        colony = {"year": -1, "form": form, "size": size, "hue": unit(seed, f"{key}:h")}
        out.append({"colony": colony, "body": k, "key": key, "size": size,
                    "base": (x, surface_y(model, d) - 0.02 * size, z),
                    "axis": _lean_dir(model, math.degrees(math.atan2(z, x)), d)})
    return out


def _on_surface(model: dict[str, Any], tag: str, lo: float, hi: float):
    seed = model["startDate"]
    a = 2.0 * math.pi * unit(seed, f"{tag}:a")
    d = model["radius"] * (lo + (hi - lo) * math.sqrt(unit(seed, f"{tag}:d")))
    return (math.cos(a) * d, surface_y(model, d), math.sin(a) * d), a


def ornaments(model: dict[str, Any]) -> dict[str, Any]:
    seed = model["startDate"]
    anemones = [{"position": _on_surface(model, f"anemone{a['id']}", 0.2, 0.95)[0], "channel": a["channel"]}
                for a in model["anemones"]]
    clams = [_on_surface(model, f"clam{k}", 0.3, 0.9)[0] for k in range(model["clams"])]
    stars = []
    for k in range(model["starfish"]):
        a = 2.0 * math.pi * unit(seed, f"star{k}:a")
        d = model["radius"] * (1.08 + 0.4 * unit(seed, f"star{k}:d"))
        stars.append({"position": (math.cos(a) * d, 0.0, math.sin(a) * d), "turn": 360.0 * unit(seed, f"star{k}:t")})
    fish = []
    for k in range(model["fish"]):
        fish.append({
            "orbit": model["radius"] * (1.25 + 0.7 * unit(seed, f"fish{k}:r")),
            "height": model["rise"] * (0.5 + 1.3 * unit(seed, f"fish{k}:y")) + 0.15,
            "phase": 360.0 * unit(seed, f"fish{k}:p"),
            "speed": 0.7 + 0.6 * unit(seed, f"fish{k}:s"),
        })
    grass = []
    for k in range(model["seagrass"]):
        a = 2.0 * math.pi * unit(seed, f"grass{k}:a")
        d = model["radius"] * 1.02 + 2.2 * unit(seed, f"grass{k}:d") ** 1.5
        grass.append((math.cos(a) * d, 0.0, math.sin(a) * d))
    return {"anemones": anemones, "clams": clams, "starfish": stars, "fish": fish, "seagrass": grass}


def summary(model: dict[str, Any]) -> dict[str, Any]:
    q = lambda x: math.floor(x * 1e4 + 0.5) / 1e4  # noqa: E731
    places = placements(model)
    orn = ornaments(model)
    top = max([model["rise"]] + [p["base"][1] + p["axis"][1] * FORM_HEIGHT[p["colony"]["form"]] * p["size"]
                                 for p in places])
    reach = max([model["radius"]] + [math.hypot(p["base"][0], p["base"][2]) + p["size"] * 0.6 for p in places])
    return {
        "colonies": len(model["colonies"]),
        "bodies": len(places),
        "forms": [c["form"] for c in model["colonies"]],
        "top": q(top),
        "reach": q(reach),
        "firstBase": [q(v) for v in places[0]["base"]] if places else None,
        "undergrowth": len(undergrowth(model)),
        "firstUnder": [q(v) for v in undergrowth(model)[0]["base"]] if model["undergrowth"] else None,
        "firstAnemone": [q(v) for v in orn["anemones"][0]["position"]] if orn["anemones"] else None,
    }


# ── Меш (для рендера двійника; портал будує той самий у TS) ────
def prism(start, end, r0, r1, sides=5, caps=False):
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
        tris.append((ring0[i], ring0[j], ring1[j]))
        tris.append((ring0[i], ring1[j], ring1[i]))
        if caps:
            tris.append((end, ring1[i], ring1[j]))
            tris.append((start, ring0[j], ring0[i]))
    return tris


def rock_triangles(model: dict[str, Any]):
    seed = model["startDate"]
    r, rise = model["radius"], model["rise"]
    pts = []
    for i, v in enumerate(ICO_VERTS):
        k = 0.9 + 0.2 * unit(seed, f"rock:v{i}")
        y = v[1] * rise * k if v[1] > 0 else v[1] * rise * 0.25
        pts.append((v[0] * r * k, y, v[2] * r * k))
    return [(pts[a], pts[b], pts[c]) for a, b, c in ICO_FACES]


def _frame(axis):
    """Базис колонії: (x, y = вісь, z)."""
    a, b = _basis(axis)
    return a, axis, b


def _local(base, frame, p):
    x, y, z = frame
    return _add(base, _add(_add(_mul(x, p[0]), _mul(y, p[1])), _mul(z, p[2])))


def colony_triangles(model: dict[str, Any], place: dict[str, Any]):
    """Трикутники колонії в координатах рифу."""
    seed = model["startDate"]
    c = place["colony"]
    s = place["size"]
    key = place["key"]
    fr = _frame(place["axis"])
    L = lambda p: _local(place["base"], fr, p)  # noqa: E731
    tris = []
    form = c["form"]
    if form == "brain":
        for a, b, cc in ICO_FACES:
            pts = []
            for i in (a, b, cc):
                v = ICO_VERTS[i]
                k = s * 0.5 * (0.9 + 0.2 * unit(seed, f"{key}:v{i}"))
                pts.append(L((v[0] * k, 0.28 * s + max(v[1], -0.4) * k * 0.7, v[2] * k)))
            tris.append(tuple(pts))
    elif form == "branch":
        tris += prism(L((0, 0, 0)), L((0, 0.4 * s, 0)), 0.08 * s, 0.06 * s)
        for i in range(4):
            phi = math.radians(i * 90 + 360 * unit(seed, f"{key}:b{i}"))
            th = math.radians(25 + 20 * unit(seed, f"{key}:t{i}"))
            d = (math.sin(th) * math.cos(phi), math.cos(th), math.sin(th) * math.sin(phi))
            mid = (d[0] * 0.35 * s, 0.4 * s + d[1] * 0.35 * s, d[2] * 0.35 * s)
            tris += prism(L((0, 0.4 * s, 0)), L(mid), 0.06 * s, 0.045 * s)
            for j in (-1, 1):
                tip = (mid[0] + (d[0] + j * 0.35 * math.sin(phi)) * 0.3 * s,
                       mid[1] + 0.28 * s,
                       mid[2] + (d[2] - j * 0.35 * math.cos(phi)) * 0.3 * s)
                tris += prism(L(mid), L(tip), 0.045 * s, 0.02 * s)
    elif form == "fan":
        rings = [(0.35, 7), (0.7, 9), (1.05, 11)]
        prev = [L((0, 0.05 * s, 0))]
        for ri, (radius, n) in enumerate(rings):
            cur = []
            for i in range(n):
                ang = math.radians(-65 + 130 * i / (n - 1))
                wobble = 0.06 * s * (unit(seed, f"{key}:w{ri}:{i}") - 0.5)
                cur.append(L((math.sin(ang) * radius * s, 0.05 * s + math.cos(ang) * radius * s, wobble)))
            for i in range(n - 1):
                j0 = min(len(prev) - 1, int(i * (len(prev) - 1) / max(1, n - 2)))
                j1 = min(len(prev) - 1, int((i + 1) * (len(prev) - 1) / max(1, n - 2)))
                tris.append((prev[j0], cur[i], cur[i + 1]))
                if j1 != j0:
                    tris.append((prev[j0], cur[i + 1], prev[j1]))
            prev = cur
    elif form == "tube":
        for i in range(4):
            phi = math.radians(i * 90 + 40 * unit(seed, f"{key}:p{i}"))
            off = 0.14 * s * (0.4 + unit(seed, f"{key}:o{i}"))
            h = s * (0.5 + 0.4 * unit(seed, f"{key}:h{i}"))
            r = s * (0.08 + 0.05 * unit(seed, f"{key}:r{i}"))
            b0 = (math.cos(phi) * off, 0, math.sin(phi) * off)
            tris += prism(L(b0), L((b0[0] * 1.3, h, b0[2] * 1.3)), r, r * 1.15, 6, caps=True)
    elif form == "table":
        tris += prism(L((0, 0, 0)), L((0, 0.36 * s, 0)), 0.1 * s, 0.07 * s)
        tris += prism(L((0, 0.36 * s, 0)), L((0, 0.46 * s, 0)), 0.75 * s, 0.8 * s, 7, caps=True)
    else:  # finger
        for i in range(6):
            phi = math.radians(i * 60 + 30 * unit(seed, f"{key}:p{i}"))
            off = 0.2 * s * unit(seed, f"{key}:o{i}")
            h = s * (0.5 + 0.35 * unit(seed, f"{key}:h{i}"))
            lean = 0.25 * h
            b0 = (math.cos(phi) * off, 0, math.sin(phi) * off)
            top = (b0[0] + math.cos(phi) * lean, h, b0[2] + math.sin(phi) * lean)
            tris += prism(L(b0), L(top), 0.07 * s, 0.05 * s)
            tip = (top[0] + math.cos(phi) * 0.02 * s, h + 0.08 * s, top[2] + math.sin(phi) * 0.02 * s)
            tris += prism(L(top), L(tip), 0.05 * s, 0.001)
    return tris
