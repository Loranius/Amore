"""Тести двійника — ті самі догми, що в порталі (ADR-0217).

Запуск: cd tools/crystal_twin && python3 -m unittest discover -s tests
"""
from __future__ import annotations

import json
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from crystal_twin.calendar import anniversary, year_index  # noqa: E402
from crystal_twin.hashing import hash32  # noqa: E402
from crystal_twin.model import build_model  # noqa: E402
from crystal_twin.geometry import body, monarch_body, monarch_profile  # noqa: E402

import numpy as np  # noqa: E402

# Еталонні значення: ті самі стоять у `crystalV2/hash.test.ts`.
HASH_EMPTY = 2872998923
HASH_AMORE = 1425516499
HASH_CYRILLIC = 3800902002


def fixture(name: str) -> dict:
    return json.loads((ROOT / "fixtures" / f"{name}.json").read_text(encoding="utf-8"))


def at(snapshot: dict, day: str) -> dict:
    return build_model(dict(snapshot, asOf=day))


class TimeIsTheCurrency(unittest.TestCase):
    """ДОГМА ВЛАСНИКА: з кожним роком кристал дорослішає навіть без подій."""

    def test_empty_history_grows_every_year(self):
        empty = fixture("empty")
        previous = None
        for year in range(2023, 2040):
            model = at(empty, f"{year}-12-27")
            size = (model["monarch"]["height"], model["monarch"]["radius"], len(model["children"]))
            if previous is not None:
                self.assertGreater(size[0], previous[0])
                self.assertGreater(size[1], previous[1])
                self.assertGreater(size[2], previous[2])
            previous = size

    def test_nothing_ever_shrinks_even_with_data(self):
        busy = fixture("busy")
        previous = None
        for month in range(1, 45):
            day = f"{2023 + (month - 1) // 12}-{(month - 1) % 12 + 1:02d}-15"
            model = at(busy, day)
            heights = {c["year"]: c["height"] for c in model["children"]}
            if previous is not None:
                self.assertGreaterEqual(model["monarch"]["height"], previous[0])
                self.assertGreaterEqual(model["monarch"]["radius"], previous[1])
                for year, h in previous[2].items():
                    self.assertGreaterEqual(heights[year], h - 1e-9)
            previous = (model["monarch"]["height"], model["monarch"]["radius"], heights)


class OneEffectPerModule(unittest.TestCase):
    """Три виміри монарха — три незалежні джерела (ADR-0004, ADR-0151)."""

    def setUp(self):
        self.base = fixture("empty")

    def test_monarch_is_slender_not_bulky(self):
        # Власник, 2026-09-28: «кристал занадто громіздкий». Жива історія
        # (≈3.75 року, 61 спогад) давала 2.1:1; стрункий монарх — від 2.8:1,
        # і навіть сто спогадів за двадцять років не роблять із нього брус.
        live = build_model({"startDate": "2022-12-26", "asOf": "2026-09-27", "partners": {},
                            "memories": [{"id": i, "date": "2024-01-01"} for i in range(61)]})
        m = live["monarch"]
        self.assertGreaterEqual(m["height"] / (2 * m["radius"]), 2.8)
        rich = build_model({"startDate": "2022-12-26", "asOf": "2042-12-26", "partners": {},
                            "memories": [{"id": i, "date": "2030-01-01"} for i in range(400)]})
        m = rich["monarch"]
        self.assertGreaterEqual(m["height"] / (2 * m["radius"]), 2.5)
        for child in live["children"]:
            self.assertAlmostEqual(child["radius"] / child["height"], 0.16, places=4)

    def test_memories_only_widen(self):
        a = build_model(self.base)
        b = build_model(dict(self.base, memories=[{"id": i, "date": "2024-05-01"} for i in range(20)]))
        self.assertGreater(b["monarch"]["radius"], a["monarch"]["radius"])
        self.assertEqual(b["monarch"]["height"], a["monarch"]["height"])
        self.assertEqual(b["monarch"]["tiers"], a["monarch"]["tiers"])

    def test_plans_only_add_facets(self):
        a = build_model(self.base)
        b = build_model(dict(self.base, plans=[{"id": i, "date": "2024-05-01"} for i in range(7)]))
        self.assertGreater(b["monarch"]["tiers"], a["monarch"]["tiers"])
        self.assertEqual(b["monarch"]["height"], a["monarch"]["height"])
        self.assertEqual(b["monarch"]["radius"], a["monarch"]["radius"])

    def test_media_only_glows(self):
        a = build_model(self.base)
        b = build_model(dict(self.base, media=[{"id": i, "date": "2024-05-01"} for i in range(50)]))
        self.assertGreater(b["monarch"]["glow"], a["monarch"]["glow"])
        self.assertEqual(b["monarch"]["radius"], a["monarch"]["radius"])

    def test_one_child_per_year(self):
        model = build_model(self.base)  # 3.75 року → 4 роки, четвертий триває
        self.assertEqual([c["year"] for c in model["children"]], [0, 1, 2, 3])

    def test_milestones_spark_their_own_year_and_places_lean_it(self):
        b = build_model(dict(self.base,
                             events=[{"id": 1, "date": "2024-03-01", "isMilestone": True}],
                             places=[{"id": 1, "date": "2024-03-02"}]))
        year1 = next(c for c in b["children"] if c["year"] == 1)
        year0 = next(c for c in b["children"] if c["year"] == 0)
        self.assertEqual(year1["sparks"], 1)
        self.assertEqual(year0["sparks"], 0)
        self.assertGreater(year1["lean"], year0["lean"])


class ThePastIsNotRewritten(unittest.TestCase):
    """Нова подія додає шар — дочірні минулих років не змінюються."""

    def test_new_event_changes_only_the_current_year_child(self):
        busy = fixture("busy")
        before = build_model(busy)
        after = build_model(dict(busy, memories=busy["memories"] + [{"id": 999, "date": "2026-09-20"}]))
        # ВЛАСНЕ ТІЛО кристала минулого року незмінне. Відстань до осі — ні:
        # монарх ширшає від спогадів, і дочірні стоять від нього на відступі,
        # інакше він би в них врізався. Це розстановка, а не переписане
        # минуле — і тест першої редакції, що вимагав рівності всього,
        # зловив саме цю різницю.
        own = ("year", "age", "activity", "mix", "height", "radius", "azimuth", "lean", "sparks", "sides")
        for old, new in zip(before["children"][:-1], after["children"][:-1]):
            self.assertEqual({k: old[k] for k in own}, {k: new[k] for k in own})
            self.assertGreaterEqual(new["distance"], old["distance"])
        self.assertNotEqual(before["children"][-1]["activity"], after["children"][-1]["activity"])


class ColourRule(unittest.TestCase):
    """ADR-0151: тягне найбільший канал, сила — відрив від другого."""

    def test_one_sided_gifts_pull_to_red(self):
        model = build_model(fixture("gifts_red"))
        self.assertEqual(model["colour"]["channel"], "red")
        # П'ять однобоких подарунків: 5 / (5 + 3). Повна сила — лише на
        # великій вибірці (див. наступний тест).
        self.assertAlmostEqual(model["colour"]["strength"], 0.625, places=6)
        r, g, b = model["colour"]["rgb"]
        self.assertGreater(r, g)
        self.assertGreater(r, b)

    def test_one_wish_does_not_repaint_the_colony(self):
        """Регресія зі справжнього архіву: одне бажання фарбувало кристал цілком."""
        one = dict(fixture("empty"), wishes=[{"id": 1, "date": "2024-03-12", "isShared": False,
                                              "ownerId": 1, "fulfilledById": 2}])
        self.assertLessEqual(build_model(one)["colour"]["strength"], 0.25)
        many = dict(fixture("empty"), wishes=[{"id": i, "date": "2024-03-12", "isShared": False,
                                               "ownerId": 1, "fulfilledById": 2} for i in range(30)])
        self.assertGreater(build_model(many)["colour"]["strength"], 0.9)

    def test_balanced_gifts_keep_the_couples_own_hue(self):
        model = build_model(fixture("busy"))
        self.assertIsNone(model["colour"]["channel"])
        self.assertEqual(model["colour"]["hue"], model["colour"]["ownHue"])

    def test_never_yellow(self):
        """Жовтий кварц — цитрин, інший камінь: жодна ціль не проходить 45°–75°."""
        base = fixture("empty")
        for channel_owner, giver, shared in [(1, 2, False), (2, 1, False), (1, 2, True)]:
            for n in range(1, 8):
                wishes = [{"id": i, "date": "2024-01-01", "isShared": shared,
                           "ownerId": channel_owner, "fulfilledById": giver} for i in range(n)]
                hue = build_model(dict(base, wishes=wishes))["colour"]["hue"]
                self.assertFalse(45 <= hue <= 75, hue)


class Determinism(unittest.TestCase):
    def test_same_input_same_output(self):
        busy = fixture("busy")
        self.assertEqual(json.dumps(build_model(busy), sort_keys=True), json.dumps(build_model(busy), sort_keys=True))

    def test_hash_matches_the_portal(self):
        # Ті самі числа стоять у `crystalV2/hash.test.ts`: хеш звірений побітово.
        self.assertEqual(hash32(""), HASH_EMPTY)
        self.assertEqual(hash32("amore"), HASH_AMORE)
        self.assertEqual(hash32("Кристал"), HASH_CYRILLIC)  # UTF-8, а не UTF-16

    def test_golden_files_are_current(self):
        for fixture_path in sorted((ROOT / "fixtures").glob("*.json")):
            golden = json.loads((ROOT / "golden" / fixture_path.name).read_text(encoding="utf-8"))
            model = build_model(json.loads(fixture_path.read_text(encoding="utf-8")))
            self.assertEqual(json.loads(json.dumps(model)), golden, fixture_path.name)


class Calendar(unittest.TestCase):
    def test_leap_day_start_uses_feb_28(self):
        from datetime import date
        start = date(2020, 2, 29)
        self.assertEqual(anniversary(start, 1), date(2021, 2, 28))
        self.assertEqual(year_index(start, date(2021, 2, 27)), 0)
        self.assertEqual(year_index(start, date(2021, 2, 28)), 1)


class Geometry(unittest.TestCase):
    """Грані пласкі за побудовою — перевіряється, а не мається на увазі."""

    def test_every_face_is_planar(self):
        model = build_model(fixture("busy"))
        m = model["monarch"]
        faces = monarch_body(model["startDate"], m["sides"], m["height"], sum(m["tierHeights"]),
                             m["tiers"], 0.3, monarch_profile(model["startDate"]))
        by_face: dict[int, list[np.ndarray]] = {}
        for tri, face, *_ in faces:
            by_face.setdefault(face, []).extend(tri)
        for face, points in by_face.items():
            pts = np.array(points)
            centred = pts - pts.mean(axis=0)
            smallest = np.linalg.svd(centred, compute_uv=False)[-1]
            self.assertLess(smallest, 1e-9, f"грань {face} не пласка")


if __name__ == "__main__":
    unittest.main()
