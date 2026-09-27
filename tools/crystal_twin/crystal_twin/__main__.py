"""python -m crystal_twin <команда> SNAPSHOT.json [--out ШЛЯХ]

  model    — модель у JSON (те саме, що рахує портал)
  report   — що дав кожен модуль, рік за роком
  render   — картинка кристала на дату знімка
  growth   — смуга: кристал на кожну річницю й на сьогодні
  golden   — перегенерувати golden/*.json із fixtures/*.json
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from PIL import Image, ImageDraw

from .calendar import anniversary, parse_day
from .model import build_model
from .render import framing, render
from .report import text_report

ROOT = Path(__file__).resolve().parent.parent


def _load(path: str) -> dict:
    return json.loads(Path(path).read_text(encoding="utf-8"))


def _growth(snapshot: dict, out: str) -> None:
    start = parse_day(snapshot["startDate"])
    as_of = parse_day(snapshot["asOf"])
    days = []
    k = 1
    while anniversary(start, k) <= as_of:
        days.append(anniversary(start, k))
        k += 1
    days.append(as_of)
    frames = []
    final = framing(build_model(snapshot))
    for day in days:
        view = dict(snapshot, asOf=day.isoformat())
        image = render(build_model(view), 300, 400, frame=final)
        ImageDraw.Draw(image).text((10, 10), day.isoformat(), fill=(255, 255, 255))
        frames.append(image)
    strip = Image.new("RGB", (300 * len(frames), 400))
    for i, frame in enumerate(frames):
        strip.paste(frame, (300 * i, 0))
    strip.save(out)


def _golden() -> None:
    for fixture in sorted((ROOT / "fixtures").glob("*.json")):
        model = build_model(_load(str(fixture)))
        target = ROOT / "golden" / fixture.name
        target.write_text(json.dumps(model, ensure_ascii=False, indent=1, sort_keys=True) + "\n", encoding="utf-8")
        print(f"golden/{fixture.name}")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="crystal_twin")
    parser.add_argument("command", choices=["model", "report", "render", "growth", "golden"])
    parser.add_argument("snapshot", nargs="?")
    parser.add_argument("--out")
    args = parser.parse_args(argv)
    if args.command == "golden":
        _golden()
        return 0
    if not args.snapshot:
        parser.error("потрібен SNAPSHOT.json")
    snapshot = _load(args.snapshot)
    if args.command == "model":
        text = json.dumps(build_model(snapshot), ensure_ascii=False, indent=1, sort_keys=True)
        Path(args.out).write_text(text, encoding="utf-8") if args.out else print(text)
    elif args.command == "report":
        print(text_report(build_model(snapshot)))
    elif args.command == "render":
        render(build_model(snapshot)).save(args.out or "crystal.png")
    elif args.command == "growth":
        _growth(snapshot, args.out or "growth.png")
    return 0


if __name__ == "__main__":
    sys.exit(main())
