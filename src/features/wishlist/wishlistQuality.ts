import { resolveCrystalRendererQuality } from '@/engine/renderer';
import type { WishSphereQuality } from './wishSphereField';

/**
 * Профіль пристрою для вішліста.
 *
 * Той самий, за яким живе решта світу (`resolveCrystalRendererQuality`), і це
 * не збіг: §19 просить інтегруватись у наявну систему якості, а не заводити
 * другу відповідь на те саме питання про пристрій.
 *
 * Живе окремо від компонента, бо відповідь потрібна двом місцям і з різних
 * причин: сфери виводять із неї стелю на кількість, а сторінка — чи класти на
 * фон розмиття. Друга копія цього читання розійшлася б із першою на першій же
 * правці.
 */
export function readWishlistQuality(): WishSphereQuality {
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
