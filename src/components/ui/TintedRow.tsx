// ============================================================
// TintedRow — спільна обгортка для "рядка з тонованим фоном"
// ------------------------------------------------------------
// .goal-row (Фінанси-цілі), .date-plan-card (Побачення) і .notif-item
// (Сповіщення) були трьома байт-у-байт однаковими CSS-блоками —
// цей компонент замінює всі три одним спільним layout-примітивом
// (info/actions-слоти + pending-модифікатор). Стилізація ВМІСТУ
// (назва/опис/бейджі) лишається за конкретною фічею — тут лише
// зовнішній контейнер.
// ============================================================
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function TintedRow({
  pending,
  info,
  actions,
}: {
  pending?: boolean;
  info: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className={cn('tinted-row', pending && 'tinted-row--pending')}>
      <div className="tinted-row-info">{info}</div>
      {actions && <div className="tinted-row-actions">{actions}</div>}
    </div>
  );
}
