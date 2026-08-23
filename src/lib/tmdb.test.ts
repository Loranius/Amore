import { describe, expect, it } from 'vitest';
import { resolveTmdbKey } from './tmdb';

const FALLBACK = '1b28cacaab2f90a8c2bd0c383c636f01';

describe('ключ TMDB', () => {
  it('порожня змінна оточення НЕ стає ключем', () => {
    /*
     * Виміряна вада, і саме вона робить цей тест потрібним.
     *
     * Було `import.meta.env.VITE_TMDB_KEY ?? FALLBACK`. `??` підставляє
     * запасне лише для `null`/`undefined`, а порожній рядок пропускає
     * далі як годяще значення. У `.env.local` лежало `VITE_TMDB_KEY=`
     * без значення — ключем ставав `''`, і TMDB відповідала 401 на КОЖЕН
     * запит: ні свайпу, ні пошуку, ні деталей.
     *
     * Помітити було важко: усі три виклики ловлять помилку й повертають
     * порожній список, тож колода писала «Картки скінчились» — тобто
     * несправність виглядала як нормальний кінець стрічки.
     */
    expect(resolveTmdbKey('')).toBe(FALLBACK);
    expect(resolveTmdbKey('   ')).toBe(FALLBACK);
  });

  it('відсутня змінна теж дає запасний ключ', () => {
    expect(resolveTmdbKey(undefined)).toBe(FALLBACK);
    expect(resolveTmdbKey(null)).toBe(FALLBACK);
  });

  it('справжній ключ проходить без змін', () => {
    expect(resolveTmdbKey('abc123')).toBe('abc123');
  });

  it('випадкові пробіли з .env обрізаються', () => {
    // `VITE_TMDB_KEY= abc123 ` — пробіл після знака рівності потрапляє
    // у значення, а TMDB відповість 401 на ключ із пробілом.
    expect(resolveTmdbKey('  abc123  ')).toBe('abc123');
  });
});
