// ============================================================
// Спільний механізм вибору вигляду.
// ------------------------------------------------------------
// Інваріанти, які тут стережуться, — це рівно ті властивості, заради яких
// два майже однакові механізми вішлиста злиті в один. Якщо котрась із них
// зламається, «Спогади», дошка й архів зламаються разом, а не поодинці.
// ============================================================
import { describe, expect, it } from 'vitest';
import {
  normalizeView,
  readViewPreference,
  readViewPreferences,
  writeViewPreference,
  type ViewPreferenceConfig,
  type ViewPreferenceStorage,
} from './viewPreference';

class MemoryStorage implements ViewPreferenceStorage {
  private readonly values = new Map<string, string>();
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  setItem(key: string, value: string): void { this.values.set(key, value); }
}

/** Сховище, яке кидає — приватний режим деяких браузерів. */
class HostileStorage implements ViewPreferenceStorage {
  getItem(): string { throw new Error('storage denied'); }
  setItem(): void { throw new Error('storage denied'); }
}

type Mode = 'bubbles' | 'feed' | 'polaroid';
const CONFIG: ViewPreferenceConfig<Mode> = {
  storageKey: 'amore:test:view:v1',
  modes: ['bubbles', 'feed', 'polaroid'],
  fallback: 'bubbles',
  aliases: { table: 'feed' },
};

describe('normalizeView', () => {
  it('приймає лише оголошені вигляди', () => {
    expect(normalizeView(CONFIG, 'feed')).toBe('feed');
    expect(normalizeView(CONFIG, 'cards')).toBeNull();
    expect(normalizeView(CONFIG, 17)).toBeNull();
    expect(normalizeView(CONFIG, null)).toBeNull();
  });

  it('переводить перейменований вигляд за псевдонімом', () => {
    // 'table' — назва до перейменування у 'feed'. Без цього збережений
    // вибір користувача мовчки скидався б на дефолт.
    expect(normalizeView(CONFIG, 'table')).toBe('feed');
  });
});

describe('readViewPreferences', () => {
  it('зіпсований JSON не валить читання', () => {
    const s = new MemoryStorage();
    s.setItem(CONFIG.storageKey, '{');
    expect(readViewPreferences(CONFIG, s)).toEqual({});
  });

  it('невідомі вигляди відкидаються поштучно, а не всі разом', () => {
    const s = new MemoryStorage();
    s.setItem(CONFIG.storageKey, JSON.stringify({ me: 'cards', partner: 'feed', shared: 17 }));
    expect(readViewPreferences(CONFIG, s)).toEqual({ partner: 'feed' });
  });

  it('сховище, що кидає, дає порожній результат, а не виняток', () => {
    expect(readViewPreferences(CONFIG, new HostileStorage())).toEqual({});
  });

  it('без сховища повертається порожньо', () => {
    expect(readViewPreferences(CONFIG, null)).toEqual({});
  });
});

describe('writeViewPreference', () => {
  it('запис однієї області не затирає інші', () => {
    const s = new MemoryStorage();
    writeViewPreference(CONFIG, 'me', 'feed', s);
    writeViewPreference(CONFIG, 'shared', 'polaroid', s);
    expect(readViewPreferences(CONFIG, s)).toEqual({ me: 'feed', shared: 'polaroid' });
  });

  it('повторний запис тієї самої області перезаписує її', () => {
    const s = new MemoryStorage();
    writeViewPreference(CONFIG, 'me', 'feed', s);
    writeViewPreference(CONFIG, 'me', 'polaroid', s);
    expect(readViewPreferences(CONFIG, s)).toEqual({ me: 'polaroid' });
  });

  it('сховище, що кидає, не ламає запис', () => {
    expect(() => writeViewPreference(CONFIG, 'me', 'feed', new HostileStorage())).not.toThrow();
  });
});

describe('readViewPreference', () => {
  it('порожня область отримує дефолт', () => {
    expect(readViewPreference(CONFIG, 'me', new MemoryStorage())).toBe('bubbles');
  });

  it('області незалежні між собою', () => {
    const s = new MemoryStorage();
    writeViewPreference(CONFIG, 'me', 'feed', s);
    expect(readViewPreference(CONFIG, 'me', s)).toBe('feed');
    expect(readViewPreference(CONFIG, 'partner', s)).toBe('bubbles');
  });

  it('різні ключі сховища не бачать одне одного', () => {
    // Дошка й архів вішлиста ділять назви виглядів, але не пам'ять вибору.
    const s = new MemoryStorage();
    const other: ViewPreferenceConfig<Mode> = { ...CONFIG, storageKey: 'amore:test:other:v1' };
    writeViewPreference(CONFIG, 'shared', 'feed', s);
    expect(readViewPreference(other, 'shared', s)).toBe('bubbles');
  });
});
