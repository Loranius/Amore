import { describe, expect, it } from 'vitest';
import {
  PORTAL_ORBIT_DAMPING,
  PORTAL_ORBIT_ROTATE_SPEED,
  PORTAL_ORBIT_TOUCH_ROTATE_SPEED,
  coarsePointerNow,
  orbitCatchUp,
  portalOrbitRotateSpeed,
} from './portalOrbit';

describe('кристал устигає за пальцем', () => {
  it('за шість кадрів проходить більшу частину жесту', () => {
    /*
     * Шість кадрів — це 200 мс на тридцяти кадрах, які дає телефон під
     * цією сценою. Колишні 0.08 давали за них 39%: палець уже стояв, а
     * кристал ще їхав. Саме це власник назвав «повільним і важким».
     */
    expect(orbitCatchUp(PORTAL_ORBIT_DAMPING, 6)).toBeGreaterThan(0.75);
    expect(orbitCatchUp(0.08, 6)).toBeLessThan(0.45);
  });

  it('перший кадр уже помітний', () => {
    // Рух має починатись ОДРАЗУ: затримка на перший кадр читається
    // залипанням, хоч би яким швидким був подальший рух.
    expect(orbitCatchUp(PORTAL_ORBIT_DAMPING, 1)).toBeGreaterThan(0.2);
  });

  it('інерція лишається — це не миттєвий стрибок', () => {
    /*
     * Межа з іншого боку. Одиниця прибрала б згасання зовсім, і рух
     * почав би смикатись на кожному пропущеному кадрі; на телефоні
     * пропущені кадри є завжди.
     */
    expect(PORTAL_ORBIT_DAMPING).toBeLessThan(0.4);
    expect(orbitCatchUp(PORTAL_ORBIT_DAMPING, 1)).toBeLessThan(0.5);
  });

  it('дотик крутить швидше за мишу', () => {
    /*
     * `OrbitControls` міряє поворот у частках ВИСОТИ полотна. На
     * телефоні полотно високе й вузьке, тож той самий жест через увесь
     * екран дає менший поворот, ніж на широкому. Компенсується це
     * швидкістю саме для дотику.
     */
    expect(PORTAL_ORBIT_TOUCH_ROTATE_SPEED).toBeGreaterThan(PORTAL_ORBIT_ROTATE_SPEED);
    // І не вдвічі: удвічі — це вже некерований зрив.
    expect(PORTAL_ORBIT_TOUCH_ROTATE_SPEED).toBeLessThan(PORTAL_ORBIT_ROTATE_SPEED * 2);
  });

  it('формула згасання поводиться як належить', () => {
    expect(orbitCatchUp(0.26, 0)).toBe(0);
    expect(orbitCatchUp(1, 1)).toBe(1);
    expect(orbitCatchUp(0.26, 40)).toBeGreaterThan(0.99);
  });

  it('палець крутить швидше за мишу в обох режимах', () => {
    expect(portalOrbitRotateSpeed(true, false))
      .toBeGreaterThan(portalOrbitRotateSpeed(false, false));
    expect(portalOrbitRotateSpeed(true, true))
      .toBeGreaterThan(portalOrbitRotateSpeed(false, true));
  });

  it('вільна камера скрізь спокійніша', () => {
    // Там жест веде саму камеру, а не крутить предмет: різкість
    // читається зривом.
    expect(portalOrbitRotateSpeed(true, true)).toBeLessThan(portalOrbitRotateSpeed(true, false));
    expect(portalOrbitRotateSpeed(false, true)).toBeLessThan(portalOrbitRotateSpeed(false, false));
  });

  it('поза браузером пальця немає', () => {
    // Гак кличеться й на сервері, і в тестах: там `matchMedia` немає, і
    // вигадувати за нього відповідь не можна.
    expect(coarsePointerNow()).toBe(false);
  });
});
