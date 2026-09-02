// ============================================================
// Чим рік наповнений — списком, а не числом.
// ------------------------------------------------------------
// Тут стояв рядок «Уже 5 — і цей рік більше не порожній». П'ять ЧОГО,
// екран не казав, і саме звідси обидві половини скарги власника:
// «візуально важко зрозуміти що де» й «не можна видаляти те, що
// випадково додав». Одне число не давало ні побачити, ні виправити.
//
// ЧОМУ ВИДАЛЕННЯ В ДВА ДОТИКИ. Додавання тут — один дотик по чипу, без
// підтвердження, і це правильно: помилка коштує дешево, поки її можна
// прибрати. А от прибирання видаляє СПРАВЖНІЙ рядок порталу, тож ціна
// помилки різна в обидва боки, і кроки мусять бути різні. Підтвердження
// вбудоване в сам рядок, а не модалкою: воно не потребує ані перебивання,
// ані захищеного фокуса, і показує рівно те, що зникне.
// ============================================================
import { useState } from 'react';
import { CloseIcon } from '@/components/icons/UiIcon';
import type { SweepEntry } from './useHistorySweep';

interface SweepEntryListProps {
  entries: readonly SweepEntry[];
  isSaving: boolean;
  onRemove: (entry: SweepEntry) => void;
  /** Що станеться з рядком — різне для мітки карти й для решти. */
  removeVerb: string;
  /** Коли в році ще нічого немає. */
  empty: string;
}

/*
 * Пояснення про тьмяні рядки живе НЕ тут, а один раз на всю панель року
 * (`HistorySweepView`). Тут воно стояло під кожним списком і друкувалось
 * на екрані тричі поспіль — приміткою, яка сама стала шумом.
 */

/** Скільки видно без розгортання. Сьоме й далі ховається під кнопкою. */
const VISIBLE = 6;

const keyOf = (entry: SweepEntry) => `${entry.kind}:${entry.id}`;

export function SweepEntryList({
  entries, isSaving, onRemove, removeVerb, empty,
}: SweepEntryListProps) {
  const [confirming, setConfirming] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  if (entries.length === 0) {
    return <p className="sweep-hint sweep-empty">{empty}</p>;
  }

  const shown = expanded ? entries : entries.slice(0, VISIBLE);
  const hidden = entries.length - shown.length;

  return (
    <>
      <ul className="sweep-entries">
        {shown.map((entry) => {
          const key = keyOf(entry);
          const open = confirming === key;
          return (
            <li
              className={`sweep-entry${entry.removable ? '' : ' sweep-entry--foreign'}`}
              key={key}
            >
              <span className="sweep-entry-name">
                {entry.label}
                {entry.detail !== '' && <small> · {entry.detail}</small>}
              </span>

              {entry.removable && !open && (
                <button
                  type="button"
                  className="sweep-entry-remove"
                  disabled={isSaving}
                  onClick={() => setConfirming(key)}
                  aria-label={`Прибрати «${entry.label}»`}
                >
                  <CloseIcon size={14} />
                </button>
              )}

              {entry.removable && open && (
                <span className="sweep-entry-confirm">
                  <button
                    type="button"
                    className="sweep-entry-yes"
                    disabled={isSaving}
                    onClick={() => { setConfirming(null); onRemove(entry); }}
                  >
                    {removeVerb}
                  </button>
                  <button
                    type="button"
                    className="sweep-entry-no"
                    onClick={() => setConfirming(null)}
                  >
                    Ні
                  </button>
                </span>
              )}
            </li>
          );
        })}
      </ul>

      {hidden > 0 && (
        <button type="button" className="sweep-more" onClick={() => setExpanded(true)}>
          Показати ще {hidden}
        </button>
      )}
    </>
  );
}
