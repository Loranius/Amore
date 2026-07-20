// ============================================================
// Card — спільна "поверхнева панель" (фон + радіус + паддінг)
// ------------------------------------------------------------
// .fin-card/.cul-card/.wt-card окремо дублювали той самий базовий
// стиль (surface, радіус ~16-18px, паддінг ~14-18px) із дрібними
// відмінностями. Тепер один спільний .card + опційний className
// для фіче-специфічної розкладки (напр. "card wt-card" для
// flex-column/gap, як уже було в WhereToPage).
// ============================================================
import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export function Card({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('card', className)} {...rest} />;
}
