// ============================================================
// Новий план — одне поле й три тихі перемикачі (ADR-0256).
// ------------------------------------------------------------
// Було: надпис над заголовком, абзац пояснення, три розгортки «Тип /
// Обкладинка / Нотатка» з підписом «необов'язково» на кожній і екран
// успіху з ще одним вибором. Власник: «створення плану — важке».
//
// Стало як у новій формі бажання: заголовок «Новий план», поле «Що
// хочете зробити разом?», під ним «Тип», «Дата», «Фото». Дата — те, що
// робить задум планом (`planStage`), тож головна кнопка й каже це:
// без дати «Зберегти задум», з датою «Запланувати». Нотатка, місце,
// бюджет і кроки — на сторінці плану.
// ============================================================
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { ModalClose } from '@/components/ui/ModalClose';
import { CalendarIcon, CloseIcon } from '@/components/icons/UiIcon';
import { CameraIcon } from '@/components/icons/NavIcon';
import { PLAN_CATEGORIES, PLAN_CATEGORY_ORDER } from './planConstants';
import './plansCreate.css';
import './plansCreatePhoto.css';
import type { NewPlanInput } from './usePlans';
import type { PlanCategory } from '@/types';

const PLAN_TYPES = PLAN_CATEGORY_ORDER.filter((key) => key !== 'holiday');
const CLOSE_MOTION_MS = 150;

type Panel = 'type' | 'date' | 'photo';

/** Дата з форми у формі, якої чекає база; `null` — дати немає. */
export function planDateInput(
  start: string,
  end: string,
  multiDay: boolean,
): Pick<NewPlanInput, 'start_date' | 'end_date' | 'date_precision'> {
  if (!start) return { start_date: null, end_date: null, date_precision: 'none' };
  if (multiDay && end && end > start) return { start_date: start, end_date: end, date_precision: 'range' };
  return { start_date: start, end_date: null, date_precision: 'day' };
}

export function AddPlanModal({
  busy,
  onClose,
  onSubmit,
}: {
  busy: boolean;
  onClose: () => void;
  onSubmit: (input: NewPlanInput) => void;
}) {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<PlanCategory>('other');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [multiDay, setMultiDay] = useState(false);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [panel, setPanel] = useState<Panel | null>(null);
  const [closing, setClosing] = useState(false);
  const closeTimer = useRef<number | null>(null);

  const selected = PLAN_CATEGORIES[category];
  const style = { '--plan-create-accent': selected.color } as CSSProperties;
  const dated = start !== '';
  const locked = busy || closing;

  useEffect(() => () => {
    if (closeTimer.current !== null) window.clearTimeout(closeTimer.current);
  }, []);

  useEffect(() => {
    if (!coverFile) {
      setCoverPreview(null);
      return;
    }
    const url = URL.createObjectURL(coverFile);
    setCoverPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [coverFile]);

  const requestClose = () => {
    if (busy || closing) return;
    setClosing(true);
    closeTimer.current = window.setTimeout(onClose, CLOSE_MOTION_MS);
  };

  const toggle = (next: Panel) => setPanel((current) => (current === next ? null : next));

  const save = () => {
    const cleanTitle = title.trim();
    if (!cleanTitle || locked) return;
    onSubmit({
      title: cleanTitle,
      category,
      description: null,
      coverFile,
      ...planDateInput(start, end, multiDay),
    });
  };

  return (
    <div
      className={`modal-overlay plan-create-overlay${closing ? ' is-closing' : ''}`}
      onClick={(event) => {
        if (!busy && event.target === event.currentTarget) requestClose();
      }}
    >
      <div
        className={`modal-sheet plan-create-sheet${closing ? ' is-closing' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="plan-create-title"
        style={style}
      >
        <ModalClose onClose={requestClose} disabled={busy} />
        <form
          className="plan-create-form"
          onSubmit={(event) => {
            event.preventDefault();
            save();
          }}
        >
          <h2 id="plan-create-title" className="plan-create-heading">Новий план</h2>

          <label className="plan-create-title-field">
            <textarea
              id="plan-title"
              name="title"
              aria-label="Що хочете зробити разом?"
              rows={2}
              maxLength={120}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Що хочете зробити разом?"
              autoFocus
              disabled={locked}
            />
          </label>

          <div className="plan-create-chips">
            <button
              type="button"
              className="plan-create-chip"
              aria-expanded={panel === 'type'}
              data-set={category !== 'other' ? 'true' : undefined}
              onClick={() => toggle('type')}
              disabled={locked}
            >
              <selected.Icon size={16} />
              {category === 'other' ? 'Тип' : selected.label}
            </button>
            <button
              type="button"
              className="plan-create-chip"
              aria-expanded={panel === 'date'}
              data-set={dated ? 'true' : undefined}
              onClick={() => toggle('date')}
              disabled={locked}
            >
              <CalendarIcon size={16} />
              Дата
            </button>
            <button
              type="button"
              className="plan-create-chip"
              aria-expanded={panel === 'photo'}
              data-set={coverFile ? 'true' : undefined}
              onClick={() => toggle('photo')}
              disabled={locked}
            >
              <CameraIcon size={16} />
              Фото
            </button>
          </div>

          {panel === 'type' && (
            <div className="plan-create-type-grid" role="group" aria-label="Тип плану">
              {PLAN_TYPES.map((key) => {
                const item = PLAN_CATEGORIES[key];
                const active = category === key;
                return (
                  <button
                    key={key}
                    type="button"
                    className="plan-create-type-option"
                    aria-pressed={active}
                    onClick={() => {
                      setCategory(key);
                      setPanel(null);
                    }}
                    disabled={locked}
                  >
                    <item.Icon size={16} />
                    <span>{key === 'other' ? 'Без типу' : item.label}</span>
                  </button>
                );
              })}
            </div>
          )}

          {panel === 'date' && (
            <div className="plan-create-date">
              <div className="plan-create-date-kind" role="group" aria-label="Скільки триває">
                <button type="button" aria-pressed={!multiDay} onClick={() => setMultiDay(false)} disabled={locked}>
                  Один день
                </button>
                <button type="button" aria-pressed={multiDay} onClick={() => setMultiDay(true)} disabled={locked}>
                  Кілька днів
                </button>
              </div>
              <div className="plan-create-date-fields">
                <label className="form-field">
                  <span>{multiDay ? 'Від' : 'Коли'}</span>
                  <input
                    id="plan-start"
                    type="date"
                    value={start}
                    onChange={(event) => setStart(event.target.value)}
                    disabled={locked}
                  />
                </label>
                {multiDay && (
                  <label className="form-field">
                    <span>До</span>
                    <input
                      id="plan-end"
                      type="date"
                      min={start || undefined}
                      value={end}
                      onChange={(event) => setEnd(event.target.value)}
                      disabled={locked}
                    />
                  </label>
                )}
              </div>
              {dated && (
                <button type="button" className="plan-create-date-clear" onClick={() => { setStart(''); setEnd(''); }} disabled={locked}>
                  Без дати — лишити задумом
                </button>
              )}
            </div>
          )}

          {panel === 'photo' && (
            <div className="plan-create-photo">
              {coverPreview ? (
                <div className="plan-create-photo-preview">
                  <img src={coverPreview} alt="Обкладинка плану" />
                  <button
                    type="button"
                    aria-label="Прибрати фото"
                    onClick={() => setCoverFile(null)}
                    disabled={locked}
                  >
                    <CloseIcon size={15} />
                  </button>
                </div>
              ) : (
                <label className="plan-create-photo-picker">
                  <CameraIcon size={24} />
                  <span>
                    <strong>Вибрати фото</strong>
                    <small>Воно стане обкладинкою плану</small>
                  </span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                    onChange={(event) => setCoverFile(event.target.files?.[0] ?? null)}
                    disabled={locked}
                  />
                </label>
              )}
            </div>
          )}

          <div className="modal-actions plan-create-actions">
            <button type="button" className="btn btn-ghost" onClick={requestClose} disabled={locked}>
              Скасувати
            </button>
            <button type="submit" className="btn" disabled={locked || !title.trim()}>
              {busy ? 'Зберігаю…' : dated ? 'Запланувати' : 'Зберегти задум'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
