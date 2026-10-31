import { describe, expect, it } from 'vitest';
import { hdArtScale } from './kit';

// Власник 2026-10-31: «повністю відмовляємось від 16×16» — у міні-іграх
// Лєна, мама й Діма теж з аркушів PixelLab (`Kit.person`). Піксель малюнка
// там — пів світового пікселя, як на мапі, але завжди ціла кількість
// пікселів пристрою: інакше він розпливається чи стає нерівним.
describe('люди з аркушів PixelLab у міні-іграх', () => {
  it('піксель малюнка — ціла кількість пікселів пристрою, щонайближче до пів світового', () => {
    for (const s of [2, 3, 4, 5, 6, 8]) {
      for (const scale of [1, 2, 3, 4]) {
        const device = hdArtScale(s, scale) * s;
        expect(Math.abs(device - Math.round(device)), `s=${s}, scale=${scale}`).toBeLessThan(1e-9);
        expect(device).toBeGreaterThanOrEqual(1);
        expect(Math.abs(device - (s * scale) / 2), `s=${s}, scale=${scale}`).toBeLessThanOrEqual(0.5);
      }
    }
    // Телефон (s = 3): спрайт ×2 — піксель малюнка в один віртуальний; ×3 — у півтора, тобто 5 пікселів пристрою з 4,5.
    expect(hdArtScale(3, 2)).toBe(1);
    expect(hdArtScale(3, 3) * 3).toBe(5);
  });
});
