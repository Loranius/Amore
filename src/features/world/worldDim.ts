import { useEffect } from 'react';
import { resolveCrystalRendererQuality } from '@/engine/renderer';

// ============================================================
// Модуль відсуває світ назад.
// ------------------------------------------------------------
// Приглушення й розмиття фону першим отримав вішліст (ADR-0028 §4, §7), і воно
// одразу знадобилось другому модулю. Тому маркер тут спільний: правило, яке
// торкається спільної сцени, мусить бути одне — інакше два модулі почнуть
// розходитись у тому, наскільки саме приглушений той самий кристал.
//
// Маркер ставиться на корінь документа, а не в сцену: жоден параметр рушія не
// змінюється, і головна лишається такою, якою була.
// ============================================================

export type WorldQuality = 'high' | 'balanced' | 'low' | 'fallback';

/**
 * Профіль пристрою для модулів світу.
 *
 * Той самий, за яким живе решта світу: §19 просить інтегруватись у наявну
 * систему якості, а не заводити другу відповідь на те саме питання.
 */
export function readWorldQuality(): WorldQuality {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return 'low';
  const extended = navigator as Navigator & { deviceMemory?: number };
  return resolveCrystalRendererQuality({
    webgl: true,
    webgl2: typeof WebGL2RenderingContext !== 'undefined',
    deviceMemoryGb: typeof extended.deviceMemory === 'number' ? extended.deviceMemory : null,
    hardwareConcurrency: Number.isFinite(navigator.hardwareConcurrency)
      ? navigator.hardwareConcurrency
      : null,
    devicePixelRatio: window.devicePixelRatio,
  });
}

/**
 * Поки модуль відкритий — сцена приглушена й розмита.
 *
 * Профіль пристрою їде разом із маркером: розмиття повноекранного анімованого
 * полотна браузер перераховує щокадру, тож на слабкому пристрої його немає, і
 * вирішує це CSS, а не React.
 */
export function useDimmedWorld(active: boolean): void {
  useEffect(() => {
    if (!active || typeof document === 'undefined') return;
    const root = document.documentElement;
    root.setAttribute('data-world-scene', 'dim');
    root.setAttribute('data-world-quality', readWorldQuality());
    return () => {
      root.removeAttribute('data-world-scene');
      root.removeAttribute('data-world-quality');
    };
  }, [active]);
}
