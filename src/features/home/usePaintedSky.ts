import { useEffect, useState } from 'react';

// ============================================================
// Намальоване небо як адреса картинки для CSS-шару (ADR-0210).
// ------------------------------------------------------------
// ЧОМУ CSS, А НЕ `scene.background`. Небо порталу — шар під прозорим
// полотном; у сцену воно йде лише з експериментальним заломленням
// (ADR-0178). Картинка в CSS отримує `background-size: cover` задарма,
// тобто однаково лягає на телефон і на широкий екран без розтягу.
//
// КЕШ НА РІВНІ МОДУЛЯ. Небо однакове для теми, а світ переживає маршрут
// (ADR-0020); малювати його вдруге на кожен повернення на головну не
// має сенсу.
// ============================================================

type Theme = 'light' | 'dark';

const cache = new Map<Theme, string>();
const pending = new Map<Theme, Promise<string | null>>();

function paint(theme: Theme): Promise<string | null> {
  const known = cache.get(theme);
  if (known !== undefined) return Promise.resolve(known);
  const running = pending.get(theme);
  if (running !== undefined) return running;

  const job = new Promise<string | null>((resolve) => {
    if (typeof Worker === 'undefined' || typeof document === 'undefined') {
      resolve(null);
      return;
    }
    let worker: Worker;
    try {
      worker = new Worker(new URL('./paintedSky.worker.ts', import.meta.url), { type: 'module' });
    } catch (error) {
      // Без воркера лишається градієнт — і це не мовчанка: причина в консолі.
      console.warn('painted sky: worker unavailable, gradient stays', error);
      resolve(null);
      return;
    }
    worker.onmessage = (event: MessageEvent<{ width: number; height: number; pixels: Uint8Array }>) => {
      worker.terminate();
      const { width, height, pixels } = event.data;
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d');
      if (context === null) {
        console.warn('painted sky: 2d context unavailable, gradient stays');
        resolve(null);
        return;
      }
      context.putImageData(new ImageData(new Uint8ClampedArray(pixels.buffer as ArrayBuffer), width, height), 0, 0);
      canvas.toBlob((blob) => {
        if (blob === null) {
          console.warn('painted sky: encoding failed, gradient stays');
          resolve(null);
          return;
        }
        const url = URL.createObjectURL(blob);
        cache.set(theme, url);
        resolve(url);
      }, 'image/png');
    };
    worker.onerror = (error) => {
      worker.terminate();
      console.warn('painted sky: worker failed, gradient stays', error);
      resolve(null);
    };
    worker.postMessage(theme);
  });
  pending.set(theme, job);
  void job.finally(() => pending.delete(theme));
  return job;
}

/** Адреса намальованого неба теми, або `null`, поки його немає. */
export function usePaintedSky(theme: Theme, enabled: boolean): string | null {
  const [url, setUrl] = useState<string | null>(() => (enabled ? cache.get(theme) ?? null : null));
  useEffect(() => {
    if (!enabled) { setUrl(null); return; }
    let alive = true;
    const known = cache.get(theme);
    if (known !== undefined) { setUrl(known); return; }
    setUrl(null);
    void paint(theme).then((next) => { if (alive) setUrl(next); });
    return () => { alive = false; };
  }, [theme, enabled]);
  return url;
}
