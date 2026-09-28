"""Модель росту рифу v2 (ADR-0219) — по одному ефекту на модуль.

Власник: «тепер так само перебери сцену рифу з нуля». Як і з деревом, від
старого лишається лише основа росту — закон голови рифу
(`species/reef/colonyFormations.ts`): `0.25 + 0.75·√(min(1, років/25))`,
швидко на початку й повільно потім, і росте щороку навіть без подій.

    час разом (дні)          → розмір кам'яної голови рифу
    роки разом               → по одній колонії корала на рік; росте з віком
    активність року          → розмір колонії свого року й кількість тіл у ній
    головний модуль року     → форма колонії: спогади — мозковик, плани —
                               гіллястий, бажання — віяло, події — трубки,
                               місця — стіл, тиша (лише вихідні) — пальці
    виконані бажання         → актинії; колір кожної — хто виконав бажання
    віхи «Нашого шляху»      → мушлі з перлиною, що світиться
    переглянуте (медіа)      → риби в зграї
    спільні вихідні          → морська трава
    місця на мапі            → морські зірки на піску

Події до початку стосунків і після дати знімка не враховуються.
"""
from __future__ import annotations

import math
from typing import Any

from .calendar import DAYS_PER_YEAR, anniversary, days_between, parse_day, year_index, years_since
from .hashing import unit
from .model import ACTIVITY_WEIGHTS, _dated_items, _gift_channel, r6

REEF_MODEL_VERSION = "reef-v2/2026-09-28"

# ── Основа росту (не змінена) ────────────────────────────────
HEAD_FULL_TERM_YEARS = 25.0
HEAD_SCALE_MIN = 0.25
HEAD_SCALE_MAX = 1.0


def head_scale(years: float) -> float:
    progress = min(1.0, max(0.0, years) / HEAD_FULL_TERM_YEARS)
    return HEAD_SCALE_MIN + (HEAD_SCALE_MAX - HEAD_SCALE_MIN) * math.sqrt(progress)


# Форма колонії за модулем, що важив найбільше того року. Порядок — також
# правило нічиєї: раніший у списку перемагає.
FORM_BY_MODULE = (
    ("memories", "brain"),
    ("plans", "branch"),
    ("wishes", "fan"),
    ("events", "tube"),
    ("places", "table"),
    ("daysOff", "finger"),
)

MAX_ANEMONES = 40


def build_reef_model(snapshot: dict[str, Any]) -> dict[str, Any]:
    start_text = snapshot["startDate"][:10]
    start = parse_day(start_text)
    as_of = parse_day(snapshot["asOf"])
    partners = snapshot.get("partners") or {}
    seed = start_text

    days = max(0, days_between(start, as_of))
    years = days / DAYS_PER_YEAR
    items = _dated_items(snapshot, start, as_of)
    kinds = ("memories", "plans", "wishes", "events", "milestones", "places", "media", "daysOff")
    counts = {k: 0 for k in kinds}
    for item in items:
        counts[item.kind] += 1

    head = head_scale(years)
    radius = 1.3 * head
    rise = 0.6 * head

    # ── Колонії: по одній на рік ─────────────────────────────
    last_year = year_index(start, as_of) if as_of >= start else 0
    per_year: dict[int, dict[str, int]] = {}
    for item in items:
        k = year_index(start, item.day)
        per_year.setdefault(k, {kk: 0 for kk in kinds})[item.kind] += 1
    colonies = []
    for k in range(last_year + 1):
        began = anniversary(start, k)
        age = years_since(began, as_of)
        if age <= 0 and k > 0:
            continue
        mix = per_year.get(k, {kk: 0 for kk in kinds})
        activity = sum(ACTIVITY_WEIGHTS[kind] * mix[kind] for kind in kinds)
        weighted = {m: ACTIVITY_WEIGHTS[m] * mix[m] + (ACTIVITY_WEIGHTS["milestones"] * mix["milestones"] if m == "events" else 0.0)
                    for m, _ in FORM_BY_MODULE}
        best = max(weighted[m] for m, _ in FORM_BY_MODULE)
        form = "finger"
        if best > 0:
            form = next(f for m, f in FORM_BY_MODULE if weighted[m] == best)
        size = min(0.75, max(0.15, 0.18 + 0.1 * math.log1p(age) + 0.045 * math.log1p(activity)))
        colonies.append({
            "year": k,
            "age": r6(age),
            "activity": r6(activity),
            "form": form,
            "size": r6(size),
            # Скільки тіл у колонії року: тихий рік — одне, насичений — до п'яти.
            "bodies": 1 + min(4, int(math.floor(math.log2(1 + activity)))),
            "azimuth": r6((k * 137.508 + (unit(seed, f"colony{k}:az") - 0.5) * 24.0) % 360.0),
            # Частка радіуса голови, де сидить колонія: перша — біля вершини,
            # кожна наступна — далі, по спіралі (як листя на стеблі).
            "reach": r6(min(0.82, 0.12 + 0.19 * math.sqrt(k) + 0.06 * unit(seed, f"colony{k}:reach"))),
            "hue": r6(unit(seed, f"colony{k}:hue")),
        })

    anemones = []
    for row in snapshot.get("wishes", []):
        text = row.get("date")
        if not text:
            continue
        day = parse_day(text)
        if start <= day <= as_of:
            anemones.append((day.isoformat(), row["id"], _gift_channel(row, partners)))
    anemones.sort()

    return {
        "version": REEF_MODEL_VERSION,
        "startDate": start_text,
        "asOf": snapshot["asOf"][:10],
        "days": days,
        "years": r6(years),
        "counts": counts,
        "head": r6(head),
        "radius": r6(radius),
        "rise": r6(rise),
        "colonies": colonies,
        "anemones": [{"id": i, "channel": c} for _, i, c in anemones[-MAX_ANEMONES:]],
        "clams": min(8, counts["milestones"]),
        "fish": min(40, int(math.floor(5 * math.log1p(counts["media"]) + 0.5))),
        "seagrass": min(120, 4 * counts["daysOff"]),
        "starfish": min(10, 1 + int(math.floor(math.log2(1 + counts["places"])))) if counts["places"] else 0,
    }
