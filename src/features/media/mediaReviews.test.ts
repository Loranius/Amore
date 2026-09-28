import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { MediaItemRow, MediaReviewRow } from '@/types';
import { attachReviews, reviewOf } from './useMedia';

// ============================================================
// Відгуки на фільми — рядок на людину (ADR-0229).
// До цього відгуки жили колонками `rating_dima/rating_lena/…`, а
// інтерфейс вибирав автора між вшитими «Діма» і «Лєна»: для будь-якої
// іншої пари в схемі просто не було місця під її відгук.
// ============================================================

const row = (id: number): MediaItemRow => ({
  id,
  type: 'movie',
  title: `Фільм ${id}`,
  status: 'done',
  poster_url: null,
  created_by: null,
  created_at: '2026-01-01T00:00:00Z',
  finished_at: null,
});

const review = (media_id: number, user_id: number, rating: number | null): MediaReviewRow => ({
  media_id,
  user_id,
  rating,
  comment: null,
  updated_at: '2026-01-02T00:00:00Z',
});

describe('відгуки приєднуються до свого фільму', () => {
  it('кожен фільм отримує лише свої відгуки, у порядку людей', () => {
    const items = attachReviews([row(1), row(2)], [review(1, 7, 9), review(2, 3, 5), review(1, 3, 6)]);
    expect(items[0]!.reviews.map((r) => r.user_id)).toEqual([3, 7]);
    expect(items[1]!.reviews.map((r) => r.user_id)).toEqual([3]);
  });

  it('фільм без відгуків — порожній список, а не undefined', () => {
    expect(attachReviews([row(5)], [])[0]!.reviews).toEqual([]);
  });

  it('відгук людини знаходиться за її id, чужий — ні', () => {
    const [item] = attachReviews([row(1)], [review(1, 3, 8)]);
    expect(reviewOf(item!, 3)?.rating).toBe(8);
    expect(reviewOf(item!, 4)).toBeNull();
  });
});

describe('модуль фільмів не знає імен конкретної пари (регресія ADR-0229)', () => {
  const dir = __dirname;
  const sources = readdirSync(dir)
    .filter((f) => /\.(ts|tsx)$/.test(f) && !f.includes('.test.'))
    .map((f) => [f, readFileSync(join(dir, f), 'utf8')] as const);

  for (const [file, src] of sources) {
    it(file, () => {
      expect(src).not.toMatch(/rating_(dima|lena)|comment_(dima|lena)/);
      expect(src).not.toMatch(/'dima'|'lena'|'Діма'|'Лєна'/);
    });
  }

  it('відгук пишеться рядком (media_id, user_id), порожній — видаляється', () => {
    const hooks = readFileSync(join(dir, 'useMedia.ts'), 'utf8');
    expect(hooks).toContain("onConflict: 'media_id,user_id'");
    expect(hooks).toContain(".from('media_reviews').delete()");
  });
});
