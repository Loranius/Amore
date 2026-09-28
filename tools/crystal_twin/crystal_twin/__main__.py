"""python -m crystal_twin <команда> SNAPSHOT.json [--out ШЛЯХ]

  model    — модель у JSON (те саме, що рахує портал)
  report   — що дав кожен модуль, рік за роком
  render   — картинка кристала на дату знімка
  growth   — смуга: кристал на кожну річницю й на сьогодні
  golden   — перегенерувати golden/*.json (кристал) і golden/tree/*.json
  tree        — модель дерева v2 у JSON (ADR-0218)
  tree-render — картинка дерева на дату знімка
  tree-growth — смуга: дерево на кожну річницю й на сьогодні
  reef        — модель рифу v2 у JSON (ADR-0219)
  reef-render — картинка рифу на дату знімка
  reef-growth — смуга: риф на кожну річницю й на сьогодні
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
from .tree_geometry import summary as tree_summary
from .tree_model import build_tree_model
from .tree_render import framing as tree_framing
from .tree_render import render as tree_render
from .reef_geometry import summary as reef_summary
from .reef_model import build_reef_model
from .reef_render import framing as reef_framing
from .reef_render import render as reef_render

ROOT = Path(__file__).resolve().parent.parent


def _load(path: str) -> dict:
    return json.loads(Path(path).read_text(encoding="utf-8"))


def _growth(snapshot: dict, out: str, species: str = "crystal") -> None:
    start = parse_day(snapshot["startDate"])
    as_of = parse_day(snapshot["asOf"])
    days = []
    k = 1
    while anniversary(start, k) <= as_of:
        days.append(anniversary(start, k))
        k += 1
    days.append(as_of)
    frames = []
    build, draw, frame = {
        "crystal": (build_model, render, framing),
        "tree": (build_tree_model, tree_render, tree_framing),
        "reef": (build_reef_model, reef_render, reef_framing),
    }[species]
    final = frame(build(snapshot))
    for day in days:
        view = dict(snapshot, asOf=day.isoformat())
        image = draw(build(view), 300, 400, frame=final)
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
        tree = build_tree_model(_load(str(fixture)))
        target = ROOT / "golden" / "tree" / fixture.name
        target.parent.mkdir(exist_ok=True)
        payload = {"model": tree, "summary": tree_summary(tree)}
        target.write_text(json.dumps(payload, ensure_ascii=False, indent=1, sort_keys=True) + "\n", encoding="utf-8")
        print(f"golden/tree/{fixture.name}")
        reef = build_reef_model(_load(str(fixture)))
        target = ROOT / "golden" / "reef" / fixture.name
        target.parent.mkdir(exist_ok=True)
        payload = {"model": reef, "summary": reef_summary(reef)}
        target.write_text(json.dumps(payload, ensure_ascii=False, indent=1, sort_keys=True) + "\n", encoding="utf-8")
        print(f"golden/reef/{fixture.name}")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="crystal_twin")
    parser.add_argument("command", choices=["model", "report", "render", "growth", "golden", "tree", "tree-render", "tree-growth", "reef", "reef-render", "reef-growth"])
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
    elif args.command == "tree":
        model = build_tree_model(snapshot)
        text = json.dumps({"model": model, "summary": tree_summary(model)}, ensure_ascii=False, indent=1, sort_keys=True)
        Path(args.out).write_text(text, encoding="utf-8") if args.out else print(text)
    elif args.command == "tree-render":
        tree_render(build_tree_model(snapshot)).save(args.out or "tree.png")
    elif args.command == "tree-growth":
        _growth(snapshot, args.out or "tree-growth.png", "tree")
    elif args.command == "reef":
        model = build_reef_model(snapshot)
        text = json.dumps({"model": model, "summary": reef_summary(model)}, ensure_ascii=False, indent=1, sort_keys=True)
        Path(args.out).write_text(text, encoding="utf-8") if args.out else print(text)
    elif args.command == "reef-render":
        reef_render(build_reef_model(snapshot)).save(args.out or "reef.png")
    elif args.command == "reef-growth":
        _growth(snapshot, args.out or "reef-growth.png", "reef")
    return 0


if __name__ == "__main__":
    sys.exit(main())
