import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/*
 * РЕГРЕСІЯ НА ЧЕРВОНИЙ CI, ЯКИЙ ЖИВ П'ЯТЬ ДНІВ.
 *
 * `src/lib/supabase.ts` кидав помилку про відсутні змінні оточення просто
 * в тілі модуля. У CI немає `.env.local` — він гітігнорений, і це
 * правильно, — тож кожен тест, до якого тягнувся імпорт клієнта, падав ще
 * до входу у свій `it`. Падав рівно один файл із 282, але наслідки були
 * несумірні: у CI виконувалась 2721 перевірка проти 2729 локально, а
 * кроки `build` і `verify:pages-build` після впалих тестів пропускались —
 * двадцять три коміти поспіль проєкт у CI не збирався жодного разу.
 *
 * Локально все було зелене. Саме тому тут потрібен тест, а не пам'ять:
 * людина з `.env.local` у теці не може відтворити цю ваду руками.
 *
 * Дві половини вимоги, і обидві важливі:
 *   1) імпорт модуля БЕЗ оточення не кидає нічого;
 *   2) помилка нікуди не зникла — вона приходить на першому справжньому
 *      вживанні, з тим самим текстом. Тихого запасного клієнта немає
 *      (`CLAUDE.md`: «no silent fallbacks»).
 */
describe('клієнт бази не падає на імпорті', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  function withoutEnv(): void {
    vi.stubEnv('VITE_SUPABASE_URL', '');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '');
  }

  it('модуль імпортується, коли змінних оточення немає', async () => {
    withoutEnv();
    /*
     * Перевіряється сам факт, що `await import` дійшов до кінця.
     * `Object.keys` на просторі імен модуля навмисно: будь-яка спроба
     * ЗАЗИРНУТИ в `supabase` смикнула б пастку проксі й створила клієнт,
     * тобто тест перевіряв би протилежне тому, що написано в назві.
     */
    const module = await import('./supabase');
    expect(Object.keys(module)).toContain('supabase');
  });

  it('…але перше справжнє вживання кидає ту саму помилку', async () => {
    withoutEnv();
    const { supabase } = await import('./supabase');
    expect(() => supabase.from('plans'))
      .toThrowError(/VITE_SUPABASE_URL \/ VITE_SUPABASE_ANON_KEY/);
  });

  it('із оточенням клієнт будується й віддає запит', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key-для-тесту');
    const { supabase } = await import('./supabase');
    // `.from()` лише збирає запит і в мережу не ходить.
    expect(() => supabase.from('plans').select('id')).not.toThrow();
  });

  it('клієнт будується один раз, а не на кожне звертання', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key-для-тесту');
    const { supabase } = await import('./supabase');
    /*
     * `auth` — властивість екземпляра, тож на одному й тому самому клієнті
     * це буде один і той самий об'єкт. Якби проксі створював клієнт щоразу,
     * посилання розійшлись би — а разом із ними й сесія, на якій тримається
     * RLS.
     */
    expect(supabase.auth).toBe(supabase.auth);
  });
});

/*
 * ДРУГА ПОЛОВИНА ТІЄЇ САМОЇ ВАДИ, І САМЕ ВОНА ЗАЛИШИЛАСЬ БИ НЕПОМІЧЕНОЮ.
 *
 * Зробити клієнт лінивим було НЕ ДОСИТЬ: чотири модулі читали його
 * властивість просто в тілі файлу —
 *
 *     const rpc = supabase.rpc.bind(supabase) as unknown as RpcCaller;
 *
 * — тож клієнт усе одно будувався на імпорті, і CI лишався червоним. Вадою
 * виявився не один рядок в одному файлі, а ЗВИЧКА, розтиражована в чотири
 * місця слово в слово.
 *
 * Тому сторож дивиться на звичку, а не на файл. Форма перевірки — та сама,
 * що в `noRawRandom.test.ts`: читаємо текст модулів і шукаємо заборонений
 * обрис. Поведінковий тест тут не годиться — він мусив би імпортувати
 * кожен із тридцяти шести споживачів, і мовчав би рівно доти, доки
 * тридцять сьомий не з'явиться.
 */
describe('ніхто не чіпає клієнт бази на імпорті', () => {
  /** Читання властивості клієнта в оголошенні на рівні модуля. */
  const TOP_LEVEL_READ = /^(?:export\s+)?(?:const|let|var)\s+[\w$]+\s*(?::[^=]*)?=\s*[^=]*\bsupabase\.[\w$]/;

  function sourceFiles(dir: string, found: string[] = []): string[] {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) sourceFiles(path, found);
      else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) found.push(path);
    }
    return found;
  }

  it('жодного `const … = supabase.…` у тілі модуля', () => {
    const offenders: string[] = [];
    for (const path of sourceFiles('src')) {
      const lines = readFileSync(path, 'utf8').split('\n');
      lines.forEach((line, index) => {
        // `typeof supabase.channel` — позиція ТИПУ, її стирає компілятор.
        if (line.includes('typeof supabase.')) return;
        if (TOP_LEVEL_READ.test(line)) offenders.push(`${path}:${index + 1}  ${line.trim()}`);
      });
    }
    expect(offenders, offenders.join('\n')).toEqual([]);
  });

  it('сам сторож щось ловить', () => {
    // Мутаційна перевірка: без неї зелений тест вище нічого не доводить —
    // він був би зеленим і з порожнім регулярним виразом.
    expect(TOP_LEVEL_READ.test('const rpc = supabase.rpc.bind(supabase) as unknown as RpcCaller;'))
      .toBe(true);
    expect(TOP_LEVEL_READ.test('export const x = supabase.storage;')).toBe(true);
    // А звичайний виклик усередині функції чіпати не має.
    expect(TOP_LEVEL_READ.test('  const { data } = await supabase.from(\'plans\').select();'))
      .toBe(false);
  });
});
