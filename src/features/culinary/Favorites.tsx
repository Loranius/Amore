// ============================================================
// Favorites — пул улюблених страв (порт вкладки «Улюблені»)
// ------------------------------------------------------------
// Категорійні таби, рандом-вибір, список страв (рецепт/редагувати/
// видалити), додавання. Рецепт → перегляд/в покупки.
// ============================================================
import { useMemo, useState } from 'react';
import { useConfirm } from '@/providers/ConfirmProvider';
import { TabBar } from '@/components/ui/TabBar';
import { CloseIcon, PencilIcon, PlusIcon, SwapIcon } from '@/components/icons/UiIcon';
import { BookIcon } from '@/components/icons/PlanIcon';
import { DISH_CATS, DISH_CAT_ORDER } from './culinaryConstants';
import { useDishes, useDishMutations } from './useDishes';
import { DishModal, RecipeModal } from './DishModal';
import type { DishRow, DishCategory } from '@/types';
import { pickOne } from '@/lib/entropy';

type CatFilter = 'all' | DishCategory;

const hasRecipe = (d: DishRow) =>
  !!(d.recipe && ((d.recipe.ingredients?.length ?? 0) || (d.recipe.steps?.length ?? 0)));

export function Favorites() {
  const { data: dishes = [], isPending } = useDishes();
  const { add, edit, remove, toShopping } = useDishMutations();
  const confirmDialog = useConfirm();

  const [cat, setCat] = useState<CatFilter>('all');
  const [rolled, setRolled] = useState<DishRow | null>(null);
  const [editing, setEditing] = useState<DishRow | null>(null);
  const [adding, setAdding] = useState(false);
  const [viewing, setViewing] = useState<DishRow | null>(null);

  const visible = useMemo(
    () => (cat === 'all' ? dishes : dishes.filter((d) => (d.category ?? 'other') === cat)),
    [dishes, cat],
  );

  // Порожній пул `pickOne` віддає як `null` — окрема гілка на нього була
  // б тим самим кодом удвічі.
  const roll = () => setRolled(pickOne(visible));

  const onDelete = async (id: number) => {
    if (await confirmDialog('Видалити страву?')) remove.mutate(id);
  };

  return (
    <div className="favorites">
      {/* Категорійні таби */}
      <TabBar<CatFilter>
        variant="scroll"
        value={cat}
        onChange={setCat}
        items={[
          { value: 'all', label: 'Всі', icon: <SwapIcon size={15} />, count: dishes.length },
          ...DISH_CAT_ORDER.map((key) => ({
            value: key as CatFilter,
            label: DISH_CATS[key].label,
            count: dishes.filter((d) => (d.category ?? 'other') === key).length,
          })),
        ]}
      />

      {/* Рандом */}
      <div className="dish-roll">
        <button type="button" className="btn dish-roll-btn" onClick={roll}>
          <SwapIcon size={16} />
          <span>Рандом</span>
        </button>
        <div className={`dish-result${rolled ? ' rolled' : ''}`}>
          {rolled ? rolled.title : visible.length ? 'Натисни «Рандом»' : 'Пул порожній'}
        </div>
        {rolled && hasRecipe(rolled) && (
          <button type="button" className="btn btn-ghost" onClick={() => setViewing(rolled)}>
            <BookIcon size={16} />
            <span>Рецепт</span>
          </button>
        )}
      </div>

      <button type="button" className="btn dish-add-btn" onClick={() => setAdding(true)}>
        <PlusIcon size={16} />
        <span>Додати страву</span>
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
                {/*
                  * Кнопка видалення БІЛЬШЕ не носить `.delete-btn`.
                  *
                  * Той клас — `position: absolute; top: 6px; right: 6px`,
                  * розрахований на картку з `position: relative`.
                  * `.dish-row` позиціонованим не був, тож хрестики всіх
                  * страв злітали у верхній правий кут СТОРІНКИ й лягали
                  * один на одного — самотній «×» поверх усього модуля на
                  * знімку кулінарії. Прибрати конкретну страву цією
                  * кнопкою було неможливо.
                  */}
                <div className="dish-row-actions">
                  {recipe && (
                    <button type="button" className="dish-row-btn" onClick={() => setViewing(d)} aria-label={`Рецепт: ${d.title}`}>
                      <BookIcon size={17} />
                    </button>
                  )}
                  <button type="button" className="dish-row-btn" onClick={() => setEditing(d)} aria-label={`Редагувати: ${d.title}`}>
                    <PencilIcon size={16} />
                  </button>
                  <button type="button" className="dish-row-btn dish-row-btn--danger" onClick={() => onDelete(d.id)} aria-label={`Видалити: ${d.title}`}>
                    <CloseIcon size={16} />
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
