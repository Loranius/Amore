import { describe, expect, it } from 'vitest';
import {
  albumColumns,
  fanLeaves,
  FAN_STEP_DEG,
  MAX_FAN_LEAVES,
  photoAspect,
} from './momentStyle';

describe('віяло знімків', () => {
  it('один знімок — жодного листа', () => {
    // Спогад із самою обкладинкою: віяло було б обіцянкою, за якою нічого
    // немає, і картка брехала б про кількість фото.
    expect(fanLeaves(0)).toEqual([]);
  });

  it('кількість листів обмежена, хай би скільки фото в спогаді', () => {
    /*
     * П'ятий лист лягає під уже намальовані й не додає жодного пікселя,
     * зате коштує ще одне завантаження на кожну картку галереї.
     */
    expect(fanLeaves(3)).toHaveLength(3);
    expect(fanLeaves(9)).toHaveLength(MAX_FAN_LEAVES);
    expect(fanLeaves(200)).toHaveLength(MAX_FAN_LEAVES);
  });

  it('листи розходяться в обидва боки', () => {
    const rotates = fanLeaves(MAX_FAN_LEAVES).map((l) => l.rotate);
    expect(rotates.some((r) => r > 0)).toBe(true);
    expect(rotates.some((r) => r < 0)).toBe(true);
  });

  it('жоден лист не стоїть рівно за головним кадром', () => {
    // Нульовий поворот означав би лист, схований під обкладинкою повністю —
    // завантажене фото, якого не видно.
    for (const leaf of fanLeaves(MAX_FAN_LEAVES)) {
      expect(Math.abs(leaf.rotate)).toBeGreaterThan(0);
    }
  });

  it('малює від найдальшого листа до найближчого', () => {
    /*
     * Порядок повернення — порядок малювання. Якби найближчий лист ішов
     * першим, дальші лягали б ПОВЕРХ нього, і віяло читалось би вивернутим
     * навиворіт. Перевіряємо саме монотонність: кут спадає до центру.
     */
    const leaves = fanLeaves(MAX_FAN_LEAVES);
    for (let i = 1; i < leaves.length; i += 1) {
      expect(Math.abs(leaves[i]!.rotate)).toBeLessThanOrEqual(Math.abs(leaves[i - 1]!.rotate));
    }
  });

  it('дальший лист дрібніший за ближчий', () => {
    // Перспектива стопки: що глибше, то менше. Однаковий розмір читався б
    // як помилка накладання, а не як глибина.
    const leaves = fanLeaves(MAX_FAN_LEAVES);
    for (let i = 1; i < leaves.length; i += 1) {
      expect(leaves[i]!.scale).toBeGreaterThanOrEqual(leaves[i - 1]!.scale);
    }
    expect(leaves.every((l) => l.scale > 0 && l.scale <= 1)).toBe(true);
  });

  it('найбільший кут уміщається в поле, лишене під віяло', () => {
    /*
     * Головне обмеження всієї розкладки, і єдине, яке видно лише в числах.
     *
     * Лист крутиться навколо нижнього краю (50%, 100%), тож його верхній
     * кут виїжджає вбік на (0.5·cos θ + sin θ − 0.5) власної ширини. Лист —
     * 0.68 клітинки сітки, і ще стиснутий власним `scale`. Поле під віяло з
     * кожного боку (`--mm-fan-room`) — 16% клітинки; більший виліт наїхав би
     * на сусідню картку.
     */
    const LEAF_WIDTH_OF_CELL = 0.68;
    const FAN_ROOM_OF_CELL = 0.16;

    for (const leaf of fanLeaves(MAX_FAN_LEAVES)) {
      const rad = (Math.abs(leaf.rotate) * Math.PI) / 180;
      const reachOfLeaf = 0.5 * Math.cos(rad) + Math.sin(rad) - 0.5;
      const reachOfCell = reachOfLeaf * LEAF_WIDTH_OF_CELL * leaf.scale;
      expect(reachOfCell).toBeLessThanOrEqual(FAN_ROOM_OF_CELL);
    }
  });

  it('крок повороту лишається таким, під який рахувалось поле', () => {
    // Запобіжник на «підкрутити на око»: зміна кроку без перерахунку поля
    // видно не на картці, а лише коли віяло вже налізло на сусіда.
    expect(FAN_STEP_DEG).toBe(7.5);
    expect(MAX_FAN_LEAVES).toBe(4);
  });

  it('відʼємна чи дробова кількість не ламає розкладку', () => {
    expect(fanLeaves(-3)).toEqual([]);
    expect(fanLeaves(2.7)).toHaveLength(2);
  });
});

describe('пропорції кадру в альбомі', () => {
  it('те саме фото завжди тієї самої форми', () => {
    expect(photoAspect(7)).toBe(photoAspect(7));
  });

  it('форм справді кілька, а не одна', () => {
    // Однакові квадрати дають каталог товарів, а не альбом.
    const shapes = new Set(Array.from({ length: 200 }, (_v, i) => photoAspect(i + 1)));
    expect(shapes.size).toBeGreaterThanOrEqual(3);
  });

  it('усі форми придатні для CSS aspect-ratio', () => {
    for (let id = 1; id <= 200; id += 1) {
      expect(photoAspect(id)).toBeGreaterThan(0);
      expect(Number.isFinite(photoAspect(id))).toBe(true);
    }
  });
});

describe('розкладка альбому', () => {
  const photos = (count: number) => Array.from({ length: count }, (_v, i) => ({ id: i + 1 }));

  it('жодне фото не загубилось і не подвоїлось', () => {
    for (const count of [0, 1, 2, 3, 7, 10]) {
      const lanes = albumColumns(photos(count));
      const flat = lanes.flat().map((p) => p.id);
      expect(flat).toHaveLength(count);
      expect(new Set(flat).size).toBe(count);
    }
  });

  it('перші два кадри стають ПОРУЧ, а не один під одним', () => {
    /*
     * Заради чого колонки набираються тут, а не через `column-count`.
     * Обидва CSS-механізми розкладають по вертикалі: перше фото опиняється
     * над другим, і хронологія, яку пара щойно склала руками, читається
     * зигзагом.
     */
    const lanes = albumColumns(photos(2));
    expect(lanes[0]).toHaveLength(1);
    expect(lanes[1]).toHaveLength(1);
    expect(lanes[0]![0]!.id).toBe(1);
    expect(lanes[1]![0]!.id).toBe(2);
  });

  it('колонки не розходяться по висоті', () => {
    // Жадібний набір: наступний кадр іде в коротшу колонку. Якби він ішов
    // по черзі, колонка з високими кадрами звисала б на пів екрана.
    const lanes = albumColumns(photos(9));
    const height = (lane: { id: number }[]) =>
      lane.reduce((sum, p) => sum + 1 / photoAspect(p.id), 0);
    expect(Math.abs(height(lanes[0]!) - height(lanes[1]!))).toBeLessThan(1.4);
  });

  it('одне фото не лишає порожньої колонки в розмітці', () => {
    const lanes = albumColumns(photos(1));
    expect(lanes[0]).toHaveLength(1);
    expect(lanes[1]).toHaveLength(0);
  });

  it('порожній альбом дає порожні колонки, а не виняток', () => {
    expect(albumColumns([])).toEqual([[], []]);
  });

  it('кількість колонок задається ззовні — на широкому екрані їх три', () => {
    const lanes = albumColumns(photos(6), 3);
    expect(lanes).toHaveLength(3);
    expect(lanes.flat()).toHaveLength(6);
  });

  it('вироджена кількість колонок не ділить на нуль', () => {
    expect(albumColumns(photos(3), 0)).toHaveLength(1);
  });
});
