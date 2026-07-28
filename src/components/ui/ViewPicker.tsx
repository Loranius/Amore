// ============================================================
// ViewPicker — вибір вигляду розділу.
// ------------------------------------------------------------
// Пара «Спогади»/«Карта» показує той самий віджет, і поки він жив у
// memories.css, карта залежала від стилів чужого модуля: відкрий карту,
// не заходячи в архів, — і перемикач приїхав би без стилів взагалі.
//
// Вішлист має власний варіант із галочкою і сюди поки не зведений: це
// інша розмітка, і зводити її треба окремо, а не мимохідь.
// ============================================================
import type { ReactNode } from 'react';

export interface ViewOption<T extends string> {
  value: T;
  label: string;
  description: string;
  /** Мальований значок, а не гліф: запасу «☰ ▤ ▦» не вистачало на
      дев'ять виглядів трьох модулів, і форми починали повторюватись. */
  icon: ReactNode;
}

export function ViewPicker<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: ReadonlyArray<ViewOption<T>>;
  value: T;
  onChange: (value: T) => void;
  /** Підпис групи для читалок — «Вигляд архіву», «Вигляд карти». */
  label: string;
}) {
  return (
    <div className="view-picker" role="group" aria-label={label}>
      {options.map((option) => {
        const active = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            className={`view-option${active ? ' active' : ''}`}
            aria-pressed={active}
            onClick={() => onChange(option.value)}
          >
            <span className="view-icon" aria-hidden="true">{option.icon}</span>
            <span className="view-copy">
              <strong>{option.label}</strong>
              <small>{option.description}</small>
            </span>
          </button>
        );
      })}
    </div>
  );
}
