// ============================================================
// Додавання типових свят.
// ------------------------------------------------------------
// Свідомо НЕ кнопка «додати все»: кілька дат переїхали з календарною
// реформою 2023 року, тож кожна заготовка показує свою дату й може бути
// знята до запису. Список пропонує — вирішує власник.
//
// Уже зайняті дні сюди не потрапляють (missingPresets), тож повторний
// захід показує тільки те, чого справді бракує.
// ============================================================
import { useState } from 'react';
import { pluralUA } from '@/lib/utils';
import { formatDateUA } from '@/features/_shared/month';
import { SparkIcon } from '@/components/icons/EventIcon';
import { presetDate, type HolidayPreset } from './holidayPresets';

interface HolidayPresetsModalProps {
  presets: HolidayPreset[];
  busy: boolean;
  onClose: () => void;
  onSubmit: (items: Array<{ title: string; date: string }>) => void;
}

export function HolidayPresetsModal({
  presets, busy, onClose, onSubmit,
}: HolidayPresetsModalProps) {
  // За замовчуванням обрані всі: типовий намір — «хочу базовий набір»,
  // а зняти зайве дешевше, ніж поставити десять галочок вручну.
  const [chosen, setChosen] = useState<Set<string>>(() => new Set(presets.map((p) => p.md)));

  const toggle = (md: string) =>
    setChosen((current) => {
      const next = new Set(current);
      if (next.has(md)) next.delete(md);
      else next.add(md);
      return next;
    });

  const submit = () => {
    if (chosen.size === 0 || busy) return;
    onSubmit(
      presets
        .filter((p) => chosen.has(p.md))
        .map((p) => ({ title: p.title, date: presetDate(p.md) })),
    );
  };

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}>
      <div className="modal-sheet" role="dialog" aria-modal="true">
        <h2 className="modal-title">Типові свята</h2>

        {presets.length === 0 ? (
          <p className="empty-state">Усі ці дні у вас уже є 🎉</p>
        ) : (
          <>
            <p className="cal-field-hint" style={{ margin: '0 0 10px' }}>
              Перевірте дати: частина свят переїхала з реформою календаря 2023 року.
              Зніміть зайве — додасться тільки позначене.
            </p>

            <div className="cal-preset-list">
              {presets.map((p) => {
                const on = chosen.has(p.md);
                return (
                  <label key={p.md} className={`cal-preset-row${on ? ' cal-preset-row--on' : ''}`}>
                    <input type="checkbox" checked={on} onChange={() => toggle(p.md)} disabled={busy} />
                    <span className="cal-preset-icon"><SparkIcon size={16} /></span>
                    <span className="cal-preset-name">{p.title}</span>
                    <span className="cal-preset-date">{formatDateUA(presetDate(p.md), { year: false })}</span>
                  </label>
                );
              })}
            </div>
          </>
        )}

        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>
            {presets.length === 0 ? 'Закрити' : 'Скасувати'}
          </button>
          {presets.length > 0 && (
            <button type="button" className="btn" onClick={submit} disabled={chosen.size === 0 || busy}>
              {busy
                ? 'Додаю…'
                : `Додати ${chosen.size} ${pluralUA(chosen.size, ['свято', 'свята', 'свят'])}`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
