import { describe, expect, it } from 'vitest';
import { parseDeclaredCounts, serializeDeclaredCounts } from '@/features/onboarding/declaredCounts';
import {
  EMPTY_ANSWER,
  FULLNESS_PHOTOS,
  PAST_COUNT_MAX,
  SPECIES_POSSESSIVE,
  grownSnapshot,
  hasAnyAnswer,
  mergePastYears,
  nameProblem,
  pastYearSpans,
  startProblem,
} from './newCouple';

// ============================================================
// Реєстрація нової пари (ADR-0230): ім'я, дата початку, минулі роки.
// Сервер (`create_couple_for`) перевіряє ім'я й дату так само — клієнт
// лише каже про проблему раніше, не чекаючи відмови.
// ============================================================

describe('ім\'я й дата — ті самі межі, що на сервері', () => {
  it('ім\'я: порожнє й довше за 40 — відмова, пробіли по краях не рахуються', () => {
    expect(nameProblem('   ')).toBe('empty');
    expect(nameProblem('а'.repeat(41))).toBe('long');
    expect(nameProblem('  Олена  ')).toBeNull();
  });

  it('дата: не в майбутньому й не раніше 1950', () => {
    expect(startProblem('', '2026-09-28')).toBe('empty');
    expect(startProblem('2026-09-29', '2026-09-28')).toBe('future');
    expect(startProblem('1949-12-31', '2026-09-28')).toBe('too_early');
    expect(startProblem('2026-09-28', '2026-09-28')).toBeNull();
  });
});

describe('минулі роки', () => {
  it('питаємо лише про прожиті роки, ключ — річниця', () => {
    const spans = pastYearSpans('2022-12-26', '2026-09-28');
    expect(spans.map((s) => s.startsAt)).toEqual(['2022-12-26', '2023-12-26', '2024-12-26']);
    expect(spans[0]!.label).toBe('Перший рік');
    expect(spans[0]!.range).toBe('2022–2023');
  });

  it('пара, що почалась цього року, минулих років не має', () => {
    expect(pastYearSpans('2026-01-10', '2026-09-28')).toEqual([]);
  });

  it('порожні відповіді — «нічого не сказано», тож і вирощувати нічого', () => {
    expect(hasAnyAnswer({})).toBe(false);
    expect(hasAnyAnswer({ '2022-12-26': { ...EMPTY_ANSWER } })).toBe(false);
    expect(hasAnyAnswer({ '2022-12-26': { ...EMPTY_ANSWER, fullness: 2 } })).toBe(true);
  });

  it('лягають у сказані числа: місця, віхи, бажання, насиченість → знімки', () => {
    const merged = mergePastYears({}, {
      '2022-12-26': { places: 3, milestones: 1, wishes: 2, fullness: 4 },
    });
    expect(merged).toEqual({
      '2022-12-26': { places: 3, milestones: 1, wishes: 2, photos: FULLNESS_PHOTOS[4] },
    });
    // І переживають запис у `settings` тим самим форматом, що читає портал.
    expect(parseDeclaredCounts(serializeDeclaredCounts(merged))).toEqual(merged);
  });

  it('не чіпають того, про що не питали (фільми), і прибирають обнулене', () => {
    const saved = { '2022-12-26': { movies: 5, places: 9 }, '2023-12-26': { places: 2 } };
    const merged = mergePastYears(saved, {
      '2022-12-26': { ...EMPTY_ANSWER, places: 1 },
      '2023-12-26': { ...EMPTY_ANSWER },
    });
    expect(merged).toEqual({ '2022-12-26': { movies: 5, places: 1 } });
  });

  it('лічильник обрізано до стелі — сказане число не стає важелем', () => {
    const merged = mergePastYears({}, { '2022-12-26': { ...EMPTY_ANSWER, wishes: 999, fullness: 17 } });
    expect(merged['2022-12-26']).toEqual({ wishes: PAST_COUNT_MAX, photos: FULLNESS_PHOTOS[5] });
  });
});

describe('острів пари на кроці «вирощуємо» — зі сказаного, тим самим шляхом, що й портал', () => {
  it('кожне сказане число стає рядком знімка в своєму році', () => {
    const counts = mergePastYears({}, { '2022-12-26': { places: 2, milestones: 1, wishes: 3, fullness: 2 } });
    const snap = grownSnapshot('2022-12-26', '2026-09-28', counts);
    expect(snap.startDate).toBe('2022-12-26');
    expect(snap.places).toHaveLength(2);
    expect(snap.events).toHaveLength(1);
    expect(snap.wishes).toHaveLength(3);
    expect(snap.memories).toHaveLength(FULLNESS_PHOTOS[2]!);
    expect((snap.places ?? []).every((p) => (p.date ?? '') >= '2022-12-26' && (p.date ?? '') < '2023-12-26')).toBe(true);
  });

  it('без сказаного — порожня історія, а не вигадана', () => {
    const snap = grownSnapshot('2022-12-26', '2026-09-28', {});
    expect([snap.memories, snap.places, snap.wishes, snap.events].reduce((n, rows) => n + (rows?.length ?? 0), 0)).toBe(0);
  });
});

describe('рід виду в реченні', () => {
  it('«ваше дерево», а не «ваш дерево» (регресія першого живого кадру)', () => {
    expect(SPECIES_POSSESSIVE.tree.your).toBe('ваше дерево');
    expect(SPECIES_POSSESSIVE.tree.it).toBe('воно');
    expect(SPECIES_POSSESSIVE.crystal.your).toBe('ваш кристал');
  });
});
