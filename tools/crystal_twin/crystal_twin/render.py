"""Програмний рендер: numpy + z-буфер, без жодної 3D-бібліотеки.

Кристал «намальований, а не освітлений» (навичка crystal-look): тон грані —
колір колонії, помножений на світло ключа й власний зсув грані, плюс світлий
кант на ребрах. Цього досить, щоб на знімку було видно те, що перевіряється:
форму, кількість тіл, колір і те, як усе це росте.
"""
from __future__ import annotations

import math
from typing import Any

import numpy as np
from PIL import Image, ImageDraw

from .geometry import colony, geode
from .hashing import unit

KEY = np.array([-0.5, 0.75, 0.45])
KEY = KEY / np.linalg.norm(KEY)


def _camera(height: float, reach: float, width: int, h: int):
    target = np.array([0.0, height * 0.42, 0.0])
    distance = max(height * 1.55, reach * 3.2)
    eye = target + np.array([0.0, distance * 0.28, distance])
    fwd = target - eye
    fwd /= np.linalg.norm(fwd)
    right = np.cross(fwd, np.array([0.0, 1.0, 0.0]))
    right /= np.linalg.norm(right)
    up = np.cross(right, fwd)
    focal = 0.5 * h / math.tan(math.radians(40) / 2)

    def project(points: np.ndarray) -> np.ndarray:
        rel = points - eye
        x = rel @ right
        y = rel @ up
        z = rel @ fwd
        return np.stack([width / 2 + focal * x / z, h / 2 - focal * y / z, z], axis=-1)

    return project, eye


def framing(model: dict[str, Any]) -> tuple[float, float]:
    m = model["monarch"]
    reach = max([c["distance"] + c["height"] * 0.5 for c in model["children"]] + [m["radius"] * 2])
    return m["height"], reach


def render(model: dict[str, Any], width: int = 480, height: int = 640,
           frame: tuple[float, float] | None = None) -> Image.Image:
    """`frame` — кадр іншої моделі: смуга росту знімає всі роки ОДНІЄЮ
    камерою, інакше кожен рік підганявся б під себе й ріст зник би."""
    m = model["monarch"]
    frame_height, reach = frame or framing(model)
    project, eye = _camera(frame_height, reach, width, height)

    # Небо: нічний градієнт, щоб колір кристала читався, а не тонув.
    yy = np.linspace(0, 1, height)[:, None, None]
    sky = (np.array([0.10, 0.08, 0.20]) * (1 - yy) + np.array([0.30, 0.22, 0.38]) * yy)
    colour = np.broadcast_to(sky, (height, width, 3)).copy()
    depth = np.full((height, width), np.inf)

    tint = np.array(model["colour"]["rgb"])
    glow = model["monarch"]["glow"]
    seed = model["startDate"]

    def draw(tri: np.ndarray, base: np.ndarray, face_key: str, is_rock: bool, edges=(True, True, True)) -> None:
        normal = np.cross(tri[1] - tri[0], tri[2] - tri[0])
        length = np.linalg.norm(normal)
        if length == 0:
            return
        normal /= length
        centre = tri.mean(axis=0)
        if np.dot(normal, eye - centre) < 0:
            normal = -normal
        light = max(0.0, float(np.dot(normal, KEY)))
        jitter = 0.85 + 0.3 * unit(seed, f"face:{face_key}")
        if is_rock:
            shade = base * (0.35 + 0.65 * light) * jitter
        else:
            shade = base * (0.45 + 0.55 * light) * jitter + tint * glow * 0.35
        p = project(tri)
        if np.any(p[:, 2] <= 0.05):
            return
        xs, ys = p[:, 0], p[:, 1]
        x0, x1 = int(max(0, math.floor(xs.min()))), int(min(width - 1, math.ceil(xs.max())))
        y0, y1 = int(max(0, math.floor(ys.min()))), int(min(height - 1, math.ceil(ys.max())))
        if x0 > x1 or y0 > y1:
            return
        gx, gy = np.meshgrid(np.arange(x0, x1 + 1) + 0.5, np.arange(y0, y1 + 1) + 0.5)
        (ax, ay), (bx, by), (cx, cy) = p[0, :2], p[1, :2], p[2, :2]
        den = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy)
        if abs(den) < 1e-9:
            return
        w0 = ((by - cy) * (gx - cx) + (cx - bx) * (gy - cy)) / den
        w1 = ((cy - ay) * (gx - cx) + (ax - cx) * (gy - cy)) / den
        w2 = 1 - w0 - w1
        inside = (w0 >= 0) & (w1 >= 0) & (w2 >= 0)
        if not inside.any():
            return
        z = w0 * p[0, 2] + w1 * p[1, 2] + w2 * p[2, 2]
        region = depth[y0:y1 + 1, x0:x1 + 1]
        hit = inside & (z < region)
        region[hit] = z[hit]
        out = np.broadcast_to(np.clip(shade, 0, 1), (*hit.shape, 3)).copy()
        if not is_rock:
            # Кант грані: світлий обвід там, де до ребра менше ~1.2 пікселя.
            big = 9.0
            edge = np.minimum(np.minimum(
                w0 if edges[0] else big, w1 if edges[1] else big), w2 if edges[2] else big)
            span = max(1.0, math.sqrt(abs(den)))
            rim = edge * span < 1.2
            out[rim] = np.clip(out[rim] * 0.4 + 0.6, 0, 1)
        colour[y0:y1 + 1, x0:x1 + 1][hit] = out[hit]

    for tri, fid, _ in geode(model):
        draw(tri, np.array([0.20, 0.17, 0.24]), f"rock{fid}", True)
    for b in colony(model):
        for tri, fid, edges in b["faces"]:
            draw(tri, tint, f"{b['kind']}:{fid}", False, edges)

    image = Image.fromarray((colour * 255).astype(np.uint8))
    painter = ImageDraw.Draw(image)
    # Іскри віх — поверх: вони світять крізь камінь, як сяйво.
    for b in colony(model):
        for spark in b["sparks"]:
            sx, sy, sz = project(np.array([spark]))[0]
            if sz > 0:
                r = 3
                painter.ellipse([sx - r, sy - r, sx + r, sy + r], fill=(255, 250, 235))
    return image
