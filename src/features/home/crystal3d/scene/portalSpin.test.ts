import { describe, expect, it } from 'vitest';
import {
  FLICK_MAX_TRAVEL,
  FLICK_SNAP,
  FLICK_SPEED,
  PORTAL_SPIN_REST,
  portalSpinDrag,
  portalSpinGrab,
  portalSpinLanding,
  portalSpinRelease,
  portalSpinReleaseVelocity,
  portalSpinStep,
  type PortalSpinState,
} from './portalSpin';

// ============================================================
// Поворот сцени рукою (ADR-0211).
// ------------------------------------------------------------
// ВИМОГА ВЛАСНИКА: «обертання відбувається ривками, зроби його більш
// плавним і ніжним з автодоводкою після обертання, якщо відбувся один
// різкий свайп». Кожен тест нижче тримає одну частину цього речення.
// Час — аргумент, годинника немає: усе детерміноване.
// ============================================================

/** Жест: торкання, `moves` рівних кроків по `step` рад кожні `every` с, відпускання. */
function swipe(step: number, moves: number, every: number, releaseAfter = every): { state: PortalSpinState; end: number } {
  let state = portalSpinGrab(PORTAL_SPIN_REST, 0);
  let now = 0;
  for (let index = 0; index < moves; index += 1) {
    now += every;
    state = portalSpinDrag(state, now, step, 0);
    state = portalSpinStep(state, now);
  }
  now += releaseAfter;
  state = portalSpinStep(state, now);
  state = portalSpinRelease(state, now);
  return { state, end: now };
}

/** Прокрутити час кроком `dt` і зібрати видимі кути. */
function run(state: PortalSpinState, from: number, seconds: number, dt: number): { state: PortalSpinState; angles: number[] } {
  const angles: number[] = [];
  let current = state;
  for (let now = from + dt; now <= from + seconds + 1e-9; now += dt) {
    current = portalSpinStep(current, now);
    angles.push(current.azimuth);
  }
  return { state: current, angles };
}

describe('плавно: рух іде за часом, а не за кадрами', () => {
  it('однаковий шлях за однаковий час на 30 і на 120 кадрах', () => {
    // Саме це ламало `OrbitControls`: згасання на кадр робило телефон на
    // 30 кадрах удвічі «важчим» і смиканим.
    let slow = portalSpinGrab(PORTAL_SPIN_REST, 0);
    slow = portalSpinDrag(slow, 0.001, 1, 0);
    let fast = slow;
    for (let now = 1 / 30; now <= 0.2 + 1e-9; now += 1 / 30) slow = portalSpinStep(slow, now);
    for (let now = 1 / 120; now <= 0.2 + 1e-9; now += 1 / 120) fast = portalSpinStep(fast, now);
    expect(Math.abs(slow.azimuth - fast.azimuth)).toBeLessThan(0.01);
  });

  it('пачка подій за один кадр не дає стрибка: видимий кут наздоганяє, а не телепортується', () => {
    let state = portalSpinGrab(PORTAL_SPIN_REST, 0);
    // Три події між двома кадрами — так телефон і доставляє дотик.
    state = portalSpinDrag(state, 0.010, 0.1, 0);
    state = portalSpinDrag(state, 0.011, 0.1, 0);
    state = portalSpinDrag(state, 0.012, 0.1, 0);
    state = portalSpinStep(state, 1 / 60);
    expect(state.azimuth).toBeGreaterThan(0);
    expect(state.azimuth).toBeLessThan(0.3 * 0.25);
  });
});

describe('ніжно: відпускання не обриває рух', () => {
  it('після відпускання острів допливає в тому ж напрямку, без ривка назад', () => {
    const { state, end } = swipe(0.02, 8, 1 / 60);
    const { angles } = run(state, end, 1.2, 1 / 60);
    let previous = state.azimuth;
    for (const angle of angles) {
      expect(angle).toBeGreaterThanOrEqual(previous - 1e-9);
      previous = angle;
    }
  });

  it('палець, що зупинився перед відпусканням, не кидає острів', () => {
    const { state, end } = swipe(0.02, 8, 1 / 60, 0.25);
    expect(state.glide?.flick ?? false).toBe(false);
    const { state: after } = run(state, end, 1, 1 / 60);
    expect(Math.abs(after.azimuth - state.azimuthTarget)).toBeLessThan(0.01);
  });
});

describe('автодоводка після одного різкого свайпу', () => {
  it('різкий свайп несе далі й лягає рівно на восьму оберту', () => {
    // 0.12 рад за 1/60 с — це 7.2 рад/с, удвічі понад поріг.
    const { state, end } = swipe(0.12, 6, 1 / 60);
    expect(state.glide?.flick).toBe(true);
    // Спокій за ~2.5 с: ω = |v| / шлях, тож довгий доплив іде повільніше.
    const { state: after } = run(state, end, 4, 1 / 60);
    expect(after.glide).toBeNull();
    const steps = after.azimuth / FLICK_SNAP;
    expect(Math.abs(steps - Math.round(steps))).toBeLessThan(1e-6);
    // Далі, ніж пройшов палець, і в той самий бік.
    expect(after.azimuth).toBeGreaterThan(state.azimuthTarget);
  });

  it('доводка без перельоту: кут іде до цілі монотонно', () => {
    const { state, end } = swipe(0.12, 6, 1 / 60);
    const goal = state.glide!.goal;
    const { angles } = run(state, end, 3, 1 / 120);
    for (const angle of angles) expect(angle).toBeLessThanOrEqual(goal + 1e-6);
    let previous = -Infinity;
    for (const angle of angles) {
      expect(angle).toBeGreaterThanOrEqual(previous - 1e-9);
      previous = angle;
    }
  });

  it('стартує зі швидкістю пальця — на відпусканні немає поштовху', () => {
    const { state, end } = swipe(0.12, 6, 1 / 60);
    const dt = 1 / 240;
    const next = portalSpinStep(state, end + dt);
    const glideSpeed = (next.azimuth - state.azimuth) / dt;
    expect(glideSpeed / (0.12 * 60)).toBeGreaterThan(0.75);
    expect(glideSpeed / (0.12 * 60)).toBeLessThan(1.25);
  });

  it('навіть найрізкіший свайп не крутить острів дзигою: не більше пів оберту + крок', () => {
    const landing = portalSpinLanding(0, 400);
    expect(landing.flick).toBe(true);
    expect(landing.goal).toBeLessThanOrEqual(FLICK_MAX_TRAVEL + FLICK_SNAP);
  });

  it('доводка ніколи не розвертає проти свайпу', () => {
    for (const from of [0, 0.1, 0.39, 0.4, 0.78, -0.3]) {
      for (const velocity of [FLICK_SPEED, -FLICK_SPEED, 6, -6]) {
        const { goal } = portalSpinLanding(from, velocity);
        expect((goal - from) * Math.sign(velocity)).toBeGreaterThan(0);
      }
    }
  });

  it('повільний свайп не доводиться: острів стає там, де його лишили', () => {
    expect(portalSpinLanding(0.3, FLICK_SPEED * 0.5).flick).toBe(false);
  });
});

describe('рука ловить острів', () => {
  it('торкання під час допливання зупиняє острів там, де він є', () => {
    const { state, end } = swipe(0.12, 6, 1 / 60);
    const { state: mid } = run(state, end, 0.1, 1 / 60);
    const caught = portalSpinGrab(mid, end + 0.1);
    expect(caught.glide).toBeNull();
    expect(caught.azimuthTarget).toBeCloseTo(mid.azimuth, 6);
    const later = portalSpinStep(caught, end + 0.5);
    expect(later.azimuth).toBeCloseTo(mid.azimuth, 6);
  });

  it('скасований жест (другий палець) відпускає без інерції', () => {
    let state = portalSpinGrab(PORTAL_SPIN_REST, 0);
    for (let index = 1; index <= 6; index += 1) state = portalSpinDrag(state, index / 60, 0.12, 0);
    expect(portalSpinReleaseVelocity(state, 0.1)).toBeGreaterThan(FLICK_SPEED);
    const released = portalSpinRelease(state, 0.1, { cancelled: true });
    expect(released.glide?.flick ?? false).toBe(false);
  });

  it('зменшений рух (§47): жодної інерції, кут стає під пальцем', () => {
    let state = portalSpinGrab(PORTAL_SPIN_REST, 0);
    for (let index = 1; index <= 6; index += 1) state = portalSpinDrag(state, index / 60, 0.12, 0);
    const released = portalSpinRelease(state, 0.1, { reduceMotion: true });
    expect(released.glide).toBeNull();
    expect(released.azimuth).toBeCloseTo(0.72, 9);
  });

  it('підйом тримається меж, які дає викликач', () => {
    let state = portalSpinGrab(PORTAL_SPIN_REST, 0);
    state = portalSpinDrag(state, 0.01, 0, 5, [-0.1, 0.4]);
    expect(state.elevationTarget).toBe(0.4);
    state = portalSpinDrag(state, 0.02, 0, -9, [-0.1, 0.4]);
    expect(state.elevationTarget).toBe(-0.1);
  });
});
