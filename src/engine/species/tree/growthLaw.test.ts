import { describe, expect, it } from 'vitest';
import {
  TREE_FULL_TERM_YEARS,
  treeAgeProgress,
  treeCrownScale,
  treeTrunkHeightScale,
  treeTrunkRadiusScale,
} from './growthLaw';

// ============================================================
// Послідовність власника, перекладена в перевірки.
// ------------------------------------------------------------
// «1 рік — росток; 2 — видно маленький стовбур, що тягнеться догори;
//  3 — є гілки і стовбур грубший; 4 — стовбур і гілки грубші;
//  5 — дерево вже добре окріпло; і так до 40».
//
// До цієї зміни жодне з тих речень не було правдою: розміри дерева не
// залежали від віку взагалі (4.97 / 5.10 / 5.23 / 5.00 / 5.25 одиниць на
// 1, 3, 5, 10 і 20 роках).
// ============================================================

const DAYS = 365.2425;
const at = (years: number) => years * DAYS;

describe('дерево росте з роками', () => {
  it('кожен наступний рік вищий за попередній', () => {
    let previous = 0;
    for (let years = 0; years <= TREE_FULL_TERM_YEARS; years += 1) {
      const height = treeTrunkHeightScale(at(years));
      expect(height, `рік ${years}`).toBeGreaterThan(previous);
      previous = height;
    }
  });

  it('перший рік — росток, а не мале дерево', () => {
    // Менше десятої дорослого: це прутик, і саме так його має бути видно.
    expect(treeTrunkHeightScale(at(1))).toBeLessThan(0.16);
    expect(treeTrunkHeightScale(at(1))).toBeGreaterThan(0.05);
  });

  it('на сорока роках дерево доросле', () => {
    expect(treeTrunkHeightScale(at(TREE_FULL_TERM_YEARS))).toBeCloseTo(1, 3);
    expect(treeTrunkRadiusScale(at(TREE_FULL_TERM_YEARS))).toBeCloseTo(1, 3);
    expect(treeCrownScale(at(TREE_FULL_TERM_YEARS))).toBeCloseTo(1, 3);
  });

  it('старше за сорок не росте далі', () => {
    // Пара з піввіковою історією не має отримати дерево вдвічі більше за
    // кадр: після повного терміну історія показує себе гілками й листям.
    expect(treeTrunkHeightScale(at(80))).toBeCloseTo(treeTrunkHeightScale(at(40)), 6);
  });

  it('товщина ВІДСТАЄ від висоти замолоду', () => {
    /*
     * Росток — тонкий прутик, а не мініатюра дорослого дерева. Саме це
     * відставання дає власникову послідовність «третій рік стовбур
     * грубшає, четвертий грубшає ще»: товщина набирається тоді, коли
     * висота вже сповільнилась.
     */
    for (const years of [1, 2, 3, 5]) {
      expect(treeTrunkRadiusScale(at(years)), `рік ${years}`)
        .toBeLessThan(treeTrunkHeightScale(at(years)));
    }
  });

  it('товщина доганяє висоту під кінець', () => {
    const gapEarly = treeTrunkHeightScale(at(3)) - treeTrunkRadiusScale(at(3));
    const gapLate = treeTrunkHeightScale(at(30)) - treeTrunkRadiusScale(at(30));
    expect(gapLate).toBeLessThan(gapEarly);
  });

  it('крони в ростка немає, а на третьому році вона вже є', () => {
    /*
     * Власник назвав саме третій рік роком гілок. До нього крона майже
     * нульова — не тому, що так гарніше, а тому що в ростка її немає.
     */
    expect(treeCrownScale(at(1))).toBeLessThan(0.1);
    expect(treeCrownScale(at(3))).toBeGreaterThan(treeCrownScale(at(1)) * 1.5);
    expect(treeCrownScale(at(5))).toBeGreaterThan(treeCrownScale(at(3)));
  });

  it('нуль днів і сміття не ламають закону', () => {
    expect(treeTrunkHeightScale(0)).toBeGreaterThan(0);
    expect(treeAgeProgress(Number.NaN)).toBe(0);
    expect(treeAgeProgress(-500)).toBe(0);
  });
});
