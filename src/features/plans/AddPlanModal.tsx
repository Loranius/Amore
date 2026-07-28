// ============================================================
// Швидке створення нової точки маршруту.
// ------------------------------------------------------------
// Перший екран просить тільки назву. Категорія й нотатка допомагають,
// але не блокують думку на півдорозі. Після збереження людина вирішує:
// залишити задум у затоці ідей або одразу продовжити його планування.
// ============================================================
import { useState, type CSSProperties } from 'react';
import { CheckIcon, ChevronDownIcon } from '@/components/icons/UiIcon';
import { PLAN_CATEGORIES, PLAN_CATEGORY_ORDER } from './planConstants';
import './plansCreate.css';
import type { NewPlanInput } from './usePlans';
import type { PlanCategory } from '@/types';

const QUICK_CATEGORIES: PlanCategory[] = ['date', 'trip', 'place', 'activity'];
const EXTRA_CATEGORIES = PLAN_CATEGORY_ORDER.filter((key) => !QUICK_CATEGORIES.includes(key));

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
  const [moreOpen, setMoreOpen] = useState(false);

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
              <span className="plan-create-eyebrow">Нова точка маршруту</span>
              <h2 id="plan-create-title">Що хочете пережити разом?</h2>
              <p>Достатньо короткої ідеї. Дату, місце та підготовку додасте тоді, коли будете готові.</p>
            </header>

            <label className="plan-create-title-field">
              <span className="sr-only">Назва плану</span>
              <textarea
                id="plan-title"
                name="title"
                rows={2}
                maxLength={120}
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Наприклад, зустріти світанок у горах"
                autoFocus
                disabled={busy}
              />
              <small>{title.trim().length}/120</small>
            </label>

            <section className="plan-create-kind" aria-labelledby="plan-create-kind-title">
              <div className="plan-create-kind-head">
                <span id="plan-create-kind-title">Що це приблизно?</span>
                <small>Не обов’язково</small>
              </div>

              <div className="plan-create-quick-categories">
                {QUICK_CATEGORIES.map((key) => {
                  const item = PLAN_CATEGORIES[key];
                  const active = category === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      className={`plan-create-category${active ? ' active' : ''}`}
                      aria-pressed={active}
                      onClick={() => setCategory(active ? 'other' : key)}
                      disabled={busy}
                    >
                      <item.Icon size={19} />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </section>

            <button
              type="button"
              className={`plan-create-more-toggle${moreOpen ? ' open' : ''}`}
              aria-expanded={moreOpen}
              onClick={() => setMoreOpen((current) => !current)}
              disabled={busy}
            >
              <span>{moreOpen ? 'Сховати додаткове' : 'Додати нотатку або інший тип'}</span>
              <ChevronDownIcon size={17} />
            </button>

            {moreOpen && (
              <div className="plan-create-more">
                <div className="plan-create-extra-categories" aria-label="Інші типи плану">
                  {EXTRA_CATEGORIES.map((key) => {
                    const item = PLAN_CATEGORIES[key];
                    const active = category === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        className={`plan-create-extra-category${active ? ' active' : ''}`}
                        aria-pressed={active}
                        onClick={() => setCategory(key)}
                        disabled={busy}
                      >
                        <item.Icon size={15} /> {key === 'other' ? 'Без типу' : item.label}
                      </button>
                    );
                  })}
                </div>

                <label className="form-field plan-create-note">
                  <span>Нотатка</span>
                  <textarea
                    id="plan-description"
                    name="description"
                    rows={2}
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    placeholder="Деталь, яку не хочеться забути…"
                    disabled={busy}
                  />
                </label>
              </div>
            )}

            <div className="plan-create-actions">
              <button type="button" className="plan-create-cancel" onClick={onClose} disabled={busy}>
                Скасувати
              </button>
              <button type="submit" className="btn plan-create-save" disabled={busy || !title.trim()}>
                {busy ? 'Наношу на карту…' : 'Зберегти ідею'}
              </button>
            </div>
          </form>
        ) : (
          <section className="plan-create-success" aria-labelledby="plan-create-title">
            <span className="plan-create-success-mark" aria-hidden="true">
              <CheckIcon size={28} />
            </span>
            <span className="plan-create-eyebrow">Точку додано</span>
            <h2 id="plan-create-title">{title.trim()}</h2>
            <p>Поки що вона чекає без дати серед ідей. Можна залишити її так або перейти до дати, кроків і бюджету.</p>

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
