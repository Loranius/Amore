// ============================================================
// TabBar — спільна "пігулка"-стрічка табів/фільтрів
// ------------------------------------------------------------
// Шість фіч (Вішлист, Кулінарія, Вотчліст, Карта, Календар-фільтр,
// Кулінарія-категорії) окремо переізобрітали той самий CSS-патерн
// (999px пігулки, активна = --accent). Це для ЛОКАЛЬНОГО стану
// (useState + onChange). Роут-табів більше немає: останній хаб
// («Календар») розібрано, а «Графік» став власним розділом.
//
// variant="fill"   — рівна ширина, без скролу (мало пунктів: 2-3).
// variant="scroll" — контент-ширина + горизонтальний скрол (багато
//                    пунктів: категорії, фільтри).
// ============================================================
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface TabBarItem<T extends string = string> {
  value: T;
  label: string;
  /**
   * Мальований значок із набору.
   *
   * Приймає `ReactNode`, і колись сюди клали емодзі-рядки. Це виглядало
   * як тимчасова заглушка, яка лишилась: емодзі малює система, а не
   * портал, тож він не бере колір активної вкладки, не масштабується
   * разом із текстом і на різних платформах виглядає по-різному.
   */
  icon?: ReactNode;
  count?: number;
  disabled?: boolean;
}

export function TabBar<T extends string>({
  items,
  value,
  onChange,
  variant = 'fill',
}: {
  items: TabBarItem<T>[];
  value: T;
  onChange: (v: T) => void;
  variant?: 'fill' | 'scroll';
}) {
  return (
    <div className={cn('tab-bar', variant === 'scroll' && 'tab-bar--scroll')} role="tablist">
      {items.map((it) => (
        <button
          key={it.value}
          type="button"
          role="tab"
          aria-selected={it.value === value}
          className={cn('tab-bar-btn', it.value === value && 'active')}
          disabled={it.disabled}
          onClick={() => onChange(it.value)}
        >
          {it.icon && <span className="tab-icon" aria-hidden="true">{it.icon}</span>}
          {it.label}
          {it.count !== undefined && <span className="tab-bar-count">{it.count}</span>}
        </button>
      ))}
    </div>
  );
}
