import { describe, expect, it } from 'vitest';
import { DRIFT_PERIOD_SECONDS, DRIFT_RESUME_MS, reefDriftStep } from './reefDrift';

describe('дрейф не змагається з пальцем', () => {
  it('поки палець веде — кроку немає', () => {
    /*
     * Це і є вада, через яку файл існує. `setAzimuthalAngle` не додає
     * крок, а ПЕРЕЗАПИСУЄ накопичений зсув, а контроли drei
     * оновлюються раніше за сцену. Тобто дрейф щокадру викидав увесь
     * свайп і лишав замість нього свій крок у соту градуса.
     */
    expect(reefDriftStep(1 / 60, Number.POSITIVE_INFINITY, 1_000)).toBe(0);
  });

  it('і ще кілька секунд після відпускання', () => {
    // Інакше дрейф перехопив би інерцію згасання на півдорозі, і рух
    // обірвався б поштовхом.
    const released = 5_000;
    expect(reefDriftStep(1 / 60, released + DRIFT_RESUME_MS, released + 100)).toBe(0);
    expect(reefDriftStep(1 / 60, released + DRIFT_RESUME_MS, released + DRIFT_RESUME_MS + 1))
      .toBeGreaterThan(0);
    expect(DRIFT_RESUME_MS).toBeGreaterThan(2_000);
  });

  it('сам дрейф лишається повільним', () => {
    // Понад три хвилини на оберт: рух видно лише тому, хто дивиться.
    const perSecond = reefDriftStep(1, 0, 1_000);
    expect((Math.PI * 2) / perSecond).toBeCloseTo(DRIFT_PERIOD_SECONDS, 6);
    expect(DRIFT_PERIOD_SECONDS).toBeGreaterThan(120);
  });

  it('поганий кадр не рухає сцену', () => {
    for (const bad of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(reefDriftStep(bad, 0, 1_000), `delta ${bad}`).toBe(0);
    }
  });
});
