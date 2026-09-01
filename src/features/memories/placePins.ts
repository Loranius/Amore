// ============================================================
// Мітка карти для місця — одна дорога для всіх, хто її створює.
// ------------------------------------------------------------
// Читачів у цієї дії двоє: нотатник спогадів («де це було?») і
// заповнення історії («де ви були того року?»). Обидва мусять поводитись
// однаково, бо обидва пишуть в ОДНУ карту пари, і розійтись їм тут
// найлегше: один дедуплікує мітки, другий ні — і в пари з'являється
// друга тераса за десять метрів від першої.
//
// ЧОМУ ДАТА ТУТ ГОЛОВНА. `adapters/map.ts` починається з
// `if (!row.visitedAt) continue`. Мітка без дати невидима рушієві
// повністю: три справжні подорожі лишають рік рівно порожнім (0.300 —
// виміряно). Поле, яке легко забути, вирішує, чи карта взагалі є одним
// із шести модулів року, — і саме його живий шлях створення мітки
// перестав ставити (ADR-0079).
// ============================================================
import { supabase } from '@/lib/supabase';
import type { InsertRow, MapPinRow } from '@/types';
import { decidePlacePin } from './momentPlace';
import type { PlaceCandidate } from './momentPlace';

/** Що саме сталося з міткою — щоб екран міг сказати правду, а не «готово». */
export type PlacePinOutcome =
  /** Мітки не було — створена, датована цим роком. */
  | { kind: 'created'; id: number }
  /** Мітка була без дати — тепер належить цьому рокові. */
  | { kind: 'dated'; id: number }
  /** Мітка вже датована іншим разом; її дату не чіпали. */
  | { kind: 'taken'; id: number; visitedAt: string };

/**
 * Знайти мітку для місця або створити її.
 *
 * Дата в НАЯВНУ мітку дописується лише коли її там немає. Мітка тримає
 * рівно одну дату, а пара може повернутись у те саме місце через п'ять
 * років; перезапис означав би, що новий спогад тихо переписує старий —
 * `PRODUCT.md` каже, що минуле не переписується.
 *
 * Названа межа, яка з цього випливає: **повторний візит не піднімає
 * другий рік**. Щоб він піднімав, картці потрібна таблиця відвідин, а не
 * колонка; це окрема робота, і вигадувати замість неї другу мітку за
 * десять метрів від першої не можна.
 */
export async function ensurePlacePin(
  place: PlaceCandidate,
  userId: number,
  visitedAt: string,
): Promise<PlacePinOutcome> {
  const { data, error } = await supabase
    .from('map_pins')
    .select('id,title,city,country,lat,lng,visited_at');
  if (error) throw error;

  const decision = decidePlacePin((data ?? []) as MapPinRow[], place);

  if (decision.kind === 'keep') {
    return { kind: 'taken', id: decision.id, visitedAt: decision.visitedAt };
  }

  if (decision.kind === 'date') {
    const { error: updateError } = await supabase
      .from('map_pins')
      .update({ visited_at: visitedAt })
      .eq('id', decision.id);
    if (updateError) throw updateError;
    return { kind: 'dated', id: decision.id };
  }

  const row: InsertRow<'map_pins'> = {
    title: place.title,
    // Спогад і прохід по роках однаково про те, де пара вже БУЛА.
    // «Улюблене» чи «ресторан» вона ставить сама на карті.
    category: 'visited',
    lat: place.lat,
    lng: place.lng,
    city: place.city,
    country: place.country,
    created_by: userId,
    visited_at: visitedAt,
  };
  const { data: created, error: insertError } = await supabase
    .from('map_pins')
    .insert(row)
    .select('id')
    .single();
  if (insertError || !created) throw insertError ?? new Error('insert failed');
  return { kind: 'created', id: (created as { id: number }).id };
}
