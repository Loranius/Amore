"""Модель росту дерева v3 (ADR-0218, граматика ADR-0237) — по одному ефекту на модуль.

Власник: «перебери сцену з деревом, створи її з нуля… використовуючи лише
основу росту». Основа росту — закон віку (`species/tree/growthLaw.ts`,
ADR-0090): дерево дорослішає за 40 років, швидко в молодості й повільно
потім, і росте щороку навіть на порожній історії. Усе інше — нове:

    час разом (дні)        → висота й товщина стовбура
    рік разом              → гілка року; яруси по 3 або 4 (ADR-0237)
    активність року        → гілка року довша (≤ ×1.35) і горизонтальніша
    виконані плани         → гілки верхівки
    спогади                → пишність крони
    виконані бажання       → квіти; колір кожної — хто виконав бажання
                              (Лєна — червоний, Діма — блакитний, спільне —
                              зелений: правило кольору ADR-0151, але поштучно)
    віхи «Нашого шляху»    → золоті плоди
    місця на мапі          → коріння, що розходиться по землі
    переглянуте (медіа)    → світлячки довкола крони
    спільні вихідні        → польові квіти на лузі
    місяць дати знімка     → пора року (частка осіннього листя)

Події до початку стосунків і після дати знімка не враховуються (той самий
`_dated_items`, що в кристала).
"""
from __future__ import annotations

import math
from typing import Any

from .calendar import DAYS_PER_YEAR, days_between, parse_day, year_index
from .hashing import unit
from .grammar import tier_slot, year_elements
from .model import _dated_items, _gift_channel, r6

TREE_MODEL_VERSION = "tree-v3/2026-09-29"

# ── Основа росту (не змінена, ADR-0090) ──────────────────────
FULL_TERM_YEARS = 40.0
GROWTH_SATURATION = 3.8


def age_progress(years: float) -> float:
    """0 у день знайомства, 1 на сороковому році; швидко в молодості."""
    term = min(1.0, max(0.0, years) / FULL_TERM_YEARS)
    return (1.0 - math.exp(-GROWTH_SATURATION * term)) / (1.0 - math.exp(-GROWTH_SATURATION))


def height_at(years: float) -> float:
    """Висота дерева на віці `years` (закон ADR-0090)."""
    return 0.35 + 4.65 * age_progress(years)


# Осіннє листя за місяцем (січень…грудень). Узимку дерево не голе: воно
# вічнозелене в стилізації, бо голе дерево на головній читалось би як
# мертве, а не як зима.
AUTUMN_BY_MONTH = (0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.05, 0.25, 0.55, 0.7, 0.15)

MAX_BLOSSOMS = 60


def build_tree_model(snapshot: dict[str, Any]) -> dict[str, Any]:
    start_text = snapshot["startDate"][:10]
    start = parse_day(start_text)
    as_of = parse_day(snapshot["asOf"])
    partners = snapshot.get("partners") or {}
    seed = start_text

    days = max(0, days_between(start, as_of))
    years = days / DAYS_PER_YEAR
    items = _dated_items(snapshot, start, as_of)
    counts = {k: 0 for k in ("memories", "plans", "wishes", "events", "milestones", "places", "media", "daysOff")}
    for item in items:
        counts[item.kind] += 1

    p = age_progress(years)
    height = height_at(years)
    trunk_radius = height * (0.03 + 0.025 * p)
    year_branches = []
    for e in year_elements(snapshot):
        place = tier_slot(seed, e["year"])
        year_branches.append({"year": e["year"], "age": e["age"], "activity": e["activity"],
                              "fertility": e["fertility"], "tier": place["tier"], "slot": place["slot"],
                              "size": place["size"]})
    leafiness = 0.7 + 0.1 * math.log1p(counts["memories"])

    # Квіти: по одній на виконане бажання, найновіші — якщо їх забагато.
    wishes = []
    for row in snapshot.get("wishes", []):
        text = row.get("date")
        if not text:
            continue
        day = parse_day(text)
        if start <= day <= as_of:
            wishes.append((day.isoformat(), row["id"], _gift_channel(row, partners)))
    wishes.sort()
    blossoms = [
        {"id": wid, "channel": channel, "year": year_index(start, parse_day(day))}
        for day, wid, channel in wishes[-MAX_BLOSSOMS:]
    ]

    return {
        "version": TREE_MODEL_VERSION,
        "startDate": start_text,
        "asOf": snapshot["asOf"][:10],
        "days": days,
        "years": r6(years),
        "progress": r6(p),
        "counts": counts,
        "height": r6(height),
        "trunkRadius": r6(trunk_radius),
        "crownLimbs": 2 + min(3, int(math.floor(math.log2(1 + counts["plans"])))),
        "tiers": year_branches[-1]["tier"] + 1 if year_branches else 0,
        "yearBranches": year_branches,
        "leafiness": r6(leafiness),
        "blossoms": blossoms,
        "fruits": min(12, counts["milestones"]),
        "roots": 3 + min(5, int(math.floor(math.log2(1 + counts["places"])))),
        "rootReach": r6(height * (0.09 + 0.018 * math.log1p(counts["places"]))),
        "fireflies": min(36, int(math.floor(6 * math.log1p(counts["media"]) + 0.5))),
        "flowers": min(90, 2 * counts["daysOff"]),
        "autumn": AUTUMN_BY_MONTH[as_of.month - 1],
        "lean": r6(2.0 + 4.0 * unit(seed, "tree:lean")),
        "leanAzimuth": r6(360.0 * unit(seed, "tree:leanAz")),
    }
