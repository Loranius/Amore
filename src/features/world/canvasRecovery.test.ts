import { describe, expect, it } from 'vitest';
import { RESTORE_GRACE_MS, watchCanvasContext } from './canvasRecovery';

// ============================================================
// Власник, 2026-10-04: «оптимізуй роботу сайту під айфони». iOS забирає
// WebGL-контекст у згорнутої сторінки й часто не повертає його. Сцена мусить
// повернутись сама, а живий контекст ніколи не перемонтовується.
// ============================================================

class FakeDoc extends EventTarget {
  visibilityState: DocumentVisibilityState = 'visible';
  show(state: DocumentVisibilityState) {
    this.visibilityState = state;
    this.dispatchEvent(new Event('visibilitychange'));
  }
}

function rig() {
  const canvas = new EventTarget();
  const doc = new FakeDoc();
  let now = 0;
  const queue: { at: number; cb: () => void; id: number }[] = [];
  let next = 0;
  const timers = {
    set: (cb: () => void, ms: number) => {
      next += 1;
      queue.push({ at: now + ms, cb, id: next });
      return next;
    },
    clear: (id: unknown) => {
      const i = queue.findIndex((t) => t.id === id);
      if (i >= 0) queue.splice(i, 1);
    },
  };
  const advance = (ms: number) => {
    now += ms;
    for (const t of queue.filter((q) => q.at <= now)) {
      timers.clear(t.id);
      t.cb();
    }
  };
  let remounts = 0;
  const stop = watchCanvasContext(canvas, () => { remounts += 1; }, doc, timers);
  return { canvas, doc, advance, stop, remounts: () => remounts };
}

describe('полотно після втрати WebGL-контексту', () => {
  it('контекст не повернувся — полотно монтується заново', () => {
    const r = rig();
    r.canvas.dispatchEvent(new Event('webglcontextlost'));
    r.advance(RESTORE_GRACE_MS - 1);
    expect(r.remounts()).toBe(0);
    r.advance(1);
    expect(r.remounts()).toBe(1);
  });

  it('браузер відновив контекст сам — нічого не перемонтовуємо', () => {
    const r = rig();
    r.canvas.dispatchEvent(new Event('webglcontextlost'));
    r.canvas.dispatchEvent(new Event('webglcontextrestored'));
    r.advance(RESTORE_GRACE_MS * 3);
    expect(r.remounts()).toBe(0);
  });

  it('втрачено у згорнутій сторінці — чекаємо, доки її знову видно', () => {
    const r = rig();
    r.doc.show('hidden');
    r.canvas.dispatchEvent(new Event('webglcontextlost'));
    r.advance(RESTORE_GRACE_MS * 10);
    expect(r.remounts()).toBe(0);
    r.doc.show('visible');
    r.advance(RESTORE_GRACE_MS);
    expect(r.remounts()).toBe(1);
  });

  it('перемонтування — щонайбільше одне на полотно, і після зупинки тиша', () => {
    const r = rig();
    r.canvas.dispatchEvent(new Event('webglcontextlost'));
    r.advance(RESTORE_GRACE_MS);
    r.canvas.dispatchEvent(new Event('webglcontextlost'));
    r.advance(RESTORE_GRACE_MS);
    expect(r.remounts()).toBe(1);

    const s = rig();
    s.stop();
    s.canvas.dispatchEvent(new Event('webglcontextlost'));
    s.advance(RESTORE_GRACE_MS * 2);
    expect(s.remounts()).toBe(0);
  });
});
