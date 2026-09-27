import { describe, expect, it } from 'vitest';
import { ARTIFACT_FIT_HEIGHT, ARTIFACT_FIT_WIDTH } from '@/engine/renderer/three';
import { buildCrystalV2Geometry } from '@/engine/species/crystalV2/geometry';
import { buildCrystalV2Model } from '@/engine/species/crystalV2/model';
import { crystalV2Frame, crystalV2GrowthEvents } from './crystalV2Frame';

// ============================================================
// Кристал v2 у кадрі порталу (ADR-0217).
// ------------------------------------------------------------
// PRODUCT.md: «час — головна валюта росту». Кадр не сміє цього скасувати:
// старший кристал мусить бути БІЛЬШИМ на екрані, а не вписаним у ту саму
// рамку, що й молодий.
// ============================================================

const frameAt = (asOf: string) =>
  crystalV2Frame(buildCrystalV2Geometry(buildCrystalV2Model({ startDate: '2022-12-26', asOf, partners: {} })));

describe('кристал v2: кадр', () => {
  it('старший кристал вищий на екрані: масштаб сталий, а не «вписати»', () => {
    const young = frameAt('2023-06-01');
    const now = frameAt('2026-09-27');
    const old = frameAt('2036-09-27');
    expect(young.scale).toBe(now.scale);
    expect(young.height).toBeLessThan(now.height);
    expect(now.height).toBeLessThan(old.height);
  });

  it('дуже довга історія стискається до рамки, а не вилазить за неї', () => {
    const ancient = frameAt('2122-12-26');
    expect(ancient.height).toBeLessThanOrEqual(ARTIFACT_FIT_HEIGHT + 1e-9);
    expect(ancient.reach * 2).toBeLessThanOrEqual(ARTIFACT_FIT_WIDTH + 1e-9);
  });
});

describe('кристал v2: «що виросло з минулого разу»', () => {
  it('ключі подій ті самі, що давав старий рушій — пам\'ять візиту переживає заміну сцени', () => {
    const events = crystalV2GrowthEvents({
      startDate: '2022-12-26',
      asOf: '2026-09-27',
      partners: { red: 2, blue: 1 },
      memories: [{ id: 1, date: '2024-01-01' }],
      plans: [{ id: 2, date: '2024-01-01' }],
      wishes: [{ id: 3, date: '2024-01-01', fulfilledById: 2 }, { id: 4, date: null }],
      places: [{ id: 5, date: '2024-01-01' }],
      media: [{ id: 6, date: '2024-01-01' }],
      events: [{ id: 7, date: '2024-01-01' }],
    });
    expect(events).toEqual([
      { id: 'memory:1:preserved', actorId: null },
      { id: 'plan:2:completed', actorId: null },
      { id: 'wish:3:fulfilled', actorId: 2 },
      { id: 'place:5:visited', actorId: null },
      { id: 'media:6:finished', actorId: null },
      { id: 'calendar:7:origin', actorId: null },
    ]);
  });
});
