// ============================================================
// Вкладки вішліста словами (ADR-0255).
// ------------------------------------------------------------
// Над сценою з кулями стояла пігулка з трьома кнопками й ручка-розгортка
// під нею — два ряди хрому, що читались як шаблонна панель, а не як
// місце, де живуть мрії. Тепер це три слова: обране — яскраве, решта —
// тихі, кількість — дрібно поруч. Налаштування вигляду й виконані —
// під однією кнопкою праворуч (`WishlistWorldNav`).
// ============================================================
import type { TabBarItem } from '@/components/ui/TabBar';

export function WishlistWordTabs<T extends string>({
  items,
  value,
  onChange,
}: {
  items: readonly TabBarItem<T>[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="wl-word-tabs" role="tablist" aria-label="Чиї бажання">
      {items.map((item) => (
        <button
          key={item.value}
          type="button"
          role="tab"
          className="wl-word-tab"
          aria-selected={item.value === value}
          onClick={() => onChange(item.value)}
        >
          {item.label}
          {item.count !== undefined && <span className="wl-word-tab-count">{item.count}</span>}
        </button>
      ))}
    </div>
  );
}
