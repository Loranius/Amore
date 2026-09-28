# Python-двійник кристала (ADR-0217)

Та сама модель росту, що й у порталі (`src/engine/species/crystalV2`), написана
вдруге Python-ом. Два незалежні записи одного правила звіряються спільним
еталоном (`golden/*.json`): помилку, яку один запис приховав би сам від себе,
ловить розбіжність із другим.

Портал рахує кристал у браузері (TypeScript); двійник — інструмент перевірки й
огляду: малює кристал по роках і каже, що дав кожен модуль.

## Команди

```bash
cd tools/crystal_twin
python3 -m crystal_twin report  SNAPSHOT.json          # що дав кожен модуль, рік за роком
python3 -m crystal_twin growth  SNAPSHOT.json --out g.png   # кристал на кожну річницю й сьогодні
python3 -m crystal_twin render  SNAPSHOT.json --out c.png
python3 -m crystal_twin model   SNAPSHOT.json          # модель у JSON — те саме, що рахує портал
python3 -m crystal_twin golden                         # перегенерувати golden/ з fixtures/
python3 -m unittest discover -s tests                  # або: npm run test:twin
```

Потрібні лише `numpy` і `pillow`.

## Знімок (SNAPSHOT.json)

```json
{
  "startDate": "2022-12-26", "asOf": "2026-09-27",
  "partners": { "red": 2, "blue": 1 },
  "memories": [{ "id": 1, "date": "2026-06-20" }],
  "plans":    [{ "id": 1, "date": "2026-07-02" }],
  "wishes":   [{ "id": 1, "date": "2026-07-14", "isShared": false, "ownerId": 1, "fulfilledById": 2 }],
  "events":   [{ "id": 1, "date": "2022-12-26", "isMilestone": true }],
  "places":   [{ "id": 1, "date": "2026-07-13" }],
  "media":    [{ "id": 1, "date": "2026-07-01" }],
  "daysOff":  ["2026-07-02"]
}
```

`partners.red` — той, чиє виконання чужого бажання тягне колір у червоний
(правило власника, ADR-0151: дівчина → червоний, хлопець → блакитний).

Справжні знімки пари кладіть у `private/` — тека в `.gitignore`: дані пари не
потрапляють у репозиторій.

## Що змінюєш модель — змінюй обидва записи

Правка в `crystal_twin/model.py` без такої самої в `crystalV2/model.ts`
(і навпаки) впаде на звірці з `golden/`. Порядок: правиш обидва, ганяєш
`python3 -m crystal_twin golden`, пояснюєш зміну змісту в ADR.

## Дерево v2 (ADR-0218)

Той самий двійник рахує й дерево: `tree_model.py` (модель, один модуль —
один ефект, основа росту ADR-0090), `tree_geometry.py` (скелет, крона,
коріння, квіти, плоди, світлячки, польові квіти), `tree_render.py`.

```bash
python3 -m crystal_twin tree fixtures/busy.json          # модель + зведення
python3 -m crystal_twin tree-render fixtures/busy.json --out tree.png
python3 -m crystal_twin tree-growth private/real.json --out tree-growth.png
python3 -m crystal_twin golden                           # і golden/tree/*.json
```

## Риф v2 (ADR-0219)

`reef_model.py` (основа — закон голови рифу, колонія на рік, форма — від
головного модуля року), `reef_geometry.py`, `reef_render.py`.

```bash
python3 -m crystal_twin reef fixtures/busy.json
python3 -m crystal_twin reef-growth private/real.json --out reef-growth.png
```
