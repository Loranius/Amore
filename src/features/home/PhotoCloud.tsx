// ============================================================
// PhotoCloud — левітуюча полароїд-хмарка навколо лічильника (порт photos.js)
// ------------------------------------------------------------
// 6 випадкових фото без повторів; тап по фото — заміна на наступне
// з колоди (теж без повторів, поки не показали весь пул). Левітація —
// CSS-анімація; заміна — плавний scale+fade.
// ============================================================
import { useEffect, useMemo, useState } from 'react';
import { usePhotoPool } from './useHome';

const SLOTS = 6;

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

export function PhotoCloud() {
  const { data: pool = [] } = usePhotoPool();
  const [slots, setSlots] = useState<(string | null)[]>(Array(SLOTS).fill(null));

  // Первинне заповнення слотів, коли приходить пул.
  useEffect(() => {
    if (!pool.length) return;
    const picks = shuffle(pool);
    const filled: (string | null)[] = [];
    for (let i = 0; i < SLOTS; i++) filled.push(picks[i % picks.length] ?? null);
    setSlots(filled);
  }, [pool]);

  const canSwap = pool.length > SLOTS;

  const swap = (idx: number) => {
    if (!canSwap) return;
    setSlots((prev) => {
      const shown = new Set(prev.filter(Boolean) as string[]);
      const candidate = shuffle(pool).find((u) => !shown.has(u));
      if (!candidate) return prev;
      const next = [...prev];
      next[idx] = candidate;
      return next;
    });
  };

  // Псевдовипадкові, але стабільні позиції/затримки левітації по слотах.
  const decor = useMemo(
    () =>
      Array.from({ length: SLOTS }, (_, i) => ({
        delay: (i * 0.7).toFixed(2),
        rotate: (i % 2 === 0 ? -1 : 1) * (4 + (i % 3) * 3),
      })),
    [],
  );

  return (
    <div className="photo-cloud" aria-hidden={!pool.length}>
      {slots.map((src, i) => (
        <div
          key={i}
          className={`float-photo float-photo--${i}`}
          style={{
            animationDelay: `${decor[i]!.delay}s`,
            ['--rot' as string]: `${decor[i]!.rotate}deg`,
            opacity: src ? 1 : 0,
          }}
          onClick={() => swap(i)}
        >
          {src && <img src={src} alt="" loading="eager" draggable={false} />}
        </div>
      ))}
    </div>
  );
}
