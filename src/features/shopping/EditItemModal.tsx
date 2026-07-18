// ============================================================
// EditItemModal — редагування товару (порт openEditModal/saveEdit)
// ------------------------------------------------------------
// Керована форма замість innerHTML-модалки. Категорії — з
// SHOPPING_CATEGORIES; якщо у товара збереглась категорія, якої вже
// нема в списку, додаємо її окремою опцією (як робив старий код).
// ============================================================
import { useState } from 'react';
import { SHOPPING_CATEGORIES } from '@/app/constants';
import { toShoppingCategory } from '@/lib/guards';
import type { ShoppingItemRow, ShoppingCategory } from '@/types';

interface EditItemModalProps {
  item: ShoppingItemRow;
  onClose: () => void;
  onSave: (patch: Pick<ShoppingItemRow, 'id' | 'title' | 'qty' | 'category'>) => void;
}

export function EditItemModal({ item, onClose, onSave }: EditItemModalProps) {
  const [title, setTitle] = useState(item.title);
  const [qty, setQty] = useState(item.qty ?? '');
  const [category, setCategory] = useState<ShoppingCategory>(toShoppingCategory(item.category));

  // Якщо поточна категорія випала зі списку — показуємо її додатково.
  const cats: ShoppingCategory[] = SHOPPING_CATEGORIES.includes(item.category)
    ? [...SHOPPING_CATEGORIES]
    : [...SHOPPING_CATEGORIES, item.category];

  const save = () => {
    const t = title.trim();
    if (!t) return;
    onSave({ id: item.id, title: t, qty: qty.trim() || null, category });
    onClose();
  };

  return (
    <div
      className="modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-sheet" role="dialog" aria-modal="true" aria-label="Редагувати товар">
        <h2 className="modal-title">Редагувати товар</h2>

        <label className="form-field">
          <span>Назва</span>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoFocus
          />
        </label>

        <label className="form-field">
          <span>Кількість / примітка</span>
          <input
            type="text"
            placeholder="напр. 2 л, десяток"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
          />
        </label>

        <label className="form-field">
          <span>Категорія</span>
          <select
            value={category}
            onChange={(e) => setCategory(toShoppingCategory(e.target.value))}
          >
            {cats.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>

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
