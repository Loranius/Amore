import { describe, expect, it } from 'vitest';
import type { EventRow, EventSignificance } from '@/types';
import { KEY_EVENT_TEMPLATES, takenKeySignificance } from './keyEvents';

const row = (id: number, significance: EventSignificance): EventRow => ({
  id,
  title: `подія ${id}`,
  description: null,
  date: '2024-01-01',
  created_by: null,
  type: 'anniversary',
  yearly: false,
  metadata: null,
  significance,
  is_milestone: significance !== 'regular',
  person_user_id: null,
});

describe('KEY_EVENT_TEMPLATES', () => {
  it('ключових видів рівно два — це і є вся закритість набору', () => {
    expect(KEY_EVENT_TEMPLATES.map((template) => template.significance))
      .toEqual(['relationship_start', 'marriage']);
  });
});

describe('takenKeySignificance', () => {
  it('порожня історія не займає жодного ключа', () => {
    expect(takenKeySignificance([])).toEqual(new Set());
  });

  it('«важлива» та «звичайна» ключів не займають', () => {
    expect(takenKeySignificance([row(1, 'important'), row(2, 'regular')])).toEqual(new Set());
  });

  it('наявний початок відносин займає свій ключ', () => {
    expect(takenKeySignificance([row(1, 'relationship_start')]))
      .toEqual(new Set(['relationship_start']));
  });

  it('обидва ключі можуть бути зайняті одночасно', () => {
    const taken = takenKeySignificance([row(1, 'relationship_start'), row(2, 'marriage')]);
    expect(taken).toEqual(new Set(['relationship_start', 'marriage']));
  });

  it('подія, яку редагують, не вимикає власну кнопку', () => {
    const marriage = row(2, 'marriage');
    const taken = takenKeySignificance([row(1, 'relationship_start'), marriage], marriage);
    expect(taken).toEqual(new Set(['relationship_start']));
  });
});
