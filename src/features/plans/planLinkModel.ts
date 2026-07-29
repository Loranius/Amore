// ============================================================
// Чисті правила зв'язків плану.
// ------------------------------------------------------------
// Без React і Supabase, як planModel і planMoney. Головне правило тут
// одне й воно неочевидне: рядок зв'язку може пережити свою ціль.
// `plan_links.target_id` навмисно без зовнішнього ключа (взірець
// memory_links), щоб видалення бажання не блокувало й не каскадило в
// план. Плата за це — осиротілі рядки, і розбиратись із ними мусить
// показ, а не база.
// ============================================================
import type { PlanLinkRow, PlanLinkTarget, PlanRow } from '@/types';

/** Що показати про ціль зв'язку. Модуль планів не тягне до себе типи
 *  вішлиста, карти й архіву — йому досить компактного preview-контракту. */
export interface LinkTargetInfo {
  title: string;
  subtitle?: string | null;
  imageUrl?: string | null;
}

/** Довідник «тип → id → чим це є». Збирається на місці показу з тих
 *  даних, які читач і так бачить. */
export type LinkCatalog = Partial<Record<PlanLinkTarget, ReadonlyMap<number, LinkTargetInfo>>>;

export interface ResolvedLink extends LinkTargetInfo {
  type: PlanLinkTarget;
  id: number;
}

/** Зв'язки саме цього плану. */
export function linksOfPlan(plan: PlanRow, links: readonly PlanLinkRow[]): PlanLinkRow[] {
  return links.filter((l) => l.plan_id === plan.id);
}

/**
 * Зв'язки, які є що показати.
 *
 * Ціль, якої немає в довіднику, ПРОПУСКАЄТЬСЯ. Два випадки дають один
 * і той самий результат, і обидва мають виглядати як «зв'язку немає»:
 *
 * • бажання/мітку/спогад видалили — рядок лишився, показувати нічого;
 * • читач цієї цілі не бачить — вішлист віддає лише дозволене, і
 *   малювати «щось приховане» означало б повідомити про його існування.
 *
 * Порядок сталий: спершу бажання, потім місця, потім спогади, а
 * всередині типу — за id. Без цього дві прив'язки, зроблені в одну
 * секунду, мінялись би місцями між перемальовуваннями.
 */
const TYPE_ORDER: PlanLinkTarget[] = ['wish', 'place', 'memory'];

export function resolveLinks(
  links: readonly PlanLinkRow[],
  catalog: LinkCatalog,
): ResolvedLink[] {
  const out: ResolvedLink[] = [];
  for (const link of links) {
    const info = catalog[link.target_type]?.get(link.target_id);
    if (!info) continue;
    out.push({ type: link.target_type, id: link.target_id, ...info });
  }
  return out.sort(
    (a, b) => TYPE_ORDER.indexOf(a.type) - TYPE_ORDER.indexOf(b.type) || a.id - b.id,
  );
}

/** Чи ця ціль уже прив'язана — щоб не пропонувати її у виборі вдруге. */
export function isLinked(
  plan: PlanRow,
  type: PlanLinkTarget,
  id: number,
  links: readonly PlanLinkRow[],
): boolean {
  return links.some(
    (l) => l.plan_id === plan.id && l.target_type === type && l.target_id === id,
  );
}
