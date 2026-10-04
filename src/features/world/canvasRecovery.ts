import { useCallback, useEffect, useRef, useState } from 'react';

// ============================================================
// Полотно, яке повертається після втрати WebGL-контексту.
// ------------------------------------------------------------
// Власник, 2026-10-04: «оптимізуй роботу сайту під айфони».
//
// iOS Safari забирає WebGL-контекст у сторінки, яку згорнули або яка
// заважає іншим за пам'яттю: перемкнулись у месенджер, заблокували екран,
// відкрили камеру. Three.js на `webglcontextlost` робить `preventDefault()`
// і чекає `webglcontextrestored`. На iOS ця подія часто не приходить зовсім,
// і пара повертається до порожньої сцени, яка вже ніколи не намалюється.
//
// Тут рішення просте й однакове для всіх сцен. Якщо контекст втрачено і за
// `RESTORE_GRACE_MS` він не повернувся сам, полотно монтується заново (новий
// `key`), коли сторінку знову видно. Сцена детермінована з тих самих даних,
// тож нове полотно показує те саме, що й старе. Відновлення, яке встигло
// прийти, нічого не перемонтовує.
// ============================================================

export const RESTORE_GRACE_MS = 1500;

interface VisibleDocument {
  readonly visibilityState: DocumentVisibilityState;
  addEventListener(type: 'visibilitychange', listener: () => void): void;
  removeEventListener(type: 'visibilitychange', listener: () => void): void;
}

interface Timers {
  set(callback: () => void, ms: number): unknown;
  clear(handle: unknown): void;
}

/**
 * Стежить за одним полотном. `remount` викликається щонайбільше раз:
 * далі за новим полотном стежить новий спостерігач.
 */
export function watchCanvasContext(
  canvas: EventTarget,
  remount: () => void,
  doc: VisibleDocument,
  timers: Timers = { set: (cb, ms) => setTimeout(cb, ms), clear: (h) => clearTimeout(h as ReturnType<typeof setTimeout>) },
): () => void {
  let lost = false;
  let done = false;
  let timer: unknown = null;

  const fire = () => {
    if (!lost || done || doc.visibilityState !== 'visible') return;
    done = true;
    remount();
  };
  const arm = () => {
    if (timer !== null) timers.clear(timer);
    timer = timers.set(() => {
      timer = null;
      fire();
    }, RESTORE_GRACE_MS);
  };
  const onLost = () => {
    lost = true;
    if (doc.visibilityState === 'visible') arm();
  };
  const onRestored = () => {
    lost = false;
    if (timer !== null) timers.clear(timer);
    timer = null;
  };
  // Сторінку знову видно: дати браузеру шанс відновити контекст самому.
  const onVisible = () => {
    if (lost && doc.visibilityState === 'visible') arm();
  };

  canvas.addEventListener('webglcontextlost', onLost);
  canvas.addEventListener('webglcontextrestored', onRestored);
  doc.addEventListener('visibilitychange', onVisible);
  return () => {
    canvas.removeEventListener('webglcontextlost', onLost);
    canvas.removeEventListener('webglcontextrestored', onRestored);
    doc.removeEventListener('visibilitychange', onVisible);
    if (timer !== null) timers.clear(timer);
  };
}

/**
 * Для `<Canvas key={key} onCreated={onCreated}>`. Ключ змінюється лише тоді,
 * коли контекст втрачено безповоротно.
 */
export function useCanvasRecovery(): { key: number; onCreated: (state: { gl: { domElement: HTMLCanvasElement } }) => void } {
  const [key, setKey] = useState(0);
  const stop = useRef<(() => void) | null>(null);
  const onCreated = useCallback((state: { gl: { domElement: HTMLCanvasElement } }) => {
    stop.current?.();
    stop.current = watchCanvasContext(state.gl.domElement, () => setKey((k) => k + 1), document);
  }, []);
  useEffect(() => () => stop.current?.(), []);
  return { key, onCreated };
}
