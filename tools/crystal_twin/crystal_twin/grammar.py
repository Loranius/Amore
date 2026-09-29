"""Одна граматика росту (ADR-0237) — дзеркало `src/engine/species/grammar/grammar.ts`.

Кожен прожитий рік разом — один елемент року; його розмір — активність
року зі стелею ×1.35; дерево ставить гілки років ярусами по 3 або 4.
"""
from __future__ import annotations

import math
from typing import Any

from .calendar import anniversary, parse_day, year_index, years_since
from .hashing import unit
from .model import ACTIVITY_WEIGHTS, _dated_items, r6

YEAR_ACTIVITY_FULL = 40.0
YEAR_BOOST_CAP = 1.35


def year_fertility(activity: float) -> float:
    return min(1.0, math.log1p(max(0.0, activity)) / math.log1p(YEAR_ACTIVITY_FULL))


def year_boost(activity: float) -> float:
    return 1.0 + (YEAR_BOOST_CAP - 1.0) * year_fertility(activity)


def year_elements(snapshot: dict[str, Any]) -> list[dict[str, Any]]:
    start = parse_day(snapshot["startDate"][:10])
    as_of = parse_day(snapshot["asOf"][:10])
    per_year: dict[int, dict[str, int]] = {}
    for item in _dated_items(snapshot, start, as_of):
        k = year_index(start, item.day)
        per_year.setdefault(k, {kind: 0 for kind in ACTIVITY_WEIGHTS})[item.kind] += 1
    last_year = year_index(start, as_of) if as_of >= start else 0
    out = []
    for k in range(last_year + 1):
        age = years_since(anniversary(start, k), as_of)
        if age <= 0 and k > 0:
            continue
        mix = per_year.get(k, {kind: 0 for kind in ACTIVITY_WEIGHTS})
        activity = sum(ACTIVITY_WEIGHTS[kind] * mix[kind] for kind in ACTIVITY_WEIGHTS)
        out.append({
            "year": k,
            "age": r6(max(0.0, age)),
            "lived": r6(max(0.0, min(1.0, age))),
            "activity": r6(activity),
            "fertility": r6(year_fertility(activity)),
        })
    return out


def tier_size(seed: str, tier: int) -> int:
    return 3 if unit(seed, f"tier{tier}:size") < 0.5 else 4


def tier_slot(seed: str, year: int) -> dict[str, int]:
    tier = 0
    first = 0
    while True:
        size = tier_size(seed, tier)
        if year < first + size:
            return {"tier": tier, "slot": year - first, "size": size}
        first += size
        tier += 1
