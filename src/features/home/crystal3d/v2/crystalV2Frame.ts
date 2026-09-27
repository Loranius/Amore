// ============================================================
// Кристал v2 у сцені порталу: масштаб, кадр і «що виросло» (ADR-0217).
// ------------------------------------------------------------
// Чисті рішення без three: їх перевіряє тест, а не око.
// ============================================================
import { ARTIFACT_FIT_HEIGHT, ARTIFACT_FIT_WIDTH } from '@/engine/renderer/three';
import type { CrystalV2Geometry } from '@/engine/species/crystalV2/geometry';
import type { CrystalV2Snapshot } from '@/engine/species/crystalV2/model';
import type { GrowthEvent } from '@/features/home/growthSinceLastVisit';

/**
 * Висота монарха, яка заповнює кадр: двадцять років разом
 * (`1.4 + 1.25·ln(21)`). Масштаб СТАЛИЙ, а не «вписати в кадр»: інакше
 * кристал кожної пари був би одного розміру на екрані, і головне, що він
 * каже, — скільки ви разом, — зникло б (та сама причина, що в старому
 * `fitScaleFor`).
 */
const REFERENCE_HEIGHT = 1.4 + 1.25 * Math.log(21);

export interface CrystalV2Frame {
  /** Множник від одиниць моделі до одиниць сцени. */
  scale: number;
  /** Висота монарха в сцені — під неї стає камера. */
  height: number;
  /** Найдальша точка колонії від осі в сцені. */
  reach: number;
  /** Радіус жеоди в сцені — до нього доростає зелень острова. */
  geodeRadius: number;
}

export function crystalV2Frame(geometry: CrystalV2Geometry): CrystalV2Frame {
  const reference = ARTIFACT_FIT_HEIGHT / REFERENCE_HEIGHT;
  // Рамка кадру — тверда межа: дуже довга історія стискається, а не вилазить.
  const contain = Math.min(
    ARTIFACT_FIT_HEIGHT / Math.max(1e-3, geometry.height),
    ARTIFACT_FIT_WIDTH / Math.max(1e-3, geometry.reach * 2),
  );
  const scale = Math.min(reference, contain);
  return {
    scale,
    height: geometry.height * scale,
    reach: geometry.reach * scale,
    geodeRadius: geometry.geodeRadius * scale,
  };
}

/**
 * Події для «що виросло з минулого разу». Ключі — ТІ САМІ, що давав старий
 * рушій (`memory:1:preserved`, `wish:3:fulfilled`…): пам'ять «уже бачено»
 * в браузері пари переживає заміну сцени, і першого візиту після неї підпис
 * не скаже «+300».
 */
export function crystalV2GrowthEvents(snapshot: CrystalV2Snapshot): GrowthEvent[] {
  const events: GrowthEvent[] = [];
  const add = (
    rows: readonly { id: number; date: string | null; fulfilledById?: number | null }[] | undefined,
    key: (id: number) => string,
  ) => {
    for (const row of rows ?? []) {
      if (row.date) events.push({ id: key(row.id), actorId: row.fulfilledById ?? null });
    }
  };
  add(snapshot.memories, (id) => `memory:${id}:preserved`);
  add(snapshot.plans, (id) => `plan:${id}:completed`);
  add(snapshot.wishes, (id) => `wish:${id}:fulfilled`);
  add(snapshot.places, (id) => `place:${id}:visited`);
  add(snapshot.media, (id) => `media:${id}:finished`);
  add(snapshot.events, (id) => `calendar:${id}:origin`);
  return events;
}
