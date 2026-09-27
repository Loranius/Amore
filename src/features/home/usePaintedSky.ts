import { useEffect, useState } from 'react';
import type { PortalSkyShape } from './crystal3d/scene/portalSkyPainting';

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
type Key = `${Theme}:${PortalSkyShape}`;

const cache = new Map<Key, string>();
const pending = new Map<Key, Promise<string | null>>();

function paint(theme: Theme, shape: PortalSkyShape): Promise<string | null> {
  const key: Key = `${theme}:${shape}`;
  const known = cache.get(key);
  if (known !== undefined) return Promise.resolve(known);
  const running = pending.get(key);
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
        cache.set(key, url);
        resolve(url);
      }, 'image/png');
    };
    worker.onerror = (error) => {
      worker.terminate();
      console.warn('painted sky: worker failed, gradient stays', error);
      resolve(null);
    };
    worker.postMessage({ theme, shape });
  });
  pending.set(key, job);
  void job.finally(() => pending.delete(key));
  return job;
}

/**
 * Яке полотно просить екран: альбомний кадр — `wide`, решта — `tall`.
 * Слухає зміну пропорції (поворот планшета, зміна вікна).
 */
export function usePaintedSkyShape(): PortalSkyShape {
  const query = '(min-aspect-ratio: 1/1)';
  const read = (): PortalSkyShape => (
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      && window.matchMedia(query).matches ? 'wide' : 'tall'
  );
  const [shape, setShape] = useState<PortalSkyShape>(read);
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const media = window.matchMedia(query);
    const update = () => setShape(media.matches ? 'wide' : 'tall');
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  return shape;
}

/** Адреса намальованого неба теми й форми, або `null`, поки його немає. */
export function usePaintedSky(theme: Theme, enabled: boolean, shape: PortalSkyShape = 'tall'): string | null {
  const key: Key = `${theme}:${shape}`;
  const [url, setUrl] = useState<string | null>(() => (enabled ? cache.get(key) ?? null : null));
  useEffect(() => {
    if (!enabled) { setUrl(null); return; }
    let alive = true;
    const known = cache.get(key);
    if (known !== undefined) { setUrl(known); return; }
    /*
     * Поки нове полотно малюється, старе лишається: зміна форми вікна не
     * мусить блимати градієнтом.
     */
    void paint(theme, shape).then((next) => { if (alive && next !== null) setUrl(next); });
    return () => { alive = false; };
  }, [theme, shape, enabled, key]);
  return url;
}
