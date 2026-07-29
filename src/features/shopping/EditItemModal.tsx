// ============================================================
// EditItemModal — редагування товару.
// ------------------------------------------------------------
// Назва, кількість і категорія лишаються тим самим контрактом; змінена
// лише подача форми як компактного мобільного bottom sheet.
// ============================================================
import { useState } from 'react';
import { SHOPPING_CATEGORIES } from '@/app/constants';
import { CloseIcon } from '@/components/icons/UiIcon';
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

  const categories: ShoppingCategory[] = SHOPPING_CATEGORIES.includes(item.category)
    ? [...SHOPPING_CATEGORIES]
    : [...SHOPPING_CATEGORIES, item.category];

  const save = () => {
    const cleanTitle = title.trim();
    if (!cleanTitle) return;
    onSave({ id: item.id, title: cleanTitle, qty: qty.trim() || null, category });
    onClose();
  };

  return (
    <div
      className="modal-overlay shopping-edit-overlay"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="modal-sheet shopping-edit-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="shopping-edit-title"
      >
        <header className="shopping-edit-head">
          <div>
            <small>Покупка</small>
            <h2 id="shopping-edit-title">Редагувати товар</h2>
          </div>
          <button type="button" className="shopping-edit-close" onClick={onClose} aria-label="Закрити">
            <CloseIcon size={19} />
          </button>
        </header>

        <form
          className="shopping-edit-form"
          onSubmit={(event) => {
            event.preventDefault();
            save();
          }}
        >
          <label className="form-field">
            <span>Назва</span>
            <input
              id="shopping-item-title"
              name="title"
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              autoFocus
            />
          </label>

          <label className="form-field">
            <span>Кількість або примітка</span>
            <input
              id="shopping-item-qty"
              name="qty"
              type="text"
              placeholder="Наприклад, 2 л або десяток"
              value={qty}
              onChange={(event) => setQty(event.target.value)}
            />
          </label>

          <label className="form-field">
            <span>Категорія</span>
            <select
              id="shopping-item-category"
              name="category"
              value={category}
              onChange={(event) => setCategory(toShoppingCategory(event.target.value))}
            >
              {categories.map((itemCategory) => (
                <option key={itemCategory} value={itemCategory}>
                  {itemCategory}
                </option>
              ))}
            </select>
          </label>

          <div className="shopping-edit-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Скасувати
            </button>
            <button type="submit" className="btn" disabled={!title.trim()}>
              Зберегти зміни
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
