import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { realtimeInvalidation, qk } from '@/lib/queryKeys';
import { mergePhotoPool } from './photoPool';

// Пул грані «Фотографії» (ADR-0248): фото спогадів живлять кристал, а вже
// покладене полароїдом лишається.

describe('пул фото кристала', () => {
  it('фото спогаду датується днем спогаду, а не днем завантаження', () => {
    const pool = mergePhotoPool([], [
      { photo_url: 'm1', memory_date: '2023-07-14', moment_id: 3 },
    ]);
    expect(pool).toEqual([{ url: 'm1', date: '2023-07-14' }]);
  });

  it('знімок без спогаду в пул не йде — кристал не росте з того, чого пара не бачить', () => {
    const pool = mergePhotoPool([], [
      { photo_url: 'loose', memory_date: '2024-01-01', moment_id: null },
      { photo_url: 'kept', memory_date: '2024-01-02', moment_id: 1 },
    ]);
    expect(pool.map((p) => p.url)).toEqual(['kept']);
  });

  it('полароїди, які вже лежать у бакеті, лишаються — кристал не меншає', () => {
    const pool = mergePhotoPool(
      [{ url: 'p1', created_at: '2026-09-20T10:00:00Z' }],
      [{ photo_url: 'm1', memory_date: '2026-09-01', moment_id: 2 }],
    );
    expect(pool).toEqual([
      { url: 'm1', date: '2026-09-01' },
      { url: 'p1', date: '2026-09-20' },
    ]);
  });

  it('порядок детермінований: дата, потім бакет перед спогадами, потім вихідний порядок', () => {
    const storage = [
      { url: 's-b', created_at: '2025-05-05T00:00:00Z' },
      { url: 's-a', created_at: '2025-05-05T23:00:00Z' },
    ];
    const memories = [
      { photo_url: 'm-b', memory_date: '2025-05-05', moment_id: 1 },
      { photo_url: 'm-a', memory_date: '2025-05-05', moment_id: 1 },
    ];
    const first = mergePhotoPool(storage, memories);
    expect(first.map((p) => p.url)).toEqual(['s-b', 's-a', 'm-b', 'm-a']);
    expect(mergePhotoPool(storage, memories)).toEqual(first);
  });

  it('недатований файл бакета лишається в пулі, але стоїть після всіх датованих', () => {
    const pool = mergePhotoPool(
      [{ url: 'nodate', created_at: null }],
      [{ photo_url: 'm1', memory_date: '2022-02-02', moment_id: 1 }],
    );
    expect(pool).toEqual([
      { url: 'm1', date: '2022-02-02' },
      { url: 'nodate', date: null },
    ]);
  });
});

describe('дорога нових фото в кристал не обривається тихо', () => {
  /*
   * ADR-0180 уже раз обірвав її непомітно: менеджер фото пішов, а з ним
   * єдиний шлях у пул — і грань «Фотографії» стала. Збірка від цього не
   * падає, тому стерегти доводиться читанням коду.
   */
  const home = readFileSync(join(__dirname, 'useHome.ts'), 'utf8');

  it('пул читає таблицю спогадів і зводить джерела через mergePhotoPool', () => {
    expect(home).toContain(".from('memories')");
    expect(home).toContain('mergePhotoPool(');
  });

  it('зміна фото спогадів у партнера скидає пул кристала (realtime)', () => {
    expect(realtimeInvalidation.memories).toContainEqual(qk.photos());
  });
});
