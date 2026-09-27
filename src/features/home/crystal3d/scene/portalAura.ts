import * as THREE from 'three';

// ============================================================
// Аура кристала (ADR-0210).
// ------------------------------------------------------------
// На еталоні власника кристал СВІТИТЬ у небо: навколо нього рожеве
// марево, ширше за сам кристал. Кільце (ADR-0168) — це лінія, bloom
// (ADR-0173) підхоплює лише пікселі понад 0.92, а наш кристал
// навмисно не пересвічений — тож марева не було ні на `high`, ні нижче.
//
// Аура — це НЕ матеріал кристала (той належить рушію) і НЕ повноекранний
// прохід. Це одна площина за кристалом, намальована додаванням і
// перевіркою глибини: де кристал стоїть попереду, вона схована, тож
// світло лягає НАВКОЛО нього, а не на грані, які мусять лишитись
// розрізненими (навичка «crystal look»: константа поверх усіх граней
// з'їдає їхню різницю).
// ============================================================

/** Бік квадратної текстури аури. Градієнт гладкий — більше не треба. */
export const PORTAL_AURA_SIZE = 64;

/**
 * Яскравість аури на відстані `r` від центру (0 — центр, 1 — край).
 *
 * Спад квадратичний і доходить РІВНО до нуля на краю: інакше квадрат
 * площини проступив би в небі прямокутником.
 */
export function portalAuraFalloff(r: number): number {
  if (!(r < 1)) return 0;
  const t = 1 - Math.max(0, r);
  return t * t * (0.35 + 0.65 * t);
}

/** Пікселі аури: RGB білий, уся форма — в альфі. Чиста функція. */
export function portalAuraPixels(size: number = PORTAL_AURA_SIZE): Uint8Array {
  const data = new Uint8Array(size * size * 4);
  const half = (size - 1) / 2;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const r = Math.hypot(x - half, y - half) / half;
      const i = (y * size + x) * 4;
      data[i] = 255;
      data[i + 1] = 255;
      data[i + 2] = 255;
      data[i + 3] = Math.round(portalAuraFalloff(r) * 255);
    }
  }
  return data;
}

let cached: THREE.DataTexture | null = null;

/** Одна текстура на застосунок: вона несе лише форму, колір дає палітра. */
export function portalAuraTexture(): THREE.DataTexture {
  if (cached !== null) return cached;
  const texture = new THREE.DataTexture(
    portalAuraPixels(),
    PORTAL_AURA_SIZE,
    PORTAL_AURA_SIZE,
    THREE.RGBAFormat,
  );
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  cached = texture;
  return texture;
}
