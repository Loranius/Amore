// ============================================================
// Марно витрачені тіла (`CAI-REQ-001` volumetric reservation).
// ------------------------------------------------------------
// Тіло, яке після обробки стику не має жодного трикутника, — цілком
// поховане в сусідах. Воно ніколи не буде видиме, але займає місце в
// бюджеті `TOTAL_BODY_CAP` і в кожному обчисленні над масою.
//
// Тест на МЕТРИКУ, а не на факт: частка таких тіл виміряна й зафіксована,
// тож регресія повернеться з падінням тесту, а не тихо.
// ============================================================
import { describe, expect, it } from 'vitest';
import { buildBranches, SEEDS } from './fixture';
import { publishCrystal } from '../crystalPublication';
import { isFullyBuried } from '../../artifact/growthSurface';
import { v3 } from '../../artifact/vec3';

/**
 * Виміряна стеля марних тіл. Було **26.2%** доти, доки супутники колонії
 * єдині проходили повз перевірку об'єму (`candidateFits` їх не бачив);
 * стало **15.6%**. Поріг лишає запас на дрейф композиції, але не пропустить
 * повернення до старого стану.
 *
 * Решта — не недогляд: композиція свідомо стягує масу докупи вже ПІСЛЯ
 * відкладення, і частину тіл ховає саме вона. Це `CAI-REQ-003`, який
 * лишається PARTIAL за рішенням, задокументованим у IMPLEMENTATION_STATUS.
 */
const MAX_WASTED_SHARE = 0.2;

describe('`CAI-REQ-001` — тіла не народжуються похованими', () => {
  it('частка повністю схованих тіл лишається під виміряною стелею', () => {
    let hidden = 0;
    let total = 0;
    const perSeed: string[] = [];
    for (const seed of SEEDS) {
      const { branches, material } = buildBranches(seed);
      const p = publishCrystal(branches, material);
      const h = p.bodies.length - p.renderable.length;
      hidden += h;
      total += p.bodies.length;
      perSeed.push(`${seed}=${h}/${p.bodies.length}`);
    }
    expect(hidden / total, perSeed.join(' ')).toBeLessThanOrEqual(MAX_WASTED_SHARE);
  });

  it('перевірка поховання не вакуумна: тіло всередині більшого ловиться', () => {
    const host = { anchor: v3(0, 0, 0), direction: v3(0, 1, 0), length: 1, radius: 0.5 };
    // Крихітне тіло біля осі господаря — поховане.
    expect(isFullyBuried([host], v3(0, 0.1, 0), v3(0, 1, 0), 0.2)).toBe(true);
    // Те саме, але довше за господаря — вістря виходить назовні.
    expect(isFullyBuried([host], v3(0, 0.1, 0), v3(0, 1, 0), 2)).toBe(false);
    // Без перешкод ховати нема чим.
    expect(isFullyBuried([], v3(0, 0, 0), v3(0, 1, 0), 1)).toBe(false);
  });
});
