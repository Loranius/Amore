"""Програмний рендер рифу v2 (numpy + z-буфер) — для перевірки росту.

Та сама мова, що в порталі: пласкі грані, тон — колір × світло згори ×
зсув грані, вода синіє з глибиною (туман кольору води).
"""
from __future__ import annotations

import colorsys
import math
from typing import Any

import numpy as np
from PIL import Image

from .hashing import unit
from .reef_geometry import colony_triangles, ornaments, placements, prism, rock_triangles, summary

KEY = np.array([-0.3, 0.9, 0.3])
KEY = KEY / np.linalg.norm(KEY)
WATER = np.array([0.12, 0.45, 0.62])
SAND = np.array([0.86, 0.78, 0.6])
ROCK = np.array([0.72, 0.58, 0.52])
# Базовий тон кожної форми (відтінок, насиченість, яскравість).
FORM_HSV = {
    "brain": (0.08, 0.55, 0.95), "branch": (0.96, 0.6, 0.95), "fan": (0.83, 0.55, 0.85),
    "tube": (0.13, 0.75, 0.95), "table": (0.5, 0.45, 0.8), "finger": (0.04, 0.5, 0.95),
}
CHANNEL = {"red": (0.95, 0.3, 0.42), "blue": (0.35, 0.58, 1.0), "green": (0.55, 0.92, 0.45)}


def form_colour(colony: dict[str, Any]) -> np.ndarray:
    h, s, v = FORM_HSV[colony["form"]]
    return np.array(colorsys.hsv_to_rgb((h + (colony["hue"] - 0.5) * 0.08) % 1.0, s, v))


def framing(model: dict[str, Any]) -> tuple[float, float]:
    sm = summary(model)
    return sm["top"], sm["reach"]


def render(model: dict[str, Any], width: int = 480, height: int = 640,
           frame: tuple[float, float] | None = None) -> Image.Image:
    seed = model["startDate"]
    top, reach = frame or framing(model)
    target = np.array([0.0, top * 0.35, 0.0])
    dist = max(reach * 4.2, top * 4.0, 3.2)
    eye = target + np.array([0.0, dist * 0.35, dist])
    fwd = target - eye
    fwd /= np.linalg.norm(fwd)
    right = np.cross(fwd, [0.0, 1.0, 0.0])
    right /= np.linalg.norm(right)
    up = np.cross(right, fwd)
    focal = 0.5 * height / math.tan(math.radians(40) / 2)
    yy = np.linspace(0, 1, height)[:, None, None]
    img = np.broadcast_to(np.array([0.3, 0.7, 0.8]) * (1 - yy) + WATER * yy, (height, width, 3)).copy()
    depth = np.full((height, width), np.inf)

    def draw(tri, colour, lit=True):
        tri = np.asarray(tri, float)
        n = np.cross(tri[1] - tri[0], tri[2] - tri[0])
        ln = np.linalg.norm(n)
        if ln < 1e-12:
            return
        n /= ln
        if np.dot(n, eye - tri.mean(0)) < 0:
            n = -n
        shade = (0.4 + 0.7 * max(0.0, float(n @ KEY))) if lit else 1.0
        fog = min(1.0, max(0.0, (np.linalg.norm(tri.mean(0) - eye) - dist * 0.8) / (dist * 1.5)))
        col = np.clip(np.asarray(colour) * shade * (1 - fog) + WATER * fog, 0, 1)
        rel = tri - eye
        z = rel @ fwd
        if (z <= 0.05).any():
            return
        sx = width / 2 + focal * (rel @ right) / z
        sy = height / 2 - focal * (rel @ up) / z
        x0, x1 = int(max(0, sx.min())), int(min(width - 1, sx.max() + 1))
        y0, y1 = int(max(0, sy.min())), int(min(height - 1, sy.max() + 1))
        if x0 >= x1 or y0 >= y1:
            return
        gx, gy = np.meshgrid(np.arange(x0, x1) + 0.5, np.arange(y0, y1) + 0.5)
        d = (sx[1] - sx[0]) * (sy[2] - sy[0]) - (sx[2] - sx[0]) * (sy[1] - sy[0])
        if abs(d) < 1e-9:
            return
        w1 = ((gx - sx[0]) * (sy[2] - sy[0]) - (sx[2] - sx[0]) * (gy - sy[0])) / d
        w2 = ((sx[1] - sx[0]) * (gy - sy[0]) - (gx - sx[0]) * (sy[1] - sy[0])) / d
        w0 = 1 - w1 - w2
        m = (w0 >= 0) & (w1 >= 0) & (w2 >= 0)
        zz = w0 * z[0] + w1 * z[1] + w2 * z[2]
        sub = depth[y0:y1, x0:x1]
        m &= zz < sub
        sub[m] = zz[m]
        img[y0:y1, x0:x1][m] = col

    R = model["radius"] * 4 + 3
    for i in range(32):
        a0, a1 = 2 * math.pi * i / 32, 2 * math.pi * (i + 1) / 32
        draw([(0, -0.02, 0), (math.cos(a0) * R, -0.02, math.sin(a0) * R), (math.cos(a1) * R, -0.02, math.sin(a1) * R)],
             SAND * (0.9 + 0.2 * unit(seed, f"sand{i}")))
    for k, tri in enumerate(rock_triangles(model)):
        draw(tri, ROCK * (0.85 + 0.3 * unit(seed, f"rock:f{k}")))
    for p in placements(model):
        base = form_colour(p["colony"])
        for k, tri in enumerate(colony_triangles(model, p)):
            draw(tri, base * (0.85 + 0.3 * unit(seed, f"{p['key']}:f{k}")))
    orn = ornaments(model)
    for a in orn["anemones"]:
        pos = a["position"]
        for i in range(6):
            ang = 2 * math.pi * i / 6
            tip = (pos[0] + math.cos(ang) * 0.06, pos[1] + 0.1, pos[2] + math.sin(ang) * 0.06)
            for tri in prism(pos, tip, 0.015, 0.004, 3):
                draw(tri, CHANNEL[a["channel"]], lit=False)
    for s in orn["starfish"]:
        pos = s["position"]
        for i in range(5):
            ang = math.radians(s["turn"]) + 2 * math.pi * i / 5
            draw([(pos[0], 0.01, pos[2]), (pos[0] + math.cos(ang - 0.3) * 0.05, 0.01, pos[2] + math.sin(ang - 0.3) * 0.05),
                  (pos[0] + math.cos(ang) * 0.14, 0.01, pos[2] + math.sin(ang) * 0.14)], (1.0, 0.55, 0.3))
    for f in orn["fish"]:
        a = math.radians(f["phase"])
        c = np.array([math.cos(a) * f["orbit"], f["height"], math.sin(a) * f["orbit"]])
        t = np.array([-math.sin(a), 0, math.cos(a)]) * 0.12
        draw([c + t, c - t + (0, 0.04, 0), c - t - (0, 0.04, 0)], (1.0, 0.85, 0.35), lit=False)
    return Image.fromarray((np.clip(img, 0, 1) * 255).astype(np.uint8))
