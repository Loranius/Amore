import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  FAREWELL_RUN,
  FAREWELL_STAGGER,
  wishSphereFarewellPlan,
} from './wishSphereFarewell';
import { ENTRANCE_STAGGER } from './wishSphereEntrance';

// ============================================================
// Прощання: кулі йдуть далі, а не зникають.
// ------------------------------------------------------------
// Вимога власника: «нехай вони продовжують рух в ліву сторону екрану».
// Перевіряється те, що вирішує, чи це один наскрізний рух, чи анімація задом
// наперед: куди летіти, коли рушає кожна й скільки жити шару. Саме тут
// помилка непомітна — зайвий кадр шар просто висить порожній, а на кадр
// менший обриває виліт на півдорозі.
// ============================================================

const FIELD = { count: 7, fieldWidth: 380, widest: 95 };

describe('the wishes leave to the left', () => {
  it('flies far enough to clear the edge completely', () => {
    // Не «за край поля», а за край РАЗОМ із власним розміром: інакше на
    // повільному кадрі видно, як половина кулі зникає посеред екрана.
    const plan = wishSphereFarewellPlan(FIELD);
    expect(plan.awayX).toBeLessThanOrEqual(-(FIELD.fieldWidth + FIELD.widest));
  });

  it('leaves in the same direction it arrived from', () => {
    // Кулі входять справа. Вихід ліворуч — це продовження руху; вихід праворуч
    // був би поверненням, тобто входом задом наперед.
    expect(wishSphereFarewellPlan(FIELD).awayX).toBeLessThan(0);
  });

  it('leaves faster than it arrives', () => {
    // Прощання не має затримувати перехід між модулями: воно коротше за
    // політ появи й іде щільнішою чергою.
    expect(FAREWELL_RUN).toBeLessThan(1000);
    expect(FAREWELL_STAGGER).toBeLessThan(ENTRANCE_STAGGER);
  });

  it('keeps the layer alive exactly as long as the last sphere needs', () => {
    const plan = wishSphereFarewellPlan(FIELD);
    const lastStarts = plan.delayFor(FIELD.count - 1);
    expect(plan.life).toBeGreaterThanOrEqual(lastStarts + FAREWELL_RUN);
    // І не набагато довше: шар, що переживає власну анімацію, — це прозорий
    // прямокутник поверх наступного модуля.
    expect(plan.life).toBeLessThan(lastStarts + FAREWELL_RUN + 200);
  });

  it('staggers, so it reads as a flow and not as one sheet sliding off', () => {
    const plan = wishSphereFarewellPlan(FIELD);
    expect(plan.delayFor(0)).toBe(0);
    expect(plan.delayFor(3)).toBe(3 * FAREWELL_STAGGER);
    // Черга мусить скінчитись, поки перша ще летить: інакше це не потік.
    expect(plan.delayFor(FIELD.count - 1)).toBeLessThan(FAREWELL_RUN);
  });

  it('asks for no layer at all when there is nothing to say goodbye to', () => {
    expect(wishSphereFarewellPlan({ ...FIELD, count: 0 }).life).toBe(0);
  });

  it('survives nonsense instead of leaving a layer on screen forever', () => {
    const plan = wishSphereFarewellPlan({
      count: Number.NaN,
      fieldWidth: Number.NaN,
      widest: Number.POSITIVE_INFINITY,
    });
    expect(Number.isFinite(plan.awayX)).toBe(true);
    expect(Number.isFinite(plan.life)).toBe(true);
    expect(Number.isFinite(plan.delayFor(Number.NaN))).toBe(true);
  });

  it('is the CSS that carries it leftward, on the wrapper and not on the ball', () => {
    // Дві речі, які тримає саме файл стилів, і обидві ламаються тихо.
    //
    // По-перше, напрямок: у кадрі вильоту зсув мусить бути змінною, яку
    // рахує план, а не числом, дописаним у стилі, — інакше правка плану нічого
    // не змінить.
    //
    // По-друге, поверх: політ живе на обгортці, бо в самої кулі власний
    // `transform` із її місцем у сузір'ї. Постав анімацію на кулю — і вона
    // полетить не звідти, де стояла, а з нуля координат.
    const css = readFileSync(join(__dirname, 'wishlistSpheres.css'), 'utf8');
    const frames = /@keyframes wl-sphere-away \{([\s\S]*?)\n\}/.exec(css)?.[1] ?? '';
    const destination = /to \{([^}]*)\}/.exec(frames)?.[1] ?? '';
    expect(destination, 'кадр «to» має існувати').not.toBe('');
    expect(destination).toContain('var(--away-x');
    expect(css).toMatch(/\.wl-sphere-farewell__slot \{[^}]*animation:\s*wl-sphere-away/);
  });
});
