"""Програмний рендер дерева v2 (numpy + z-буфер) — для перевірки росту.

Та сама стилізація, що в порталі: пласкі грані, тон кожної грані —
колір × світло ключа × власний зсув, луг — диск, небо — градієнт.
"""
from __future__ import annotations

import math
from typing import Any

import numpy as np
from PIL import Image

from .hashing import unit
from .tree_geometry import cluster_triangles, ornaments, prism_triangles, roots, skeleton

KEY = np.array([-0.55, 0.75, 0.4])
KEY = KEY / np.linalg.norm(KEY)

BARK = np.array([0.36, 0.24, 0.18])
LEAF = np.array([0.30, 0.55, 0.26])
LEAF_AUTUMN = np.array([0.86, 0.52, 0.20])
CHANNEL = {"red": (0.95, 0.35, 0.45), "blue": (0.42, 0.62, 1.0), "green": (0.62, 0.92, 0.45)}
FLOWER = [(1.0, 0.95, 0.85), (1.0, 0.8, 0.35), (0.85, 0.65, 1.0), (1.0, 0.6, 0.7)]


def framing(model: dict[str, Any]) -> tuple[float, float]:
    sk = skeleton(model)
    orn = ornaments(model, sk["clusters"])
    return model["height"], orn["crownRadius"]


def _camera(height: float, reach: float, w: int, h: int):
    target = np.array([0.0, height * 0.45, 0.0])
    distance = max(height * 1.9, reach * 3.4, 2.4)
    eye = target + np.array([0.0, distance * 0.22, distance])
    fwd = target - eye
    fwd /= np.linalg.norm(fwd)
    right = np.cross(fwd, np.array([0.0, 1.0, 0.0]))
    right /= np.linalg.norm(right)
    up = np.cross(right, fwd)
    focal = 0.5 * h / math.tan(math.radians(40) / 2)

    def project(p: np.ndarray) -> np.ndarray:
        rel = p - eye
        z = rel @ fwd
        return np.stack([w / 2 + focal * (rel @ right) / z, h / 2 - focal * (rel @ up) / z, z], axis=-1)

    return project, eye


def render(model: dict[str, Any], width: int = 480, height: int = 640,
           frame: tuple[float, float] | None = None) -> Image.Image:
    seed = model["startDate"]
    fh, reach = frame or framing(model)
    project, eye = _camera(fh, reach, width, height)
    yy = np.linspace(0, 1, height)[:, None, None]
    img = (np.array([0.55, 0.72, 0.92]) * (1 - yy) + np.array([0.98, 0.86, 0.72]) * yy)
    img = np.broadcast_to(img, (height, width, 3)).copy()
    depth = np.full((height, width), np.inf)

    def draw(tri, colour, lit=True):
        tri = np.asarray(tri, float)
        n = np.cross(tri[1] - tri[0], tri[2] - tri[0])
        ln = np.linalg.norm(n)
        if ln == 0:
            return
        n /= ln
        if np.dot(n, eye - tri.mean(0)) < 0:
            n = -n
        shade = (0.35 + 0.75 * max(0.0, float(n @ KEY))) if lit else 1.0
        col = np.clip(np.asarray(colour) * shade, 0, 1)
        s = project(tri)
        if (s[:, 2] <= 0.05).any():
            return
        x0, x1 = int(max(0, s[:, 0].min())), int(min(width - 1, s[:, 0].max() + 1))
        y0, y1 = int(max(0, s[:, 1].min())), int(min(height - 1, s[:, 1].max() + 1))
        if x0 >= x1 or y0 >= y1:
            return
        gx, gy = np.meshgrid(np.arange(x0, x1) + 0.5, np.arange(y0, y1) + 0.5)
        a, b, c = s
        d = (b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1])
        if abs(d) < 1e-9:
            return
        w1 = ((gx - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (gy - a[1])) / d
        w2 = ((b[0] - a[0]) * (gy - a[1]) - (gx - a[0]) * (b[1] - a[1])) / d
        w0 = 1 - w1 - w2
        m = (w0 >= 0) & (w1 >= 0) & (w2 >= 0)
        z = w0 * a[2] + w1 * b[2] + w2 * c[2]
        sub = depth[y0:y1, x0:x1]
        m &= z < sub
        sub[m] = z[m]
        img[y0:y1, x0:x1][m] = col

    sk = skeleton(model)
    orn = ornaments(model, sk["clusters"])
    # Луг: диск із клаптів.
    R = orn["meadowRadius"]
    for i in range(24):
        a0, a1 = 2 * math.pi * i / 24, 2 * math.pi * (i + 1) / 24
        tone = 0.9 + 0.2 * unit(seed, f"meadow{i}")
        draw([(0, -0.001, 0), (math.cos(a0) * R, -0.08, math.sin(a0) * R), (math.cos(a1) * R, -0.08, math.sin(a1) * R)],
             np.array([0.45, 0.66, 0.3]) * tone)
    for f in orn["flowers"]:
        p = np.array(f["position"])
        draw([p + (0.03, 0.02, 0), p + (-0.03, 0.02, 0), p + (0, 0.06, 0.02)], FLOWER[f["tint"]], lit=False)
    for r in roots(model):
        for tri in prism_triangles(r["start"], r["end"], r["r0"], r["r1"], 5):
            draw(tri, BARK * 0.9)
    for b in sk["branches"]:
        for tri in prism_triangles(b["start"], b["end"], b["r0"], b["r1"]):
            draw(tri, BARK)
    for i, c in enumerate(sk["clusters"]):
        autumn = unit(seed, f"{c['key']}:autumn") < model["autumn"]
        base = LEAF_AUTUMN if autumn else LEAF
        for k, tri in enumerate(cluster_triangles(seed, c)):
            draw(tri, base * (0.85 + 0.3 * unit(seed, f"{c['key']}:f{k}")))
    for bl in orn["blossoms"]:
        p = np.array(bl["position"])
        k = model["height"] * 0.018
        for tri in [(p + (k, 0, 0), p + (0, k, 0), p + (0, 0, k)), (p + (-k, 0, 0), p + (0, k, 0), p + (0, 0, -k)),
                    (p + (k, 0, 0), p + (0, k, 0), p + (0, 0, -k)), (p + (-k, 0, 0), p + (0, k, 0), p + (0, 0, k))]:
            draw(tri, CHANNEL[bl["channel"]], lit=False)
    for p in orn["fruits"]:
        p = np.array(p)
        k = model["height"] * 0.025
        for tri in [(p + (k, 0, 0), p + (0, -k, 0), p + (0, 0, k)), (p + (-k, 0, 0), p + (0, -k, 0), p + (0, 0, -k)),
                    (p + (k, 0, 0), p + (0, k, 0), p + (0, 0, -k)), (p + (-k, 0, 0), p + (0, k, 0), p + (0, 0, k))]:
            draw(tri, (1.0, 0.8, 0.25), lit=False)
    return Image.fromarray((np.clip(img, 0, 1) * 255).astype(np.uint8))
