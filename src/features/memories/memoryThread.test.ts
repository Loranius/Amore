import { describe, expect, it } from 'vitest';
import {
  FRAME_WIDTH,
  GAP_MAX_PX,
  THREAD_FAN_LEAVES,
  GAP_MIN_PX,
  PAUSE_DAYS,
  buildThread,
  daysApart,
  durationLabel,
  landingLabel,
  threadNeighbors,
  gapPx,
  pauseLabel,
  sizeFor,
  threadFan,
  threadYears,
  type ThreadMoment,
} from './memoryThread';

// «Нитка часу» (ADR-0249): відстань між спогадами каже, скільки минуло.

const m = (id: number, memory_date: string, photoCount = 1): ThreadMoment => ({ id, memory_date, photoCount });

describe('відстань росте з часом, але не без меж', () => {
  it('той самий день — найменший відступ, тиждень і місяць — помітно більші', () => {
    expect(gapPx(0)).toBe(GAP_MIN_PX);
    expect(gapPx(7)).toBeGreaterThan(gapPx(1));
    expect(gapPx(30)).toBeGreaterThan(gapPx(7));
  });

  it('відступ ніколи не зменшується з днями і не перевищує стелю', () => {
    let previous = 0;
    for (let days = 0; days <= PAUSE_DAYS; days += 1) {
      const px = gapPx(days);
      expect(px).toBeGreaterThanOrEqual(previous);
      expect(px).toBeLessThanOrEqual(GAP_MAX_PX);
      previous = px;
    }
  });

  it('дні рахуються в UTC: перехід на літній час не з\'їдає дня', () => {
    expect(daysApart('2025-03-31', '2025-03-29')).toBe(2);
    expect(daysApart('2025-10-27', '2025-10-25')).toBe(2);
  });
});

describe('довга перерва стає словом, а не порожнім екраном', () => {
  it('перерва понад шість тижнів — пауза з підписом, коротша — простір', () => {
    const items = buildThread([m(1, '2025-09-01'), m(2, '2025-05-01'), m(3, '2025-04-25')]);
    expect(items.filter((i) => i.kind === 'pause')).toHaveLength(1);
    expect(items.filter((i) => i.kind === 'gap')).toHaveLength(1);
  });

  it('підписи узгоджені з числом', () => {
    expect(pauseLabel(49)).toBe('7 тижнів');
    expect(pauseLabel(44)).toBe('6 тижнів');
    expect(pauseLabel(122)).toBe('4 місяці');
    expect(pauseLabel(152)).toBe('5 місяців');
    expect(pauseLabel(365)).toBe('рік');
    expect(pauseLabel(456)).toBe('рік й 3 місяці');
    expect(pauseLabel(730)).toBe('2 роки');
    expect(pauseLabel(366)).toBe('рік');
  });
});

describe('рік — зарубка на нитці, і повзунок читає ті самі зарубки', () => {
  const moments = [m(1, '2026-03-01'), m(2, '2025-12-30'), m(3, '2025-06-01'), m(4, '2023-02-02')];

  it('зарубка стоїть перед першим спогадом кожного року, включно з найновішим', () => {
    const years = buildThread(moments).filter((i) => i.kind === 'year').map((i) => i.year);
    expect(years).toEqual([2026, 2025, 2023]);
  });

  it('повзунок знає перший спогад і кількість кожного року', () => {
    expect(threadYears(moments)).toEqual([
      { year: 2026, firstIndex: 0, count: 1 },
      { year: 2025, firstIndex: 1, count: 2 },
      { year: 2023, firstIndex: 3, count: 1 },
    ]);
  });

  it('сторони чергуються наскрізь, не скидаючись на зарубці року', () => {
    const sides = buildThread(moments).flatMap((i) => (i.kind === 'node' ? [i.side] : []));
    expect(sides).toEqual(['left', 'right', 'left', 'right']);
  });
});

describe('кадр росте з кількістю фото', () => {
  it('одне фото — малий, два-три — середній, чотири й більше — великий', () => {
    expect([0, 1, 2, 3, 4, 12].map(sizeFor)).toEqual(['s', 's', 'm', 'm', 'l', 'l']);
  });
});

describe('межові архіви', () => {
  it('порожній архів — порожня нитка', () => {
    expect(buildThread([])).toEqual([]);
    expect(threadYears([])).toEqual([]);
  });

  it('один спогад — зарубка року й один вузол, без відступів', () => {
    expect(buildThread([m(7, '2024-08-08', 3)])).toEqual([
      { kind: 'year', year: 2024 },
      { kind: 'node', id: 7, side: 'left', size: 'm', year: 2024 },
    ]);
  });

  it('та сама історія завжди дає ту саму нитку', () => {
    const moments = [m(1, '2026-01-01', 5), m(2, '2025-01-01', 2)];
    expect(buildThread(moments)).toEqual(buildThread(moments));
  });
});

describe('віяло вузла не перетинає нитку й не виходить за екран', () => {
  it('листи нахилені лише назовні від нитки', () => {
    expect(threadFan(5, 'left').every((l) => l.rotate < 0)).toBe(true);
    expect(threadFan(5, 'right').every((l) => l.rotate > 0)).toBe(true);
  });

  it('найдальший лист малюється першим, і їх не більше двох', () => {
    const leaves = threadFan(9, 'right');
    expect(leaves).toHaveLength(THREAD_FAN_LEAVES);
    expect(Math.abs(leaves[0]!.rotate)).toBeGreaterThan(Math.abs(leaves[1]!.rotate));
  });

  it('виліт найбільшого листа вміщається в зовнішнє поле колонки для кожного розміру кадру', () => {
    // Лист крутиться навколо нижнього краю, тож верхній кут виїжджає на
    // (0.5·cos θ + sin θ − 0.5) власної ширини.
    for (const size of ['s', 'm', 'l'] as const) {
      const frame = FRAME_WIDTH[size];
      for (const leaf of threadFan(THREAD_FAN_LEAVES, 'left')) {
        const rad = (Math.abs(leaf.rotate) * Math.PI) / 180;
        const reach = (0.5 * Math.cos(rad) + Math.sin(rad) - 0.5) * frame * leaf.scale;
        expect(reach).toBeLessThanOrEqual(1 - frame);
      }
    }
  });

  it('спогад з одним фото віяла не має', () => {
    expect(threadFan(0, 'left')).toEqual([]);
  });
});

// ── Сусіди й місце на нитці (ADR-0250) ─────────────────────

describe('скільки минуло — словами, як кажуть', () => {
  it('одиниця без числа, далі узгоджене число', () => {
    expect(durationLabel(0)).toBe('');
    expect(durationLabel(1)).toBe('день');
    expect(durationLabel(3)).toBe('3 дні');
    expect(durationLabel(5)).toBe('5 днів');
    expect(durationLabel(7)).toBe('тиждень');
    expect(durationLabel(21)).toBe('3 тижні');
    expect(durationLabel(31 * 2)).toBe('2 місяці');
    expect(durationLabel(30)).toBe('4 тижні');
  });
});

describe('сусіди на нитці', () => {
  const thread = [
    { id: 3, memory_date: '2025-09-12', title: 'Карпати' },
    { id: 2, memory_date: '2025-08-22', title: '' },
    { id: 1, memory_date: '2025-08-22', title: 'Львів' },
  ];

  it('новіший — «через», старіший — «за … до того»', () => {
    const { newer, older } = threadNeighbors(thread, 2);
    expect(newer?.moment.id).toBe(3);
    expect(newer?.label).toBe('через 3 тижні');
    expect(older?.moment.id).toBe(1);
    expect(older?.label).toBe('того ж дня');
  });

  it('на кінцях нитки сусід лише один', () => {
    expect(threadNeighbors(thread, 3).newer).toBeNull();
    expect(threadNeighbors(thread, 1).older).toBeNull();
  });

  it('чужий id — без сусідів', () => {
    expect(threadNeighbors(thread, 99)).toEqual({ newer: null, older: null });
  });
});

describe('де ляже новий спогад', () => {
  const thread = [
    { id: 3, memory_date: '2025-09-12', title: 'Карпати' },
    { id: 1, memory_date: '2024-05-01', title: '' },
  ];

  it('від найближчого старшого спогаду', () => {
    expect(landingLabel(thread, '2026-01-12')).toBe('Ляже на нитку через 4 місяці після «Карпати»');
    expect(landingLabel(thread, '2025-09-12')).toBe('Ляже на нитку того ж дня, що й «Карпати»');
  });

  it('спогад без назви названо датою', () => {
    expect(landingLabel(thread, '2024-05-15')).toBe('Ляже на нитку через 2 тижні після 01.05.2024');
  });

  it('раніше за все — на початок нитки', () => {
    expect(landingLabel(thread, '2023-05-01')).toBe('Ляже на початок нитки, за рік до 01.05.2024');
  });

  it('спогад, який редагують, сам собі не сусід', () => {
    expect(landingLabel([thread[0]!], '2025-09-12', 3)).toBe('Перший спогад на нитці');
  });
});
