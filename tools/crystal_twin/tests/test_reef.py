"""Тести рифу v2 у двійнику — догми власника (ADR-0219).

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

from crystal_twin.reef_geometry import colony_triangles, placements, summary  # noqa: E402
from crystal_twin.reef_model import build_reef_model, head_scale  # noqa: E402

BASE = {"startDate": "2022-12-26", "asOf": "2026-09-27", "partners": {"red": 2, "blue": 1}}


def fixture(name: str) -> dict:
    return json.loads((ROOT / "fixtures" / f"{name}.json").read_text(encoding="utf-8"))


def with_(**rows) -> dict:
    return build_reef_model(dict(BASE, **rows))


def dated(n: int, day: str = "2024-05-05") -> list[dict]:
    return [{"id": i, "date": day} for i in range(n)]


class TimeIsTheCurrency(unittest.TestCase):
    """ДОГМА ВЛАСНИКА: риф дорослішає щороку навіть на порожній історії."""

    def test_empty_history_grows_every_year_and_never_shrinks(self):
        previous = None
        for year in range(2023, 2060):
            model = build_reef_model(dict(BASE, asOf=f"{year}-12-27"))
            now = (model["radius"], len(model["colonies"]), summary(model)["top"])
            if previous:
                # Основа росту доростає за 25 років і далі тримає розмір голови;
                # колоній однаково додається по одній на рік.
                grow = self.assertGreater if year <= 2047 else self.assertGreaterEqual
                grow(now[0], previous[0])
                self.assertEqual(now[1], previous[1] + 1)
                self.assertGreaterEqual(now[2], previous[2] - 1e-9)
            previous = now

    def test_growth_law_is_the_old_one(self):
        self.assertEqual(head_scale(0.0), 0.25)
        self.assertEqual(head_scale(25.0), 1.0)
        self.assertEqual(head_scale(60.0), 1.0)

    def test_past_colony_does_not_change_when_a_new_year_is_busy(self):
        # Минуле не переписується: подія цього року не міняє колонію минулого.
        a = with_()
        b = with_(memories=dated(30, "2026-06-01"))
        self.assertEqual(a["colonies"][0]["form"], b["colonies"][0]["form"])
        self.assertEqual(a["colonies"][0]["size"], b["colonies"][0]["size"])


class OneModuleOneEffect(unittest.TestCase):
    FIELDS = ("radius", "anemones", "clams", "fish", "seagrass", "starfish")

    def changed(self, **rows) -> set[str]:
        a, b = with_(), with_(**rows)
        return {f for f in self.FIELDS if a[f] != b[f]}

    def test_each_module(self):
        self.assertEqual(self.changed(wishes=dated(3)), {"anemones"})
        self.assertEqual(self.changed(events=[{"id": 1, "date": "2024-01-01", "isMilestone": True}]), {"clams"})
        self.assertEqual(self.changed(media=dated(30)), {"fish"})
        self.assertEqual(self.changed(daysOff=["2024-05-01"]), {"seagrass"})
        self.assertEqual(self.changed(places=dated(5)), {"starfish"})
        self.assertEqual(self.changed(memories=dated(9)), set())

    def test_year_form_follows_the_module_that_weighed_most(self):
        for rows, form in (
            ({"memories": dated(5)}, "brain"),
            ({"plans": dated(5)}, "branch"),
            ({"wishes": dated(5)}, "fan"),
            ({"events": dated(5)}, "tube"),
            ({"places": dated(5)}, "table"),
            ({}, "finger"),
        ):
            year = with_(**rows)["colonies"][1]
            self.assertEqual(year["form"], form, rows)

    def test_anemone_colour_is_who_granted_the_wish(self):
        wishes = [
            {"id": 1, "date": "2024-01-01", "ownerId": 1, "fulfilledById": 2},
            {"id": 2, "date": "2024-02-01", "ownerId": 2, "fulfilledById": 1},
            {"id": 3, "date": "2024-03-01", "isShared": True},
        ]
        self.assertEqual([a["channel"] for a in with_(wishes=wishes)["anemones"]], ["red", "blue", "green"])


class Geometry(unittest.TestCase):
    def test_every_colony_mesh_is_finite(self):
        model = build_reef_model(fixture("busy"))
        for place in placements(model):
            tris = colony_triangles(model, place)
            self.assertGreater(len(tris), 0)
            for tri in tris:
                for p in tri:
                    for v in p:
                        self.assertTrue(math.isfinite(v))

    def test_golden_files_are_current(self):
        for path in sorted((ROOT / "fixtures").glob("*.json")):
            golden = json.loads((ROOT / "golden" / "reef" / path.name).read_text(encoding="utf-8"))
            model = build_reef_model(json.loads(path.read_text(encoding="utf-8")))
            self.assertEqual(golden, json.loads(json.dumps({"model": model, "summary": summary(model)})))


if __name__ == "__main__":
    unittest.main()
