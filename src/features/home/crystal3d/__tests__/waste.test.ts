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


describe('історія заднім числом — подія пари не сміє бути невидимою', () => {
  // РЕГРЕСІЯ. Форма даних, на якій кристал ламався в житті: стосункам
  // 1308 днів, а всі записи внесені за останні 40 (`backfilled`). Король
  // росте від ВІКУ СТОСУНКІВ, кожне дата-тіло — від власного свіжого
  // запису, і композиція потім ще потовщує короля (`massive` ×1.35,
  // старіння ×1.15) вже ПІСЛЯ того, як розміри дітей пораховані.
  //
  // Наслідок був виміряний на реальних даних: 48 відкладених тіл → 14
  // порожніх після зрізу, і 17 із 34 видимих коротші за радіус короля.
  // Пара бачила моноліт і жменьку крихт замість власної історії.
  //
  // Лікує `escapeHostPass` у growthEngine — прохід ПІСЛЯ композиції.
  it('дата-тіла не тонуть у королі при backfilled-історії', () => {
    for (const seed of SEEDS) {
      const { branches, material } = buildBranches(seed, 'backfilled');
      const p = publishCrystal(branches, material);
      // Поховань тут БІЛЬШЕ, ніж у решти форм (виміряно 17.8–30.6% проти
      // ≤20%), і це визнано, а не приховано: у backfilled-історії висока
      // мачта короля стоїть над щільною молодою спідницею, тож частину
      // тіл композиція ховає одне в одному. Прохід виходу лікує не це, а
      // головне — видимість тих, хто ВИЖИВ (див. другу перевірку нижче).
      const hiddenShare = (p.bodies.length - p.renderable.length) / p.bodies.length;
      expect(
        hiddenShare,
        `${seed}: похованих ${p.bodies.length - p.renderable.length}/${p.bodies.length}`,
      ).toBeLessThanOrEqual(0.35);

      // ГОЛОВНА перевірка фази. «Видиме» не означає «помітне»: тіло,
      // коротше за радіус короля, читається як крихта. До проходу таких
      // було 17 із 34 (половина видимої маси!); стало 1–5 із 34–40, тобто
      // 2.7–12.5%. Поріг 0.25 лишає запас, але не пропустить повернення до
      // «моноліт плюс пил».
      const king = p.bodies.find((b) => b.branch.primary);
      if (king === undefined) continue;
      const specks = p.renderable.filter(
        (b) => !b.branch.primary && b.solid.profile.h < king.solid.profile.r,
      ).length;
      expect(
        specks / p.renderable.length,
        `${seed}: крихт ${specks}/${p.renderable.length}`,
      ).toBeLessThanOrEqual(0.25);
    }
  });
});
