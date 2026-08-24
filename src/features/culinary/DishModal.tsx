// ============================================================
// RecipeModal (перегляд) + DishModal (додати/редагувати + редактор рецепта)
// ============================================================
import { useState } from 'react';
import { ModalClose } from '@/components/ui/ModalClose';
import { ChevronDownIcon, CloseIcon, PlusIcon } from '@/components/icons/UiIcon';
import { CartIcon } from '@/components/icons/NavIcon';
import { BookIcon } from '@/components/icons/PlanIcon';
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
        <ModalClose onClose={onClose} />
        <h2 className="modal-title">{dish.title}</h2>
        {r?.servings && <p className="rcp-servings-line">Порцій: {r.servings}</p>}

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
              <CartIcon size={16} />
              <span>В покупки</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Додати / редагувати страву ───────────────────────────────
interface Row {
  /** Стабільний ключ рядка. Не зберігається — живе лише поки відкрита форма. */
  id: number;
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
  /*
   * Кожен рядок носить власний `id`, і це не педантизм.
   *
   * Ключем був індекс масиву. Прибираєш другий інгредієнт із п'яти — і
   * React вважає, що третій «став другим», четвертий «став третім»:
   * замість того, щоб зняти один рядок, він переписує чотири. Значення
   * приїжджають зі стану й виглядають правильно, але фокус, каретка й
   * позиція прокрутки лишаються там, де були, — тобто в чужому полі.
   */
  const [nextId, setNextId] = useState(0);
  const [rows, setRows] = useState<Row[]>(() => {
    const source = dish?.recipe?.ingredients?.length
      ? dish.recipe.ingredients.map((i) => ({ name: i.name, amount: i.amount, unit: i.unit }))
      : [{ name: '', amount: '', unit: 'г' }];
    setNextId(source.length);
    return source.map((row, index) => ({ ...row, id: index }));
  });
  const [stepsText, setStepsText] = useState((dish?.recipe?.steps ?? []).join('\n'));

  const updateRow = (id: number, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const addRow = () => {
    setRows((rs) => [...rs, { id: nextId, name: '', amount: '', unit: 'г' }]);
    setNextId((n) => n + 1);
  };
  const removeRow = (id: number) => setRows((rs) => rs.filter((r) => r.id !== id));

  /** Що написано в згорнутому рецепті. */
  const filled = rows.filter((r) => r.name.trim()).length;
  const stepCount = stepsText.split('\n').filter((line) => line.trim()).length;
  const recipeSummary = filled === 0 && stepCount === 0
    ? 'ще немає'
    : [
        filled > 0 ? `${filled} ${filled === 1 ? 'інгредієнт' : filled < 5 ? 'інгредієнти' : 'інгредієнтів'}` : '',
        stepCount > 0 ? `${stepCount} ${stepCount === 1 ? 'крок' : stepCount < 5 ? 'кроки' : 'кроків'}` : '',
      ].filter(Boolean).join(' · ');

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
        <ModalClose onClose={onClose} />
        <h2 className="modal-title">{isEdit ? 'Редагувати страву' : 'Нова страва'}</h2>

        <label className="form-field">
          <span>Назва страви</span>
          <input
            id="dish-title"
            name="title"
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
          {/*
            * Підпис каже, що всередині, а не «(опційно)».
            *
            * Слово «опційно» відповідало на питання, якого пара не
            * ставила, і мовчало про єдине, що тут справді цікаво: чи
            * рецепт узагалі є. Тепер згорнутий рядок показує саме це.
            */}
          <button
            type="button"
            className="rcp-toggle"
            onClick={() => setShowRecipe((v) => !v)}
            aria-expanded={showRecipe}
          >
            <span className="rcp-toggle-label">
              <BookIcon size={17} />
              <span>Рецепт</span>
              {!showRecipe && <small>{recipeSummary}</small>}
            </span>
            <span className={`rcp-toggle-arrow${showRecipe ? ' open' : ''}`} aria-hidden="true">
              <ChevronDownIcon size={16} />
            </span>
          </button>

          {showRecipe && (
            <div className="rcp-editor">
              <label htmlFor="dish-servings">Порції</label>
              <input
                id="dish-servings"
                name="servings"
                type="number"
                min={1}
                max={20}
                value={servings}
                onChange={(e) => setServings(parseInt(e.target.value, 10) || 1)}
                className="rcp-servings-inp"
              />

              <label>Інгредієнти</label>
              {/*
                * Назва інгредієнта займає власний рядок.
                *
                * Було чотири колонки в один рядок: `1fr 70px 90px 32px`.
                * Виміряно на телефоні 412px — під назву лишалось 118px, і
                * список читався як «Свинина (вирі», «Буйон курини»,
                * «Пармезан тер». Пара не бачила, що саме редагує.
                */}
              {rows.map((r) => (
                <div key={r.id} className="rcp-ing-row">
                  <input
                    id={`dish-ing-name-${r.id}`}
                    name={`ingredientName-${r.id}`}
                    className="rcp-ing-name"
                    placeholder="Інгредієнт"
                    value={r.name}
                    onChange={(e) => updateRow(r.id, { name: e.target.value })}
                  />
                  <button
                    type="button"
                    className="rcp-ing-del"
                    onClick={() => removeRow(r.id)}
                    aria-label={r.name.trim() ? `Прибрати: ${r.name.trim()}` : 'Прибрати інгредієнт'}
                  >
                    <CloseIcon size={15} />
                  </button>
                  <input
                    id={`dish-ing-amount-${r.id}`}
                    name={`ingredientAmount-${r.id}`}
                    className="rcp-ing-amount"
                    placeholder="200"
                    inputMode="decimal"
                    value={r.amount}
                    onChange={(e) => updateRow(r.id, { amount: e.target.value })}
                  />
                  <select
                    id={`dish-ing-unit-${r.id}`}
                    name={`ingredientUnit-${r.id}`}
                    className="rcp-ing-unit"
                    value={r.unit}
                    onChange={(e) => updateRow(r.id, { unit: e.target.value })}
                  >
                    {RCP_UNITS.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
              <button type="button" className="rcp-add-ing-btn" onClick={addRow}>
                <PlusIcon size={15} />
                <span>Інгредієнт</span>
              </button>

              <label htmlFor="dish-steps">
                Приготування <span className="rcp-hint">— один крок на рядок</span>
              </label>
              <textarea
                id="dish-steps"
                name="steps"
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
