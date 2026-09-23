#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# Ворота, які справді можна пройти.
# ------------------------------------------------------------
# ЩО ТУТ БУЛО. Скрипт перебирав дев'ять воріт — `format:check`, `lint`,
# `typecheck`, `test`, `test:contract`, `test:determinism`,
# `test:serialization`, `test:integration`, `build` — і падав на ПЕРШОМУ
# відсутньому, бо стоїть під `set -euo pipefail`. У `package.json` із них
# існувало три. Тобто ланцюг, який `CLAUDE.md` §«Work Protocol» п.6
# наказує ганяти перед кожною зміною, **не міг завершитись успіхом
# ніколи**, і ніхто цього не бачив, бо CI має власні кроки, а цей скрипт
# не кликав ніхто.
#
# Це гірше за «нема лінтера»: є документ, який каже, що лінтер є.
#
# ЧОМУ ШІСТЬ ВОРІТ НЕ «РЕАЛІЗОВАНО», А ПРИБРАНО. Вибір був між тим, щоб
# дописати відсутнє, і тим, щоб перестати його обіцяти. По кожному окремо:
#
#   format:check, lint  — у репозиторії немає ані конфігу ESLint, ані
#       Prettier. Завести лінтер у зрілий код — це сотні знахідок і зміна
#       кожного файлу. Таке рішення приймає власник, а не скрипт воріт.
#
#   test:contract, test:determinism, test:serialization, test:integration
#       — ці перевірки в наборі Є (16 файлів говорять про детермінізм,
#       11 про контракти), але немає ЖОДНОЇ угоди про імена, якою їх можна
#       вибрати командою. Щоб ворота стали справжніми, довелось би або
#       перейменувати сотні файлів, або підсунути селектор за текстом
#       назви тесту — тобто фальшиву реалізацію, яку `CLAUDE.md` забороняє
#       прямо. Вони ганяються всередині `npm test`, і це правда, а не
#       відмовка: `npm test` — 286 файлів, 2774 перевірки.
#
# ЩО ЗМІНИЛОСЬ, ЩОБ ЦЕ НЕ ЗОТЛІЛО ЗНОВУ. Раніше список воріт був
# побажанням, яке розходилось із `package.json` мовчки. Тепер він
# звіряється: КОЖЕН скрипт у `package.json` мусить бути названий або
# воротами, або не-воротами. Додали `lint` — ворота підхоплять його самі.
# Додали щось інше — перевірка впаде, доки його не назвуть. Розходження
# більше не буває тихим.
# ============================================================

# Ворота: мусять пройти перед зміною. Порядок — від найдешевшого.
GATES=(typecheck test build verify:pages-build)

# Не ворота, і чому саме:
#   dev, preview   — запускають сервер і не завершуються;
#   live, live:diff — жива перевірка очима, потребує `.env.live` і браузера.
NOT_GATES=(dev preview live live:diff)

require_json() {
  [[ -f package.json ]] || { echo "Немає package.json — ворота ні до чого прикласти." >&2; exit 1; }
}

# Звірка списків зі справжнім `package.json`.
check_coverage() {
  require_json
  local known missing
  known="$(printf '%s\n' "${GATES[@]}" "${NOT_GATES[@]}")"
  missing="$(node -e "
    const scripts = Object.keys(require('./package.json').scripts ?? {});
    const known = new Set(process.argv.slice(1));
    console.log(scripts.filter((name) => !known.has(name)).join('\n'));
  " $known)"

  if [[ -n "$missing" ]]; then
    echo "У package.json є скрипти, яких ворота не знають:" >&2
    echo "$missing" | sed 's/^/  - /' >&2
    echo "Додай кожен у GATES або в NOT_GATES у scripts/quality-gate.sh." >&2
    return 1
  fi

  # Зворотний бік: ворота не мусять обіцяти того, чого немає, — саме на
  # цьому старий скрипт і падав.
  local absent
  absent="$(node -e "
    const scripts = new Set(Object.keys(require('./package.json').scripts ?? {}));
    console.log(process.argv.slice(1).filter((name) => !scripts.has(name)).join('\n'));
  " "${GATES[@]}")"
  if [[ -n "$absent" ]]; then
    echo "Ворота обіцяють скрипти, яких у package.json немає:" >&2
    echo "$absent" | sed 's/^/  - /' >&2
    return 1
  fi

  echo "Ворота й package.json збігаються: ${#GATES[@]} воріт, ${#NOT_GATES[@]} не-воріт."
}

run_gate() {
  local script="$1"
  echo "── $script"
  if [[ -f pnpm-lock.yaml ]]; then pnpm run "$script"
  elif [[ -f yarn.lock ]]; then yarn "$script"
  elif [[ -f bun.lockb || -f bun.lock ]]; then bun run "$script"
  else npm run "$script"
  fi
}

if [[ "${1:-}" == "--check" ]]; then
  check_coverage
  exit 0
fi

# `python` є не всюди: частина образів має лише `python3`. Раннер CI —
# саме такий випадок, і дізнатись про це червоним прогоном було б дурним
# способом.
PYTHON="$(command -v python3 || command -v python)"
[[ -n "$PYTHON" ]] || { echo "Немає ані python3, ані python." >&2; exit 1; }
"$PYTHON" scripts/validate_documentation.py
check_coverage

for script in "${GATES[@]}"; do
  # BASE_PATH тут не косметика: `verify:pages-build` типово перевіряє
  # `/Amore/`, і збірка без цієї змінної валить його. Саме так народився
  # хибний висновок «CI зламаний» (аудит §7, пункт 4) — ворота ганяли без
  # неї. Тепер змінна задана тут, тож повторити ту помилку ніде.
  if [[ "$script" == "build" ]]; then BASE_PATH="${BASE_PATH:-/Amore/}" run_gate "$script"
  else run_gate "$script"
  fi
done

echo "Усі ворота пройдено."
