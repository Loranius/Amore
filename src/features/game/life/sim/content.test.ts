import { describe, expect, it } from 'vitest';
import { CITIES, REGION_CITY_IDS } from './content';

// ============================================================
// Власник, 2026-10-04: на мапі подорожей Жилинці, Правдівка й Хмельницький
// лежали в одній точці, і Жилинці неможливо було обрати.
// ============================================================

describe('мапа Поділля', () => {
  it('усі села й міста Поділля мають своє місце на детальній мапі', () => {
    for (const id of ['zhylyntsi', 'pravdivka', 'khmelnytskyi', 'vinnytsia'] as const) expect(REGION_CITY_IDS).toContain(id);
  });

  it('жодні два не ближче ніж на 0.15 мапи: кожне можна торкнути пальцем', () => {
    for (const a of REGION_CITY_IDS) {
      for (const b of REGION_CITY_IDS) {
        if (a === b) continue;
        const [ax, ay] = CITIES[a].local!;
        const [bx, by] = CITIES[b].local!;
        expect(Math.hypot(ax - bx, ay - by)).toBeGreaterThan(0.15);
      }
    }
  });
});
