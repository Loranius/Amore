import type { CSSProperties } from 'react';
import { offeredShades, starShadeOf } from '@/features/journey/starPalette';
import type { ConstellationLevel } from '@/features/journey/constellationRules';

// ============================================================
// Вибір кольору зірки.
// ------------------------------------------------------------
// Показується лише для подій шляху. Календарна позначка зіркою не стає, і
// пропонувати їй колір означало б обіцяти те, чого пара ніколи не побачить.
//
// **Ряд веде рівень.** Родина відтінків іде за вагою події, тож підняти подію
// до важливої — значить дістати фіолетовий ряд замість холодного. Що робити з
// уже обраним відтінком чужої родини, вирішує `offeredShades`, і рішення там
// же пояснене: він лишається в ряду, а не зникає.
//
// **«Авто» — це не «без кольору».** Порожнє значення в базі означає «хай обере
// шлях», і небо все одно дасть зірці відтінок родини, виведений з її `id`.
// Тому чип показує САМЕ ТОЙ колір, який дістанеться події, а не сірий кружечок:
// інакше пара обирала б наосліп між «якимось» і конкретним.
// ============================================================

export interface StarColourPickerProps {
  /** `id` події. Нової ще немає — тоді 0, і «авто» показує перший відтінок. */
  eventId: number;
  level: ConstellationLevel;
  /** Обраний токен. `null` — «авто». */
  value: string | null;
  onChange: (token: string | null) => void;
}

export function StarColourPicker({ eventId, level, value, onChange }: StarColourPickerProps) {
  const shades = offeredShades(level, value);
  const auto = starShadeOf({ id: eventId, level });
  const preview = shades.find((shade) => shade.token === value) ?? auto;

  return (
    <section className="cal-entry-colour" aria-labelledby="cal-entry-colour-title">
      <span className="cal-entry-field-label" id="cal-entry-colour-title">Колір зірки</span>

      <div className="cal-entry-colour-row">
        {/*
          Preview — це ВИХІД, а не ще один вибір, і саме тому він у власному
          стовпці з підписом, а не в одному ряду з кружечками. Перша редакція
          поставила його поруч, і на живому екрані він читався восьмою
          кнопкою: та сама величина, та сама відстань, той самий ряд.

          Показує відтінок так, як його побачить небо: світна серцевина в
          ореолі того ж кольору. Плаский кружечок брехав би — на додатковому
          змішуванні поверх туманності колір читається інакше.
        */}
        <span className="cal-entry-colour-shown">
          <span
            className="cal-entry-colour-preview"
            style={{ '--shade': preview.colour } as CSSProperties}
            aria-hidden="true"
          />
          <small>{value === null ? `Авто · ${auto.label}` : preview.label}</small>
        </span>

        <div className="cal-entry-colour-swatches" role="group" aria-label="Колір зірки">
          <button
            type="button"
            className={`cal-entry-swatch cal-entry-swatch--auto${value === null ? ' active' : ''}`}
            style={{ '--shade': auto.colour } as CSSProperties}
            aria-pressed={value === null}
            title={`Авто — ${auto.label}`}
            onClick={() => onChange(null)}
          >
            <span className="cal-entry-swatch-dot" aria-hidden="true" />
            <span className="sr-only">Авто, {auto.label}</span>
          </button>

          {shades.map((shade) => (
            <button
              key={shade.token}
              type="button"
              className={`cal-entry-swatch${value === shade.token ? ' active' : ''}`}
              style={{ '--shade': shade.colour } as CSSProperties}
              aria-pressed={value === shade.token}
              title={shade.label}
              onClick={() => onChange(shade.token)}
            >
              <span className="cal-entry-swatch-dot" aria-hidden="true" />
              <span className="sr-only">{shade.label}</span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
