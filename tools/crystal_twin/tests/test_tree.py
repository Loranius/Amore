"""Тести дерева v2 у двійнику — догми власника (ADR-0218).

Запуск: cd tools/crystal_twin && python3 -m unittest discover -s tests
"""
from __future__ import annotations

import json
import math
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from crystal_twin.tree_geometry import ornaments, skeleton, summary  # noqa: E402
from crystal_twin.tree_model import age_progress, build_tree_model  # noqa: E402

BASE = {"startDate": "2022-12-26", "asOf": "2026-09-27", "partners": {"red": 2, "blue": 1}}


def fixture(name: str) -> dict:
    return json.loads((ROOT / "fixtures" / f"{name}.json").read_text(encoding="utf-8"))


def with_(**rows) -> dict:
    return build_tree_model(dict(BASE, **rows))


def dated(n: int, day: str = "2024-05-05") -> list[dict]:
    return [{"id": i, "date": day} for i in range(n)]


class TimeIsTheCurrency(unittest.TestCase):
    """ДОГМА ВЛАСНИКА: дерево дорослішає щороку навіть на порожній історії."""

    def test_empty_history_grows_every_year_and_never_shrinks(self):
        previous = None
        for year in range(2023, 2066):
            model = build_tree_model(dict(BASE, asOf=f"{year}-12-27"))
            sk = skeleton(model)
            now = (model["height"], model["trunkRadius"], model["orders"], len(sk["branches"]))
            if previous:
                # Основа росту (ADR-0090) доростає за 40 років і далі тримає
                # розмір: строго росте до сорокового року, потім не меншає.
                grow = self.assertGreater if year <= 2062 else self.assertGreaterEqual
                grow(now[0], previous[0])
                grow(now[1], previous[1])
                self.assertGreaterEqual(now[2], previous[2])
                self.assertGreaterEqual(now[3], previous[3])
            previous = now

    def test_growth_law_is_the_old_one(self):
        # Основа росту не змінена (ADR-0090): 0 на старті, 1 на сороковому році.
        self.assertEqual(age_progress(0.0), 0.0)
        self.assertAlmostEqual(age_progress(40.0), 1.0, places=12)
        self.assertEqual(age_progress(80.0), age_progress(40.0))


class OneModuleOneEffect(unittest.TestCase):
    """Кожен модуль міняє рівно своє поле моделі і нічого більше."""

    FIELDS = ("height", "trunkRadius", "orders", "limbs", "leafiness", "blossoms", "fruits",
              "roots", "rootReach", "fireflies", "flowers")

    def changed(self, **rows) -> set[str]:
        a, b = with_(), with_(**rows)
        return {f for f in self.FIELDS if a[f] != b[f]}

    def test_each_module(self):
        self.assertEqual(self.changed(plans=dated(7)), {"limbs"})
        self.assertEqual(self.changed(memories=dated(40)), {"leafiness"})
        self.assertEqual(self.changed(wishes=dated(3)), {"blossoms"})
        self.assertEqual(self.changed(events=[{"id": 1, "date": "2024-01-01", "isMilestone": True}]), {"fruits"})
        self.assertEqual(self.changed(places=dated(12)), {"roots", "rootReach"})
        self.assertEqual(self.changed(media=dated(30)), {"fireflies"})
        self.assertEqual(self.changed(daysOff=["2024-05-01", "2024-05-02"]), {"flowers"})

    def test_blossom_colour_is_who_granted_the_wish(self):
        wishes = [
            {"id": 1, "date": "2024-01-01", "ownerId": 1, "fulfilledById": 2},
            {"id": 2, "date": "2024-02-01", "ownerId": 2, "fulfilledById": 1},
            {"id": 3, "date": "2024-03-01", "isShared": True},
        ]
        self.assertEqual([b["channel"] for b in with_(wishes=wishes)["blossoms"]], ["red", "blue", "green"])

    def test_events_outside_the_story_do_not_count(self):
        self.assertEqual(with_(memories=dated(5, "1971-03-03"))["leafiness"], with_()["leafiness"])
        self.assertEqual(with_(memories=dated(5, "2030-01-01"))["leafiness"], with_()["leafiness"])


class Geometry(unittest.TestCase):
    def test_crown_top_is_the_model_height(self):
        for name in ("empty", "busy", "leap_day"):
            model = build_tree_model(fixture(name))
            self.assertAlmostEqual(summary(model)["top"], round(model["height"], 4), places=3)

    def test_every_number_is_finite(self):
        model = build_tree_model(fixture("busy"))
        sk = skeleton(model)
        orn = ornaments(model, sk["clusters"])
        for b in sk["branches"]:
            for v in (*b["start"], *b["end"], b["r0"], b["r1"]):
                self.assertTrue(math.isfinite(v))
            self.assertGreater(b["r1"], 0)
        self.assertEqual(len(orn["blossoms"]), len(model["blossoms"]))

    def test_same_input_same_output(self):
        self.assertEqual(summary(build_tree_model(fixture("busy"))), summary(build_tree_model(fixture("busy"))))

    def test_golden_files_are_current(self):
        for path in sorted((ROOT / "fixtures").glob("*.json")):
            golden = json.loads((ROOT / "golden" / "tree" / path.name).read_text(encoding="utf-8"))
            model = build_tree_model(json.loads(path.read_text(encoding="utf-8")))
            self.assertEqual(golden, json.loads(json.dumps({"model": model, "summary": summary(model)})))


if __name__ == "__main__":
    unittest.main()
