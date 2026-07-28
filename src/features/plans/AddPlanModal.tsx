// ============================================================
// Створення плану — три поля й не більше.
// ------------------------------------------------------------
// §8 специфікації: щоб зберегти ідею, достатньо назви й категорії.
// Дата, місце, бюджет, завдання й обкладинка додаються вже на сторінці
// плану. Змушувати заповнити десять полів заради «а давай колись
// з'їздимо в Карпати» — найкоротший шлях до того, щоб ідея не
// записалась узагалі.
// ============================================================
import { useState } from 'react';
import { PLAN_CATEGORIES, PLAN_CATEGORY_ORDER } from './planConstants';
import type { NewPlanInput } from './usePlans';
import type { PlanCategory } from '@/types';

export function AddPlanModal({ busy, onClose, onSubmit }: {
  busy: boolean;
  onClose: () => void;
  onSubmit: (input: NewPlanInput) => void;
}) {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<PlanCategory>('date');
  const [description, setDescription] = useState('');

  const save = () => {
    const t = title.trim();
    if (!t) return;
    onSubmit({ title: t, category, description: description.trim() || null });
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-sheet" role="dialog" aria-modal="true" aria-label="Новий план">
        <h2 className="modal-title">Новий план</h2>

        <label className="form-field">
          <span>Що робимо</span>
          <input
            id="plan-title"
            name="title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Наприклад, вікенд у Карпатах"
            autoFocus
          />
        </label>

        <div className="form-field">
          <span>Категорія</span>
          <div className="plan-cat-grid">
            {PLAN_CATEGORY_ORDER.map((key) => {
              const c = PLAN_CATEGORIES[key];
              return (
                <button
                  key={key}
                  type="button"
                  className={`plan-cat-btn${category === key ? ' active' : ''}`}
                  aria-pressed={category === key}
                  onClick={() => setCategory(key)}
                >
                  <c.Icon size={15} /> {c.label}
                </button>
              );
            })}
          </div>
        </div>

        <label className="form-field">
          <span>Коротко (не обов'язково)</span>
          <textarea
            id="plan-description"
            name="description"
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Деталь, яку не хочеться забути…"
          />
        </label>

        {/* Дата й місце свідомо не тут — див. коментар угорі файлу. */}
        <p className="plan-add-hint">
          Дату, місце й завдання можна додати потім — план збережеться як ідея.
        </p>

        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>
            Скасувати
          </button>
          <button type="button" className="btn" onClick={save} disabled={busy || !title.trim()}>
            {busy ? 'Зберігаю…' : 'Зберегти'}
          </button>
        </div>
      </div>
    </div>
  );
}
