"""Модель росту кристала v2 (ADR-0217) — по одному ефекту на модуль.

Уся модель — ця таблиця, і нічого поза нею:

    час разом (дні)        → висота монарха; кожен дочірній росте зі своїм віком
    роки разом             → по одному дочірньому кристалу на рік
    спогади                → ширина монарха
    виконані плани         → грані монарха (яруси вершини)
    виконані бажання       → колір усієї колонії (правило власника, ADR-0151)
    події «Нашого шляху»   → іскри всередині дочірнього кристала свого року
    місця на мапі          → нахил дочірнього кристала свого року назовні
    переглянуте (медіа)    → внутрішнє сяйво колонії (і нічого більше)
    спільні вихідні         → «добриво» року
    активність року        → розмір дочірнього кристала свого року
                              (спогади, плани, бажання, події, місця, вихідні)

Події до початку стосунків і після дати знімка не враховуються.

Догми власника, які модель тримає за побудовою:
  * час — головна валюта: на ПОРОЖНІЙ історії кристал росте щороку;
  * активність множить ріст, але ніколи не є його умовою;
  * ніщо не меншає з часом;
  * минуле не переписується: дочірній кристал року k залежить лише від
    подій року k і від свого віку.
"""
from __future__ import annotations

import math
from dataclasses import dataclass
from datetime import date
from typing import Any

from . import MODEL_VERSION
from .calendar import anniversary, days_between, parse_day, year_index, years_since, DAYS_PER_YEAR
from .hashing import unit

SIDES = 6

# Вага подій року в «добриві» дочірнього кристала.
ACTIVITY_WEIGHTS = {
    "memories": 1.0,
    "plans": 2.0,
    "wishes": 2.0,
    "events": 1.0,
    "milestones": 2.0,  # понад звичайну подію: віха важить утричі
    "places": 1.5,
    # Медіа НЕ добриво року: переглянуте вносять у застосунок оптом, і в
    # справжньому архіві всі 185 записів мають дати червня–вересня 2026 —
    # рік роздувався б фільмами, яких того року не дивились. Медіа дає
    # лише сяйво (сумою, де дата не важить).
    "media": 0.0,
    "daysOff": 0.25,
}

# Цілі кольору в градусах, червоний розгорнутий як 360°: жодна дуга від
# родини пари (260°–330°) не перетинає жовтий кут (ADR-0151).
GIFT_TARGETS = {"red": 360.0, "blue": 240.0, "green": 120.0}
OWN_HUE_START = 260.0
OWN_HUE_STEP = 14.0
OWN_HUE_STEPS = 6
# Довіра до малої вибірки: сила = відрив / (усього + 3). Без неї ОДНЕ
# бажання — це «усі бажання в одному каналі», і справжній архів пари
# у 2024–2025 ставав чисто червоним від одного-двох подарунків.
GIFT_CONFIDENCE = 3
# Радіус кристала року в частках його висоти (0.2 читалось «пеньками»).
CHILD_SLENDERNESS = 0.16


def r6(x: float) -> float:
    """Округлення, однакове з TS: floor(x·10⁶ + ½) / 10⁶."""
    return math.floor(x * 1e6 + 0.5) / 1e6


@dataclass(frozen=True)
class Dated:
    kind: str
    day: date


def _dated_items(snapshot: dict[str, Any], start: date, as_of: date) -> list[Dated]:
    """Усі події, що вже сталися, — по одному запису на факт."""
    items: list[Dated] = []

    def add(kind: str, text: str | None) -> None:
        if not text:
            return
        day = parse_day(text)
        # До початку стосунків — не історія пари: у «Нашому шляху» лежать
        # дні народження батьків (1963, 1971), і вони лягали б у перший рік.
        if start <= day <= as_of:
            items.append(Dated(kind, day))

    for row in snapshot.get("memories", []):
        add("memories", row.get("date"))
    for row in snapshot.get("plans", []):
        add("plans", row.get("date"))
    for row in snapshot.get("wishes", []):
        add("wishes", row.get("date"))
    for row in snapshot.get("events", []):
        add("events", row.get("date"))
        if row.get("isMilestone"):
            add("milestones", row.get("date"))
    for row in snapshot.get("places", []):
        add("places", row.get("date"))
    for row in snapshot.get("media", []):
        add("media", row.get("date"))
    for text in snapshot.get("daysOff", []):
        add("daysOff", text)
    return items


def _gift_channel(wish: dict[str, Any], partners: dict[str, Any]) -> str:
    owner = wish.get("ownerId")
    giver = wish.get("fulfilledById")
    if wish.get("isShared") or owner is None or giver is None or owner == giver:
        return "green"
    if giver == partners.get("red"):
        return "red"
    if giver == partners.get("blue"):
        return "blue"
    return "green"


def _hsv_to_rgb(hue: float, saturation: float, value: float) -> list[float]:
    h = (hue % 360.0) / 60.0
    sector = math.floor(h)
    f = h - sector
    p = value * (1 - saturation)
    q = value * (1 - saturation * f)
    t = value * (1 - saturation * (1 - f))
    rgb = [
        (value, t, p), (q, value, p), (p, value, t),
        (p, q, value), (t, p, value), (value, p, q),
    ][int(sector) % 6]
    return [r6(c) for c in rgb]


def colony_colour(start_text: str, wishes: list[dict[str, Any]], partners: dict[str, Any], as_of: date) -> dict[str, Any]:
    step = min(OWN_HUE_STEPS - 1, math.floor(unit(start_text, "hue") * OWN_HUE_STEPS))
    own = OWN_HUE_START + step * OWN_HUE_STEP
    counts = {"red": 0, "blue": 0, "green": 0}
    for wish in wishes:
        text = wish.get("date")
        if text and parse_day(text) <= as_of:
            counts[_gift_channel(wish, partners)] += 1
    total = sum(counts.values())
    # Тягне НАЙБІЛЬШИЙ канал; сила — його відрив від другого (ADR-0151).
    ranked = sorted(counts.items(), key=lambda kv: (-kv[1], ["red", "blue", "green"].index(kv[0])))
    lead = ranked[0][1] - ranked[1][1]
    channel = ranked[0][0] if total > 0 and lead > 0 else None
    strength = lead / (total + GIFT_CONFIDENCE) if channel else 0.0
    target = GIFT_TARGETS[channel] if channel else own
    hue = own + (target - own) * strength
    saturation = 0.55 + 0.14 * strength
    return {
        "ownHue": r6(own),
        "hue": r6(hue % 360.0),
        "saturation": r6(saturation),
        "channel": channel,
        "strength": r6(strength),
        "gifts": counts,
        "rgb": _hsv_to_rgb(hue, saturation, 1.0),
    }


def _sides(seed: str, tag: str, radius: float) -> list[list[float]]:
    """Шість вертикальних граней: кут і відстань кожної — трохи свої.
    Грані пласкі, але нерівні — дослівна вимога власника."""
    out = []
    for i in range(SIDES):
        angle = i * 60.0 + (unit(seed, f"{tag}:a{i}") - 0.5) * 14.0
        reach = radius * (0.86 + 0.28 * unit(seed, f"{tag}:r{i}"))
        out.append([r6(angle), r6(reach)])
    return out


def build_model(snapshot: dict[str, Any]) -> dict[str, Any]:
    start_text = snapshot["startDate"]
    start = parse_day(start_text)
    as_of = parse_day(snapshot["asOf"])
    partners = snapshot.get("partners", {})
    seed = start_text[:10]

    days = max(0, days_between(start, as_of))
    years = days / DAYS_PER_YEAR
    items = _dated_items(snapshot, start, as_of)

    counts = {kind: 0 for kind in ACTIVITY_WEIGHTS}
    for item in items:
        counts[item.kind] += 1

    # ── Монарх ────────────────────────────────────────────────
    height = 1.4 + 1.25 * math.log1p(years)                       # час
    # Ширина — спогади, але й час додає трохи: без цього порожня історія
    # давала стовп 3.9:1 — саме той «рожевий стовп», на який власник уже
    # скаржився (навичка crystal-look).
    # Стрункіше, ніж спершу (власник, 2026-09-28: «кристал занадто
    # громіздкий»): 0.40 + 0.10·ln + 0.06·ln давало живій історії 2.1:1.
    radius = 0.30 + 0.06 * math.log1p(years) + 0.035 * math.log1p(counts["memories"])
    tiers = 1 + min(3, int(math.floor(math.log2(1 + counts["plans"]))))                # плани
    tip = radius * 1.28  # ~52°: кут кварцової вершини, а не пропорція тіла
    weights = [0.8 + 0.4 * unit(seed, f"monarch:tier{j}") for j in range(tiers)]
    total_w = sum(weights)
    tier_heights = [r6(tip * w / total_w) for w in weights]
    apex = [
        r6((unit(seed, "monarch:apex:x") - 0.5) * 0.16 * radius),
        r6((unit(seed, "monarch:apex:z") - 0.5) * 0.16 * radius),
    ]
    glow = 0.18 + 0.4 * (1 - math.exp(-counts["media"] / 40.0))    # медіа

    # ── Дочірні: по одному на рік ─────────────────────────────
    last_year = year_index(start, as_of) if as_of >= start else 0
    per_year: dict[int, dict[str, int]] = {}
    for item in items:
        k = year_index(start, item.day)
        per_year.setdefault(k, {kind: 0 for kind in ACTIVITY_WEIGHTS})[item.kind] += 1

    children = []
    for k in range(last_year + 1):
        began = anniversary(start, k)
        age = years_since(began, as_of)
        if age <= 0 and k > 0:
            continue
        mix = per_year.get(k, {kind: 0 for kind in ACTIVITY_WEIGHTS})
        activity = sum(ACTIVITY_WEIGHTS[kind] * mix[kind] for kind in ACTIVITY_WEIGHTS)
        share = 0.14 + 0.08 * math.log1p(age) + 0.045 * math.log1p(activity)
        child_h = height * min(0.55, max(0.12, share))
        child_r = child_h * CHILD_SLENDERNESS
        places_share = (ACTIVITY_WEIGHTS["places"] * mix["places"]) / activity if activity > 0 else 0.0
        children.append({
            "year": k,
            "age": r6(age),
            "activity": r6(activity),
            "mix": mix,
            "height": r6(child_h),
            "radius": r6(child_r),
            "azimuth": r6((k * 137.508 + (unit(seed, f"child{k}:az") - 0.5) * 20.0) % 360.0),
            "distance": r6(radius + 0.14 + 0.09 * math.sqrt(k)),
            "lean": r6(14.0 + 22.0 * places_share),
            "sparks": min(5, mix["milestones"]),
            "sides": _sides(seed, f"child{k}", child_r),
        })

    return {
        "version": MODEL_VERSION,
        "startDate": seed,
        "asOf": snapshot["asOf"][:10],
        "days": days,
        "years": r6(years),
        "counts": counts,
        "monarch": {
            "height": r6(height),
            "radius": r6(radius),
            "tiers": tiers,
            "tierHeights": tier_heights,
            "apex": apex,
            "sides": _sides(seed, "monarch", radius),
            "glow": r6(glow),
        },
        "colour": colony_colour(start_text, snapshot.get("wishes", []), partners, as_of),
        "children": children,
    }
