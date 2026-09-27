"""Звіт: що дав кожен модуль і як ріс кристал рік за роком."""
from __future__ import annotations

from typing import Any

MODULE_EFFECT = [
    ("days", "Час разом", "висота монарха; дочірні ростуть зі своїм віком"),
    ("memories", "Спогади", "ширина монарха"),
    ("plans", "Виконані плани", "яруси вершини монарха (грані)"),
    ("wishes", "Виконані бажання", "колір усієї колонії"),
    ("events", "Події «Нашого шляху»", "добриво року"),
    ("milestones", "Віхи", "іскри в кристалі свого року"),
    ("places", "Місця на мапі", "нахил кристала свого року назовні"),
    ("media", "Переглянуте", "внутрішнє сяйво колонії"),
    ("daysOff", "Спільні вихідні", "добриво року"),
]

NOT_FED = [
    ("Покупки", "побут, а не історія пари: список молока не має робити кристал більшим"),
    ("Кулінарія", "рецепти — бібліотека, а не подія; приготоване разом варто записати спогадом"),
    ("Куди піти", "пошук подій, а не прожите; сходили — це план або спогад"),
    ("Заміри", "довідка про розміри"),
    ("Гра", "розвага поза історією пари"),
]


def text_report(model: dict[str, Any]) -> str:
    c = model["counts"]
    m = model["monarch"]
    col = model["colour"]
    lines = [
        f"Кристал v2 · {model['version']}",
        f"Разом з {model['startDate']} по {model['asOf']}: {model['days']} днів ({model['years']:.2f} р.)",
        "",
        "Модуль → що він робить → скільки дав",
    ]
    for key, name, effect in MODULE_EFFECT:
        value = model["days"] if key == "days" else c.get(key, 0)
        lines.append(f"  {name:<24} {effect:<48} {value}")
    lines += ["", "Не годують кристал (свідомо):"]
    for name, why in NOT_FED:
        lines.append(f"  {name:<12} {why}")
    lines += [
        "",
        f"Монарх: висота {m['height']:.3f}, ширина {m['radius']:.3f}, ярусів вершини {m['tiers']}, сяйво {m['glow']:.3f}",
        f"Колір: власний відтінок {col['ownHue']:.0f}° → {col['hue']:.0f}°, "
        f"подарунки {col['gifts']} → тягне {col['channel'] or 'ніхто'} на {col['strength']:.2f}",
        "",
        "Рік  вік   добриво  висота  нахил  іскри  (спогади/плани/бажання/події/місця/медіа/вихідні)",
    ]
    for ch in model["children"]:
        mx = ch["mix"]
        lines.append(
            f"{ch['year'] + 1:>3}  {ch['age']:4.2f}  {ch['activity']:7.2f}  {ch['height']:6.3f}  "
            f"{ch['lean']:5.1f}  {ch['sparks']:>5}  "
            f"({mx['memories']}/{mx['plans']}/{mx['wishes']}/{mx['events']}/{mx['places']}/{mx['media']}/{mx['daysOff']})"
        )
    return "\n".join(lines)
