// ============================================================
// PortalDecor — декоративний фон auth-екрану (серця/квіти/торти/
// хвильки) з парал акс-ефектом за курсором миші.
// ------------------------------------------------------------
// Дані (позиції/кольори/тайминги) портовані 1:1 з дизайн-хендофу
// «Pink Portal» (Amore Portal.dc.html). Суто декоративно — aria-hidden,
// pointer-events:none (крім самих фігур — лишаємо easter-egg hover).
// ============================================================
import { useEffect, useState } from 'react';

interface Heart {
  x: number; y: number; size: number; rot: number; dur: number; delay: number; color: string;
}
interface Flower {
  x: number; y: number; size: number; rot: number; dur: number; delay: number;
  petalColor: string; centerColor: string;
}
interface Cake {
  x: number; y: number; size: number; rot: number; dur: number; delay: number;
}
interface Squiggle {
  x: number; y: number; size: number; dur: number; delay: number; color: string; dots: number[];
}

const HEARTS: Heart[] = [
  { x: 6, y: 12, size: 26, rot: -45, dur: 6, delay: 0, color: '#f2a6bb' },
  { x: 89, y: 8, size: 20, rot: -38, dur: 7, delay: 1, color: '#f6b8c8' },
  { x: 3, y: 60, size: 18, rot: -52, dur: 8, delay: 2, color: '#eb8fab' },
  { x: 93, y: 56, size: 24, rot: -40, dur: 6.5, delay: 0.5, color: '#f2a6bb' },
  { x: 9, y: 87, size: 22, rot: -48, dur: 7.5, delay: 1.5, color: '#eb8fab' },
  { x: 85, y: 90, size: 16, rot: -36, dur: 6, delay: 2.5, color: '#f6b8c8' },
];

const FLOWERS: Flower[] = [
  { x: 16, y: 30, size: 34, rot: 0, dur: 9, delay: 0, petalColor: '#f7c9d8', centerColor: '#e8a2ba' },
  { x: 82, y: 26, size: 30, rot: 20, dur: 10, delay: 1, petalColor: '#f3d9e6', centerColor: '#e8a2ba' },
  { x: 13, y: 74, size: 28, rot: -15, dur: 8, delay: 2, petalColor: '#f7c9d8', centerColor: '#e8a2ba' },
  { x: 85, y: 70, size: 32, rot: 10, dur: 9.5, delay: 0.8, petalColor: '#f3d9e6', centerColor: '#e8a2ba' },
];

const CAKES: Cake[] = [
  { x: 4, y: 38, size: 42, rot: -6, dur: 7, delay: 0.3 },
  { x: 90, y: 40, size: 38, rot: 8, dur: 8, delay: 1.2 },
  { x: 46, y: 4, size: 30, rot: 0, dur: 6.5, delay: 0.6 },
];

const SQUIGGLES: Squiggle[] = [
  { x: 22, y: 6, size: 6, dur: 5, delay: 0, color: '#f0b6c8', dots: [0, -6, 0, 6, 0] },
  { x: 74, y: 94, size: 6, dur: 6, delay: 1, color: '#eec0d3', dots: [0, -6, 0, 6, 0] },
  { x: 2, y: 26, size: 5, dur: 5.5, delay: 0.4, color: '#f0b6c8', dots: [0, -5, 0, 5, 0] },
];

const PETAL_ANGLES = [0, 72, 144, 216, 288];

/** Нормалізована позиція курсора відносно центру вікна, у [-1, 1]. */
function useMouseParallax(enabled: boolean) {
  const [pos, setPos] = useState({ mx: 0, my: 0 });

  useEffect(() => {
    if (!enabled) return;
    const onMove = (e: MouseEvent) => {
      setPos({
        mx: (e.clientX / window.innerWidth - 0.5) * 2,
        my: (e.clientY / window.innerHeight - 0.5) * 2,
      });
    };
    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, [enabled]);

  return pos;
}

export function PortalDecor() {
  const reduceMotion =
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const { mx, my } = useMouseParallax(!reduceMotion);

  return (
    <div
      className="portal-decor"
      aria-hidden="true"
      style={{ transform: `translate(${mx * 14}px, ${my * 10}px)` }}
    >
      {HEARTS.map((h, i) => (
        <div
          key={i}
          className="portal-heart"
          style={{
            left: `${h.x}%`,
            top: `${h.y}%`,
            background: h.color,
            ['--size' as string]: `${h.size}px`,
            ['--r' as string]: `${h.rot}deg`,
            ['--dur' as string]: `${h.dur}s`,
            ['--delay' as string]: `${h.delay}s`,
          }}
        />
      ))}

      {FLOWERS.map((f, i) => (
        <div
          key={i}
          className="portal-flower"
          style={{
            left: `${f.x}%`,
            top: `${f.y}%`,
            ['--size' as string]: `${f.size}px`,
            ['--r' as string]: `${f.rot}deg`,
            ['--dur' as string]: `${f.dur}s`,
            ['--delay' as string]: `${f.delay}s`,
          }}
        >
          {PETAL_ANGLES.map((ang) => (
            <div
              key={ang}
              className="portal-flower-petal"
              style={{ background: f.petalColor, transform: `rotate(${ang}deg) translate(0,-58%)` }}
            />
          ))}
          <div className="portal-flower-center" style={{ background: f.centerColor }} />
        </div>
      ))}

      {CAKES.map((c, i) => (
        <div
          key={i}
          className="portal-cake"
          style={{
            left: `${c.x}%`,
            top: `${c.y}%`,
            ['--size' as string]: `${c.size}px`,
            ['--r' as string]: `${c.rot}deg`,
            ['--dur' as string]: `${c.dur}s`,
            ['--delay' as string]: `${c.delay}s`,
          }}
        >
          <div className="portal-cake-base" />
          <div className="portal-cake-top" />
          <div className="portal-cake-candle" />
          <div className="portal-cake-flame" />
        </div>
      ))}

      {SQUIGGLES.map((sq, i) => (
        <div
          key={i}
          className="portal-squiggle"
          style={{
            left: `${sq.x}%`,
            top: `${sq.y}%`,
            ['--dur' as string]: `${sq.dur}s`,
            ['--delay' as string]: `${sq.delay}s`,
          }}
        >
          {sq.dots.map((d, j) => (
            <div
              key={j}
              className="portal-squiggle-dot"
              style={{
                ['--size' as string]: `${sq.size}px`,
                ['--dot-color' as string]: sq.color,
                transform: `translateY(${d}px)`,
              }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
