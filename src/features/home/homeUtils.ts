// ============================================================
// Home — чисті утиліти для дати старту стосунків (кристал/підпис)
// ============================================================

export function daysBetween(dateStr: string): number {
  const start = new Date(dateStr);
  const now = new Date();
  start.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);
  return Math.floor((now.getTime() - start.getTime()) / 86_400_000);
}

export function formatSinceDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('uk-UA', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/** Найближча річниця + людяний підпис. 29.02 у невисокосний рік → 28.02. */
export function nextAnniversaryLabel(startDate: string): string {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const start = new Date(startDate);
  const startMonth = start.getMonth();

  const nextAnn = new Date(start);
  nextAnn.setFullYear(now.getFullYear());
  if (nextAnn.getMonth() !== startMonth) nextAnn.setDate(0);
  if (nextAnn <= now) {
    nextAnn.setFullYear(now.getFullYear() + 1);
    if (nextAnn.getMonth() !== startMonth) nextAnn.setDate(0);
  }

  const diffDays = Math.round((nextAnn.getTime() - now.getTime()) / 86_400_000);
  const years = nextAnn.getFullYear() - start.getFullYear();

  if (diffDays === 0) return `🎉 Сьогодні ${years} рік разом!`;
  if (diffDays === 1) return `💕 Завтра ${years} рік разом`;
  if (diffDays <= 30) return `💕 Річниця через ${diffDays} дн. (${years} р.)`;
  return `Річниця через ~${Math.round(diffDays / 30)} міс.`;
}
