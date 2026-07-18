// ============================================================
// RecipeModal (перегляд) + DishModal (додати/редагувати + редактор рецепта)
// ============================================================
import { useState } from 'react';
import { DISH_CATS, DISH_CAT_ORDER, RCP_UNITS } from './culinaryConstants';
import type { DishRow, DishCategory, Recipe, RecipeIngredient } from '@/types';

// ── Перегляд рецепта ─────────────────────────────────────────
export function RecipeModal({
  dish,
  onClose,
  onToShopping,
}: {
  dish: DishRow;
  onClose: () => void;
  onToShopping: (ingredients: RecipeIngredient[]) => void;
}) {
  const r = dish.recipe;
  const ings = r?.ingredients ?? [];
  const steps = r?.steps ?? [];

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-sheet rcp-view-card" role="dialog" aria-modal="true">
        <h2 className="modal-title">{dish.title}</h2>
        {r?.servings && <p className="rcp-servings-line">🍽 Порцій: {r.servings}</p>}

        {ings.length > 0 && (
          <>
            <p className="rcp-view-subtitle">Інгредієнти</p>
            <div className="rcp-view-ings">
              {ings.map((i, idx) => (
                <div key={idx} className="rcp-view-ing">
                  <span className="rcp-view-ing-name">{i.name}</span>
                  <span className="rcp-view-ing-dots" />
                  <span className="rcp-view-ing-amount">
                    {[i.amount, i.unit].filter(Boolean).join(' ')}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}

        {steps.length > 0 && (
          <>
            <p className="rcp-view-subtitle">Приготування</p>
            <ol className="rcp-view-steps">
              {steps.map((s, idx) => (
                <li key={idx}>{s}</li>
              ))}
            </ol>
          </>
        )}

        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Закрити
          </button>
          {ings.length > 0 && (
            <button
              type="button"
              className="btn"
              onClick={() => {
                onToShopping(ings);
                onClose();
              }}
            >
              🛒 В покупки
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Додати / редагувати страву ───────────────────────────────
interface Row {
  name: string;
  amount: string;
  unit: string;
}

interface DishModalProps {
  dish: DishRow | null; // null → нова
  onClose: () => void;
  onAdd: (v: { title: string; category: DishCategory; recipe: Recipe | null }) => void;
  onEdit: (v: { id: number; title: string; category: DishCategory; recipe: Recipe | null }) => void;
}

export function DishModal({ dish, onClose, onAdd, onEdit }: DishModalProps) {
  const isEdit = dish !== null;
  const [title, setTitle] = useState(dish?.title ?? '');
  const [category, setCategory] = useState<DishCategory>(dish?.category ?? 'meat');
  const [showRecipe, setShowRecipe] = useState(
    !!(dish?.recipe && ((dish.recipe.ingredients?.length ?? 0) || (dish.recipe.steps?.length ?? 0))),
  );
  const [servings, setServings] = useState(dish?.recipe?.servings ?? 2);
  const [rows, setRows] = useState<Row[]>(
    dish?.recipe?.ingredients?.length
      ? dish.recipe.ingredients.map((i) => ({ name: i.name, amount: i.amount, unit: i.unit }))
      : [{ name: '', amount: '', unit: 'г' }],
  );
  const [stepsText, setStepsText] = useState((dish?.recipe?.steps ?? []).join('\n'));

  const updateRow = (idx: number, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  const addRow = () => setRows((rs) => [...rs, { name: '', amount: '', unit: 'г' }]);
  const removeRow = (idx: number) => setRows((rs) => rs.filter((_, i) => i !== idx));

  const collectRecipe = (): Recipe | null => {
    const ingredients: RecipeIngredient[] = rows
      .map((r) => ({ name: r.name.trim(), amount: r.amount.trim(), unit: r.unit }))
      .filter((i) => i.name);
    const steps = stepsText.split('\n').map((s) => s.trim()).filter(Boolean);
    if (!ingredients.length && !steps.length) return null;
    return { servings, ingredients, steps };
  };

  const save = () => {
    const t = title.trim();
    if (!t) return;
    const recipe = showRecipe ? collectRecipe() : dish?.recipe ?? null;
    if (isEdit) onEdit({ id: dish.id, title: t, category, recipe });
    else onAdd({ title: t, category, recipe });
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-sheet rcp-modal-card" role="dialog" aria-modal="true">
        <h2 className="modal-title">{isEdit ? 'Редагувати страву' : 'Нова страва'}</h2>

        <label className="form-field">
          <span>Назва страви</span>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Наприклад, Паста болоньєзе"
            autoFocus
          />
        </label>

        <div className="form-field">
          <span>Категорія</span>
          <div className="chips">
            {DISH_CAT_ORDER.map((key) => {
              const cat = DISH_CATS[key];
              const active = category === key;
              return (
                <button
                  key={key}
                  type="button"
                  className={`chip${active ? ' active' : ''}`}
                  style={active ? { background: cat.color, color: '#fff', borderColor: 'transparent' } : undefined}
                  onClick={() => setCategory(key)}
                >
                  {cat.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="form-field">
          <button type="button" className="rcp-toggle" onClick={() => setShowRecipe((v) => !v)}>
            <span>📖 Рецепт {showRecipe ? '' : '(опційно)'}</span>
            <span className={`fin-acc-arrow${showRecipe ? ' open' : ''}`}>›</span>
          </button>

          {showRecipe && (
            <div className="rcp-editor">
              <label>Порції</label>
              <input
                type="number"
                min={1}
                max={20}
                value={servings}
                onChange={(e) => setServings(parseInt(e.target.value, 10) || 1)}
                className="rcp-servings-inp"
              />

              <label>Інгредієнти</label>
              {rows.map((r, idx) => (
                <div key={idx} className="rcp-ing-row">
                  <input
                    className="rcp-ing-name"
                    placeholder="Інгредієнт"
                    value={r.name}
                    onChange={(e) => updateRow(idx, { name: e.target.value })}
                  />
                  <input
                    className="rcp-ing-amount"
                    placeholder="200"
                    inputMode="decimal"
                    value={r.amount}
                    onChange={(e) => updateRow(idx, { amount: e.target.value })}
                  />
                  <select
                    className="rcp-ing-unit"
                    value={r.unit}
                    onChange={(e) => updateRow(idx, { unit: e.target.value })}
                  >
                    {RCP_UNITS.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="delete-btn rcp-ing-del"
                    onClick={() => removeRow(idx)}
                    aria-label="Прибрати"
                  >
                    ×
                  </button>
                </div>
              ))}
              <button type="button" className="btn-secondary rcp-add-ing-btn" onClick={addRow}>
                + Інгредієнт
              </button>

              <label>
                Приготування <span className="rcp-hint">(один крок — один рядок)</span>
              </label>
              <textarea
                rows={5}
                value={stepsText}
                onChange={(e) => setStepsText(e.target.value)}
                placeholder={"Закип'ятити воду, посолити\nЗварити пасту 9 хв\nОбсмажити фарш з цибулею…"}
              />
            </div>
          )}
        </div>

        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Скасувати
          </button>
          <button type="button" className="btn" onClick={save} disabled={!title.trim()}>
            Зберегти
          </button>
        </div>
      </div>
    </div>
  );
}
