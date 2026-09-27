import { beforeEach, describe, expect, it, vi } from 'vitest';
import { isOversizedPhoto, markOversizedPhoto, resetOversizedPhotosForTest } from './photoRescue';

// ============================================================
// Пам'ять про знімки, які сховище не зменшує (ADR-0212).
// ------------------------------------------------------------
// Регресія: знімок 6144×8160 на 11.4 МБ щоразу спершу коштував
// гарантований 400 від `render/image` і лише потім рятувався.
// ============================================================

function fakeStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() { return data.size; },
    clear: () => data.clear(),
    getItem: (key) => data.get(key) ?? null,
    key: (index) => [...data.keys()][index] ?? null,
    removeItem: (key) => { data.delete(key); },
    setItem: (key, value) => { data.set(key, String(value)); },
  };
}

describe('пам\'ять про завеликі знімки', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', fakeStorage());
    resetOversizedPhotosForTest();
  });

  it('ключ — файл, а не адреса з `?t=`: той самий знімок після оновлення впізнається', () => {
    markOversizedPhoto('https://x.supabase.co/storage/v1/object/public/a/b.jpg?t=1');
    expect(isOversizedPhoto('https://x.supabase.co/storage/v1/object/public/a/b.jpg?t=2')).toBe(true);
    expect(isOversizedPhoto('https://x.supabase.co/storage/v1/object/public/a/c.jpg')).toBe(false);
  });

  it('переживає перезавантаження сторінки', () => {
    markOversizedPhoto('https://x/a.jpg');
    resetOversizedPhotosForTest();
    expect(isOversizedPhoto('https://x/a.jpg')).toBe(true);
  });

  it('порожня адреса — не завелика', () => {
    expect(isOversizedPhoto('')).toBe(false);
    expect(isOversizedPhoto(null)).toBe(false);
  });

  it('биті дані в сховищі не ламають перевірку', () => {
    localStorage.setItem('amore:oversized-photos', '{не json');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(isOversizedPhoto('https://x/a.jpg')).toBe(false);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
