import { describe, expect, it } from 'vitest';
import { draftChanged, draftIssue, ISSUE_HINT, NOTE_LIMIT } from './momentDraft';

const draft = (over: Partial<Parameters<typeof draftIssue>[0]> = {}) => ({
  title: 'Тераса',
  note: 'було тепло',
  memoryDate: '2024-07-14',
  photoCount: 1,
  ...over,
});

describe('що заважає зберегти спогад', () => {
  it('повний спогад зберігається', () => {
    expect(draftIssue(draft())).toBeNull();
  });

  it('без фото — не спогад', () => {
    // Порожня картка в галереї не має сенсу: полароїд без кадру.
    expect(draftIssue(draft({ photoCount: 0 }))).toBe('no-photo');
  });

  it('назва НЕ обовʼязкова', () => {
    /*
     * Тридцять сім спогадів, що мігрували зі старої пофотографічної
     * моделі, ніколи не мали назви. Якби вона була обов'язковою,
     * редагування жодного з них не можна було б зберегти.
     */
    expect(draftIssue(draft({ title: '' }))).toBeNull();
  });

  it('опис довший за тридцять символів не пускається у форму', () => {
    // Стеля стоїть CHECK-ом у базі. Якби форма пускала більше, пара
    // побачила б помилку бази замість підказки в полі.
    expect(draftIssue(draft({ note: 'я'.repeat(NOTE_LIMIT + 1) }))).toBe('note-too-long');
    expect(draftIssue(draft({ note: 'я'.repeat(NOTE_LIMIT) }))).toBeNull();
  });

  it('пробіли по краях не зʼїдають ліміт', () => {
    expect(draftIssue(draft({ note: `  ${'я'.repeat(NOTE_LIMIT)}  ` }))).toBeNull();
  });

  it('порожня чи покалічена дата зупиняє збереження', () => {
    expect(draftIssue(draft({ memoryDate: '' }))).toBe('no-date');
    expect(draftIssue(draft({ memoryDate: '2024-7-4' }))).toBe('no-date');
  });

  it('фото перевіряється ПЕРШИМ', () => {
    // Порядок перевірок — це порядок, у якому пара їх зустріне.
    expect(draftIssue(draft({ photoCount: 0, memoryDate: '' }))).toBe('no-photo');
  });

  it('на кожну причину є підказка', () => {
    for (const issue of ['no-photo', 'no-date', 'note-too-long'] as const) {
      expect(ISSUE_HINT[issue].length).toBeGreaterThan(0);
    }
  });
});

describe('чи є незбережені зміни', () => {
  const saved = { title: 'Тераса', note: 'тепло', memoryDate: '2024-07-14', placePinId: 3 };

  it('нічого не чіпали — змін немає', () => {
    expect(draftChanged(saved, { ...saved })).toBe(false);
  });

  it('дописаний пробіл зміною не вважається', () => {
    // Інакше застосунок питав би «вийти без збереження?» після того, як
    // пара просто поставила курсор у поле.
    expect(draftChanged(saved, { ...saved, title: 'Тераса ' })).toBe(false);
  });

  it('кожне поле помічається', () => {
    expect(draftChanged(saved, { ...saved, title: 'Дача' })).toBe(true);
    expect(draftChanged(saved, { ...saved, note: 'холодно' })).toBe(true);
    expect(draftChanged(saved, { ...saved, memoryDate: '2024-07-15' })).toBe(true);
    expect(draftChanged(saved, { ...saved, placePinId: null })).toBe(true);
  });
});
