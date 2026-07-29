// ============================================================
// Швидке створення спільного плану.
// ------------------------------------------------------------
// Перший рівень просить лише назву. Тип і нотатка відкриваються окремо,
// тому форма не перетворюється на анкету. Календарна категорія «Свято»
// навмисно відсутня: річниці та свята створюються в календарі.
// ============================================================
import { useState, type CSSProperties } from 'react';
import { CheckIcon, ChevronDownIcon } from '@/components/icons/UiIcon';
import { PLAN_CATEGORIES, PLAN_CATEGORY_ORDER } from './planConstants';
import './plansCreate.css';
import './plansCreateAccordion.css';
import type { NewPlanInput } from './usePlans';
import type { PlanCategory } from '@/types';

const PLAN_TYPES = PLAN_CATEGORY_ORDER.filter((key) => key !== 'holiday');

export function AddPlanModal({
  busy,
  createdPlanId,
  onClose,
  onSubmit,
  onContinue,
}: {
  busy: boolean;
  createdPlanId: number | null;
  onClose: () => void;
  onSubmit: (input: NewPlanInput) => void;
  onContinue: (id: number) => void;
}) {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<PlanCategory>('other');
  const [description, setDescription] = useState('');
  const [typeOpen, setTypeOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);

  const selected = PLAN_CATEGORIES[category];
  const style = { '--plan-create-accent': selected.color } as CSSProperties;

  const save = () => {
    const cleanTitle = title.trim();
    if (!cleanTitle || busy || createdPlanId !== null) return;
    onSubmit({
      title: cleanTitle,
      category,
      description: description.trim() || null,
    });
  };

  return (
    <div
      className="modal-overlay plan-create-overlay"
      onClick={(event) => {
        if (!busy && event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="modal-sheet plan-create-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="plan-create-title"
        style={style}
      >
        {createdPlanId === null ? (
          <form
            className="plan-create-form"
            onSubmit={(event) => {
              event.preventDefault();
              save();
            }}
          >
            <header className="plan-create-head">
              <span className="plan-create-eyebrow">Новий спільний план</span>
              <h2 id="plan-create-title">Що хочете зробити разом?</h2>
              <p>Запишіть задум одним реченням. Дату, місце, бюджет і підготовку можна додати пізніше.</p>
            </header>

            <label className="plan-create-title-field">
              <textarea
                id="plan-title"
                name="title"
                aria-label="Назва плану"
                rows={2}
                maxLength={120}
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Наприклад, поїхати разом у Карпати"
                autoFocus
                disabled={busy}
              />
              <small>{title.trim().length}/120</small>
            </label>

            <section className="plan-create-accordion" aria-labelledby="plan-type-title">
              <button
                type="button"
                className={`plan-create-accordion-toggle${typeOpen ? ' open' : ''}`}
                aria-expanded={typeOpen}
                onClick={() => setTypeOpen((value) => !value)}
                disabled={busy}
              >
                <span className="plan-create-accordion-icon" aria-hidden="true"><selected.Icon size={18} /></span>
                <span className="plan-create-accordion-copy">
                  <small id="plan-type-title">Тип плану</small>
                  <strong>{category === 'other' ? 'Не вибрано' : selected.label}</strong>
                </span>
                <span className="plan-create-accordion-optional">необов’язково</span>
                <ChevronDownIcon size={17} />
              </button>

              {typeOpen && (
                <div className="plan-create-type-grid" aria-label="Типи спільних планів">
                  {PLAN_TYPES.map((key) => {
                    const item = PLAN_CATEGORIES[key];
                    const active = category === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        className={`plan-create-type-option${active ? ' active' : ''}`}
                        aria-pressed={active}
                        onClick={() => {
                          setCategory(key);
                          setTypeOpen(false);
                        }}
                        disabled={busy}
                      >
                        <item.Icon size={17} />
                        <span>{key === 'other' ? 'Без типу' : item.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </section>

            <section className="plan-create-accordion">
              <button
                type="button"
                className={`plan-create-accordion-toggle plan-create-accordion-toggle--note${noteOpen ? ' open' : ''}`}
                aria-expanded={noteOpen}
                onClick={() => setNoteOpen((value) => !value)}
                disabled={busy}
              >
                <span className="plan-create-accordion-copy">
                  <small>Додаткова деталь</small>
                  <strong>{description.trim() ? 'Нотатку додано' : 'Додати нотатку'}</strong>
                </span>
                <ChevronDownIcon size={17} />
              </button>

              {noteOpen && (
                <label className="form-field plan-create-note plan-create-note--accordion">
                  <span>Що важливо не забути?</span>
                  <textarea
                    id="plan-description"
                    name="description"
                    rows={3}
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    placeholder="Наприклад, поїхати власною машиною та взяти фотоапарат"
                    disabled={busy}
                  />
                </label>
              )}
            </section>

            <div className="plan-create-actions">
              <button type="button" className="plan-create-cancel" onClick={onClose} disabled={busy}>
                Скасувати
              </button>
              <button type="submit" className="btn plan-create-save" disabled={busy || !title.trim()}>
                {busy ? 'Зберігаю…' : 'Зберегти ідею'}
              </button>
            </div>
          </form>
        ) : (
          <section className="plan-create-success" aria-labelledby="plan-create-title">
            <span className="plan-create-success-mark" aria-hidden="true"><CheckIcon size={28} /></span>
            <span className="plan-create-eyebrow">План додано</span>
            <h2 id="plan-create-title">{title.trim()}</h2>
            <p>Він збережений серед ідей. Можна залишити його так або одразу додати дату, кроки й бюджет.</p>

            <div className="plan-create-success-actions">
              <button type="button" className="btn plan-create-continue" onClick={() => onContinue(createdPlanId)}>
                Продовжити планування
              </button>
              <button type="button" className="plan-create-done" onClick={onClose}>
                Залишити як ідею
              </button>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
