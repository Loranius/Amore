// ============================================================
// PortalBackdrop — фон головної з відчуттям глибини.
// ------------------------------------------------------------
// Артефакт — справжня 3D-сцена, а стояв він на пласкому градієнті,
// тож простору за ним не читалось. Глибину тут дають чотири підказки
// разом: шари їдуть за вказівником з різною швидкістю (паралакс),
// далекі зорі дрібніші, тьмяніші й трохи розмиті (повітряна
// перспектива), низ підсвічений як горизонт, кути затемнені.
//
// Зорі — детерміновані від couple-seed: у кожної пари своє небо, але
// воно те саме при кожному відкритті, а не тасується на ререндері.
// ============================================================
import { useEffect, useMemo, useRef } from 'react';
import { mulberry32 } from './mulberry32';
import './portalBackdrop.css';

interface StarField {
  /** Готовий CSS background-image зі зір як radial-gradient крапок. */
  image: string;
  size: number;
}

function buildStarField(seed: number, count: number, tile: number, maxRadius: number): StarField {
  const random = mulberry32(seed);
  const stars: string[] = [];

  for (let index = 0; index < count; index += 1) {
    const x = (random() * tile).toFixed(1);
    const y = (random() * tile).toFixed(1);
    const radius = (0.5 + random() * maxRadius).toFixed(2);
    // Розкид яскравості важливіший за кількість: рівномірно яскраві
    // зорі читаються як шум, нерівномірні — як глибина.
    const alpha = (0.25 + random() * 0.75).toFixed(2);
    stars.push(
      `radial-gradient(${radius}px ${radius}px at ${x}px ${y}px, rgba(255,252,255,${alpha}) 0%, rgba(255,252,255,0) 100%)`,
    );
  }

  return { image: stars.join(','), size: tile };
}

/** Наскільки сильно шар реагує на вказівник, у пікселях на пів-екрана. */
const PARALLAX = {
  far: 6,
  near: 16,
} as const;

export function PortalBackdrop({ seed = 1 }: { seed?: number }) {
  const rootRef = useRef<HTMLDivElement>(null);

  const fields = useMemo(() => ({
    far: buildStarField(seed, 90, 420, 0.7),
    near: buildStarField(seed + 977, 34, 380, 1.4),
    motes: buildStarField(seed + 5381, 16, 340, 2.1),
  }), [seed]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    if (typeof window === 'undefined') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    // Дотикові екрани не мають вказівника: там глибину тримає власний
    // дрейф порошинок, а слухач лише марно будив би кадри.
    if (!window.matchMedia('(pointer: fine)').matches) return;

    let frame = 0;
    const onPointerMove = (event: PointerEvent) => {
      if (frame !== 0) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        // -1..1 від центру екрана.
        const dx = (event.clientX / window.innerWidth) * 2 - 1;
        const dy = (event.clientY / window.innerHeight) * 2 - 1;
        root.style.setProperty('--portal-pointer-x', String(dx));
        root.style.setProperty('--portal-pointer-y', String(dy));
      });
    };

    window.addEventListener('pointermove', onPointerMove, { passive: true });
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      if (frame !== 0) window.cancelAnimationFrame(frame);
    };
  }, []);

  const layerTransform = (depth: number): string =>
    `translate3d(calc(var(--portal-pointer-x, 0) * ${-depth}px), calc(var(--portal-pointer-y, 0) * ${-depth}px), 0)`;

  return (
    <div className="portal-backdrop" ref={rootRef} aria-hidden="true">
      <div className="portal-backdrop__layer portal-backdrop__sky" />

      <div
        className="portal-backdrop__layer portal-backdrop__stars portal-backdrop__stars--far"
        style={{
          backgroundImage: fields.far.image,
          backgroundSize: `${fields.far.size}px ${fields.far.size}px`,
          transform: layerTransform(PARALLAX.far),
        }}
      />
      <div
        className="portal-backdrop__layer portal-backdrop__stars"
        style={{
          backgroundImage: fields.near.image,
          backgroundSize: `${fields.near.size}px ${fields.near.size}px`,
          transform: layerTransform(PARALLAX.near),
        }}
      />

      <div className="portal-backdrop__layer portal-backdrop__haze" />

      <div
        className="portal-backdrop__layer portal-backdrop__stars portal-backdrop__motes"
        style={{
          backgroundImage: fields.motes.image,
          backgroundSize: `${fields.motes.size}px ${fields.motes.size}px`,
        }}
      />

      <div className="portal-backdrop__layer portal-backdrop__vignette" />
    </div>
  );
}
