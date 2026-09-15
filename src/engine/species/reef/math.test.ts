import { describe, expect, it } from 'vitest';
import { reefContactShade } from './math';
describe('затемнення в місці дотику', () => {
  /*
   * ВИМОГА (ADR-0195, крок 6): наклеєне видно по краю, виросле — ні. Тінь
   * у щілині між тілом і поверхнею — те, чим вони відрізняються, і вона
   * запечена в тон вершини, бо в мить побудови відома безкоштовно.
   */
  it('підошва темніша за середину, а верх не чіпається зовсім', () => {
    expect(reefContactShade(0)).toBeCloseTo(0.75, 6);
    expect(reefContactShade(1)).toBe(1);
    expect(reefContactShade(0.55)).toBe(1);
  });

  it('спадає МОНОТОННО — тінь не сміє світлішати донизу', () => {
    let previous = 0;
    for (let at = 0; at <= 20; at += 1) {
      const value = reefContactShade(at / 20);
      expect(value).toBeGreaterThanOrEqual(previous);
      previous = value;
    }
  });

  it('досяжність задана КРОКОМ СІТКИ, а не фізикою', () => {
    /*
     * У природі щілинна тінь коротка. Але тінь, коротша за крок вершин,
     * стає не тінню, а сходинкою: у коралового тіла чотири пояси профілю,
     * тож перший накриває чверть висоти. При досяжності 0.28 уся тінь
     * лягала б усередину одного пояса й давала стрибок тону 36% між двома
     * кільцями — рівно той твердий край, проти якого зроблено весь
     * ADR-0195.
     *
     * Тому на схил мусить лягати щонайменше ДВА кільця найгрубішого тіла.
     */
    const coarsestRingStep = 0.25;
    let onSlope = 0;
    for (let ring = 0; ring * coarsestRingStep <= 1; ring += 1) {
      if (reefContactShade(ring * coarsestRingStep) < 1) onSlope += 1;
    }
    expect(onSlope, 'кілець на схилі тіні').toBeGreaterThanOrEqual(2);
  });

  it('ніколи не вимикає тіло й не дає від’ємного множника', () => {
    for (const along of [-1, 0, 0.5, 1, 4, Number.NaN, Number.POSITIVE_INFINITY]) {
      const value = reefContactShade(along);
      expect(Number.isFinite(value)).toBe(true);
      expect(value).toBeGreaterThan(0.5);
      expect(value).toBeLessThanOrEqual(1);
    }
  });
});
