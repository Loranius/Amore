// ============================================================
// Favorites — пул улюблених страв (порт вкладки «Улюблені»)
// ------------------------------------------------------------
// Категорійні таби, рандом-вибір, список страв (рецепт/редагувати/
// видалити), додавання. Рецепт → перегляд/в покупки.
// ============================================================
import { useMemo, useState } from 'react';
import { DISH_CATS, DISH_CAT_ORDER } from './culinaryConstants';
import { useDishes, useDishMutations } from './useDishes';
import { DishModal, RecipeModal } from './DishModal';
import type { DishRow, DishCategory } from '@/types';

type CatFilter = 'all' | DishCategory;

const hasRecipe = (d: DishRow) =>
  !!(d.recipe && ((d.recipe.ingredients?.length ?? 0) || (d.recipe.steps?.length ?? 0)));

export function Favorites() {
  const { data: dishes = [], isPending } = useDishes();
  const { add, edit, remove, toShopping } = useDishMutations();

  const [cat, setCat] = useState<CatFilter>('all');
  const [rolled, setRolled] = useState<DishRow | null>(null);
  const [editing, setEditing] = useState<DishRow | null>(null);
  const [adding, setAdding] = useState(false);
  const [viewing, setViewing] = useState<DishRow | null>(null);

  const visible = useMemo(
    () => (cat === 'all' ? dishes : dishes.filter((d) => (d.category ?? 'other') === cat)),
    [dishes, cat],
  );

  const roll = () => {
    if (!visible.length) {
      setRolled(null);
      return;
    }
    setRolled(visible[Math.floor(Math.random() * visible.length)]!);
  };

  const onDelete = (id: number) => {
    if (confirm('Видалити страву?')) remove.mutate(id);
  };

  return (
    <div className="favorites">
      {/* Категорійні таби */}
      <div className="dish-cat-tabs">
        <button
          type="button"
          className={`dish-cat-tab${cat === 'all' ? ' active' : ''}`}
          onClick={() => setCat('all')}
        >
          🎲 Всі <span className="dish-cat-count">{dishes.length}</span>
        </button>
        {DISH_CAT_ORDER.map((key) => (
          <button
            key={key}
            type="button"
            className={`dish-cat-tab${cat === key ? ' active' : ''}`}
            onClick={() => setCat(key)}
          >
            {DISH_CATS[key].label}{' '}
            <span className="dish-cat-count">
              {dishes.filter((d) => (d.category ?? 'other') === key).length}
            </span>
          </button>
        ))}
      </div>

      {/* Рандом */}
      <div className="dish-roll">
        <button type="button" className="btn dish-roll-btn" onClick={roll}>
          🎲 Рандом
        </button>
        <div className={`dish-result${rolled ? ' rolled' : ''}`}>
          {rolled ? rolled.title : visible.length ? 'Натисни «Рандом»' : 'Пул порожній'}
        </div>
        {rolled && hasRecipe(rolled) && (
          <button type="button" className="btn-secondary" onClick={() => setViewing(rolled)}>
            📖 Рецепт
          </button>
        )}
      </div>

      <button type="button" className="btn dish-add-btn" onClick={() => setAdding(true)}>
        + Додати страву
      </button>

      {/* Список */}
      {isPending ? (
        <p className="empty-state">Завантаження…</p>
      ) : visible.length === 0 ? (
        <p className="empty-state">
          {dishes.length ? 'У цій категорії поки порожньо.' : 'Пул страв порожній. Додай улюблені!'}
        </p>
      ) : (
        <div className="dish-list">
          {visible.map((d) => {
            const c = DISH_CATS[d.category ?? 'other'];
            const recipe = hasRecipe(d);
            return (
              <div key={d.id} className="dish-row">
                <span className="dish-cat-dot" style={{ background: c.color }} title={c.label} />
                <p
                  className={`dish-title${recipe ? ' dish-title--link' : ''}`}
                  onClick={() => recipe && setViewing(d)}
                >
                  {d.title}
                </p>
                <div className="dish-row-actions">
                  {recipe && (
                    <button type="button" className="dish-edit-btn" onClick={() => setViewing(d)} title="Рецепт">
                      📖
                    </button>
                  )}
                  <button type="button" className="dish-edit-btn" onClick={() => setEditing(d)} title="Редагувати">
                    ✏️
                  </button>
                  <button type="button" className="delete-btn" onClick={() => onDelete(d.id)} title="Видалити">
                    ×
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Модалки */}
      {(adding || editing) && (
        <DishModal
          dish={editing}
          onClose={() => {
            setAdding(false);
            setEditing(null);
          }}
          onAdd={(v) => add.mutate(v)}
          onEdit={(v) => edit.mutate(v)}
        />
      )}
      {viewing && (
        <RecipeModal
          dish={viewing}
          onClose={() => setViewing(null)}
          onToShopping={(ings) => toShopping.mutate(ings)}
        />
      )}
    </div>
  );
}
