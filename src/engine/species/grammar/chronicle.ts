// ============================================================
// Хроніка росту (ADR-0238): що саме виростило об'єкт.
// ------------------------------------------------------------
// Той самий знімок, з якого ростуть кристал, дерево й вулкан, розкладений
// назад на записи пари: кожен — з модулем, датою, роком стосунків і
// порядковим номером у своєму модулі (номер потрібен тим частинам, що
// ростуть поштучно: плоди, мушлі, друзи, корені).
//
// Лише справжні записи: дата поза історією пари (до початку або після
// знімка) не потрапляє сюди так само, як не потрапляє в ріст.
//
// Модуль чистий: без three, без React, без годинника.
// ============================================================
import { dayNumber, parseDay, yearIndex } from '../crystalV2/calendar';
import { giftChannel, type ActivityKind, type CrystalV2Snapshot, type GiftChannel } from '../crystalV2/model';

export interface ChronicleTrace {
  kind: ActivityKind;
  /** id запису в його модулі; для вихідних — сама дата. */
  id: number | string;
  /** День запису, `YYYY-MM-DD`. */
  date: string;
  /** Рік стосунків, 0 — перший. */
  year: number;
  /** Порядковий номер серед записів свого модуля за датою, від 0. */
  index: number;
  /** Для бажань — хто його виконав (колір квітки/актинії). */
  channel?: GiftChannel;
}

function iso(text: string): string {
  const d = parseDay(text);
  return `${String(d.year).padStart(4, '0')}-${String(d.month).padStart(2, '0')}-${String(d.day).padStart(2, '0')}`;
}

/** Усі записи, що виростили об'єкт на дату знімка, від найдавнішого. */
export function chronicleTraces(snapshot: CrystalV2Snapshot): ChronicleTrace[] {
  const start = parseDay(snapshot.startDate.slice(0, 10));
  const asOf = parseDay(snapshot.asOf.slice(0, 10));
  const from = dayNumber(start);
  const to = dayNumber(asOf);
  const raw: Omit<ChronicleTrace, 'index' | 'year'>[] = [];
  const add = (kind: ActivityKind, id: number | string, text: string | null | undefined, channel?: GiftChannel) => {
    if (!text) return;
    const at = dayNumber(parseDay(text));
    if (at < from || at > to) return;
    raw.push(channel ? { kind, id, date: iso(text), channel } : { kind, id, date: iso(text) });
  };
  const partners = snapshot.partners ?? {};
  for (const row of snapshot.memories ?? []) add('memories', row.id, row.date);
  for (const row of snapshot.plans ?? []) add('plans', row.id, row.date);
  for (const row of snapshot.wishes ?? []) add('wishes', row.id, row.date, giftChannel(row, partners));
  for (const row of snapshot.events ?? []) add(row.isMilestone ? 'milestones' : 'events', row.id, row.date);
  for (const row of snapshot.places ?? []) add('places', row.id, row.date);
  for (const row of snapshot.media ?? []) add('media', row.id, row.date);
  for (const text of snapshot.daysOff ?? []) add('daysOff', text.slice(0, 10), text);

  raw.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : String(a.id) < String(b.id) ? -1 : String(a.id) > String(b.id) ? 1 : 0));
  const counters = new Map<ActivityKind, number>();
  return raw.map((trace) => {
    const index = counters.get(trace.kind) ?? 0;
    counters.set(trace.kind, index + 1);
    return { ...trace, year: yearIndex(start, parseDay(trace.date)), index };
  });
}

/** Скільки повних місяців між початком стосунків і знімком (для повзунка часу). */
export function chronicleMonths(startDate: string, asOf: string): number {
  const s = parseDay(startDate.slice(0, 10));
  const e = parseDay(asOf.slice(0, 10));
  return Math.max(0, (e.year - s.year) * 12 + (e.month - s.month) - (e.day < s.day ? 1 : 0));
}

/**
 * Дата через `months` місяців від початку стосунків, не пізніше знімка.
 * День місяця тримається початковим (31 → останній день коротшого місяця).
 */
export function chronicleDateAt(startDate: string, asOf: string, months: number): string {
  const s = parseDay(startDate.slice(0, 10));
  const total = s.year * 12 + (s.month - 1) + Math.max(0, Math.floor(months));
  const year = Math.floor(total / 12);
  const month = (total % 12) + 1;
  const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  const last = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1]!;
  const day = Math.min(s.day, last);
  const text = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return text > asOf.slice(0, 10) ? asOf.slice(0, 10) : text;
}
