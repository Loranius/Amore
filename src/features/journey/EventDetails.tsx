import { CloseIcon, PencilIcon } from '@/components/icons/UiIcon';
import type { EventRow } from '@/types';
import { levelOf, type ConstellationLevel } from './constellationRules';

// ============================================================
// Деталі розкритої події.
// ------------------------------------------------------------
// Показує рівно те, що в події справді є. Полів у `events` небагато — назва,
// дата, опис, вага, — і вигадувати навколо них «статистику» тут нема з чого:
// порожній блок «місць: 0» гірший за відсутній.
//
// Панель НЕ модалка. Вона живе поруч зі сценою, а не поверх неї: подія
// відкрита, поки камера стоїть біля її зірки, і накрити цю зірку затемненням
// означало б сховати те, заради чого пара сюди летіла.
// ============================================================

const LEVEL_LABEL: Record<ConstellationLevel, string> = {
  key: 'Ключова подія',
  important: 'Важлива подія',
  regular: 'Подія',
};

/**
 * Дата словами, без «р.» у кінці.
 *
 * Українська локаль дописує «р.» до року, і в тісному рядку це вже одного разу
 * розірвало підпис навпіл.
 */
function longDate(iso: string): string {
  const [year, month, day] = iso.slice(0, 10).split('-').map(Number);
  if (!year || !month || !day) return iso;
  return new Date(Date.UTC(year, month - 1, day))
    .toLocaleDateString('uk-UA', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
    .replace(/\s*р\.$/, '');
}

/** Скільки минуло від події до сьогодні, словами. */
export function sinceLabel(iso: string, today: Date): string | null {
  const [year, month, day] = iso.slice(0, 10).split('-').map(Number);
  if (!year || !month || !day) return null;
  const days = Math.round(
    (Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate(), 12)
      - Date.UTC(year, month - 1, day, 12)) / 86_400_000,
  );
  if (days === 0) return 'сьогодні';
  if (days < 0) return 'попереду';
  if (days < 31) return `${days} ${plural(days, 'день', 'дні', 'днів')} тому`;
  const months = Math.floor(days / 30.437);
  if (months < 12) return `${months} ${plural(months, 'місяць', 'місяці', 'місяців')} тому`;
  const years = Math.floor(days / 365.2425);
  return `${years} ${plural(years, 'рік', 'роки', 'років')} тому`;
}

function plural(count: number, one: string, few: string, many: string): string {
  const tail = count % 100;
  if (tail >= 11 && tail <= 14) return many;
  switch (count % 10) {
    case 1: return one;
    case 2:
    case 3:
    case 4: return few;
    default: return many;
  }
}

export function EventDetails({
  event,
  onClose,
  onEdit,
}: {
  event: EventRow;
  onClose: () => void;
  onEdit: () => void;
}) {
  const level = levelOf(event);
  const since = sinceLabel(event.date, new Date());

  return (
    <aside className="jn-details" data-level={level} aria-label={`Подія «${event.title}»`}>
      <button type="button" className="jn-details-close" aria-label="Закрити подію" onClick={onClose}>
        <CloseIcon size={16} />
      </button>

      <p className="jn-details-level">{LEVEL_LABEL[level]}</p>
      <h2 className="jn-details-title">{event.title}</h2>
      <p className="jn-details-date">
        {longDate(event.date)}
        {since && <span className="jn-details-since">{since}</span>}
      </p>

      {event.description && <p className="jn-details-note">{event.description}</p>}

      <button type="button" className="jn-details-edit" onClick={onEdit}>
        <PencilIcon size={14} /> Редагувати
      </button>
    </aside>
  );
}
