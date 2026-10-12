// ============================================================
// Три стани плану й смуга тижня (ADR-0256).
// Дата заморожена: 12 жовтня 2026 — понеділок, день, коли знімалась чернетка.
// ============================================================
import { describe, expect, it } from 'vitest';
import { planStage, stageIdeas, stageLived, stageScheduled, weekDays } from './planStage';
import type { EventRow, PlanRow } from '@/types';

const TODAY = new Date(2026, 9, 12);

const plan = (over: Partial<PlanRow> = {}): PlanRow => ({
  id: 1, title: 'План', description: null, category: 'other', status: 'planning',
  cover_url: null, url: null, start_date: null, end_date: null, start_time: null,
  date_precision: 'none', location_name: null, place_id: null, budget: null, proposed_by: null,
  confirmed: true, created_by: 1, created_at: '2026-07-01T10:00:00Z',
  updated_at: '2026-07-01T10:00:00Z', completed_at: null,
  ...over,
});

const event = (over: Partial<EventRow>): EventRow => ({
  id: 1, title: 'Подія', date: '2026-10-15', type: 'holiday', yearly: false,
  ...over,
} as EventRow);

describe('сім статусів у базі — три стани на екрані', () => {
  it('стан виводиться з дати, а не з перемикача', () => {
    expect(planStage(plan({ status: 'idea' }))).toBe('idea');
    expect(planStage(plan({ status: 'preparing' }))).toBe('idea');
    expect(planStage(plan({ status: 'idea', start_date: '2026-10-17', date_precision: 'day' }))).toBe('scheduled');
    expect(planStage(plan({ status: 'ready', start_date: '2026-10-17', date_precision: 'day' }))).toBe('scheduled');
  });

  it('виконане — прожито, відкладене — знову задум, скасоване — сховане', () => {
    expect(planStage(plan({ status: 'done' }))).toBe('lived');
    expect(planStage(plan({ status: 'postponed', start_date: '2026-10-17' }))).toBe('idea');
    expect(planStage(plan({ status: 'cancelled' }))).toBe('hidden');
  });
});

describe('списки першого екрана', () => {
  const plans = [
    plan({ id: 1, status: 'idea', created_at: '2026-07-29T10:00:00Z' }),
    plan({ id: 2, status: 'postponed', created_at: '2026-07-01T10:00:00Z' }),
    plan({ id: 3, status: 'preparing', start_date: '2026-07-01', end_date: '2028-01-01', date_precision: 'range' }),
    plan({ id: 4, status: 'planning', start_date: '2026-10-17', date_precision: 'day' }),
    plan({ id: 5, status: 'done', start_date: '2026-05-01', date_precision: 'day' }),
    plan({ id: 6, status: 'done', start_date: '2026-09-01', date_precision: 'day' }),
    plan({ id: 7, status: 'cancelled' }),
  ];

  it('карусель — задуми, найдавніший першим, разом із відкладеними', () => {
    expect(stageIdeas(plans).map((p) => p.id)).toEqual([2, 1]);
  });

  it('заплановане — те, що триває, першим, далі найближче', () => {
    expect(stageScheduled(plans, TODAY).map((p) => p.id)).toEqual([3, 4]);
  });

  it('прожите — найсвіжіше зверху, скасоване нікуди не потрапляє', () => {
    expect(stageLived(plans).map((p) => p.id)).toEqual([6, 5]);
    const all = [...stageIdeas(plans), ...stageScheduled(plans, TODAY), ...stageLived(plans)];
    expect(all.some((p) => p.id === 7)).toBe(false);
  });
});

describe('смуга тижня', () => {
  it('тиждень з понеділка, сьогодні позначене', () => {
    const days = weekDays([], [], TODAY);
    expect(days.map((d) => d.day)).toEqual([12, 13, 14, 15, 16, 17, 18]);
    expect(days.filter((d) => d.isToday).map((d) => d.iso)).toEqual(['2026-10-12']);
  });

  it('тиждень через межу місяця й року рахується за календарем', () => {
    const days = weekDays([], [], new Date(2026, 11, 31));
    expect(days.map((d) => d.iso)).toEqual([
      '2026-12-28', '2026-12-29', '2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02', '2027-01-03',
    ]);
  });

  it('крапка плану — лише в днях запланованого, не відкладеного', () => {
    const days = weekDays([
      plan({ id: 4, start_date: '2026-10-17', date_precision: 'day' }),
      plan({ id: 8, status: 'postponed', start_date: '2026-10-14', date_precision: 'day' }),
    ], [], TODAY);
    expect(days.filter((d) => d.hasPlan).map((d) => d.day)).toEqual([17]);
  });

  it('щорічна подія ставить крапку в цьому році', () => {
    const days = weekDays([], [event({ date: '1998-10-15', yearly: true, type: 'birthday' })], TODAY);
    expect(days.filter((d) => d.hasEvent).map((d) => d.day)).toEqual([15]);
  });
});
