"""Роки стосунків — від річниці до річниці, як у порталі.

29 лютого в невисокосний рік стає 28-м (та сама політика `feb-28`).
"""
from __future__ import annotations

from datetime import date

DAYS_PER_YEAR = 365.2425


def parse_day(text: str) -> date:
    return date.fromisoformat(text[:10])


def anniversary(start: date, k: int) -> date:
    year = start.year + k
    try:
        return date(year, start.month, start.day)
    except ValueError:  # 29 лютого
        return date(year, 2, 28)


def days_between(a: date, b: date) -> int:
    return (b - a).days


def year_index(start: date, day: date) -> int:
    """Номер року стосунків, у який припала дата. До початку — рік 0."""
    if day < start:
        return 0
    k = day.year - start.year
    while k > 0 and anniversary(start, k) > day:
        k -= 1
    while anniversary(start, k + 1) <= day:
        k += 1
    return k


def years_since(start: date, day: date) -> float:
    return max(0, days_between(start, day)) / DAYS_PER_YEAR
