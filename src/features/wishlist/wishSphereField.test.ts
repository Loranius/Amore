import { describe, expect, it } from 'vitest';
import {
  buildWishSphereField,
  DEFAULT_MONARCH_KEEP_OUT,
  monarchKeepOut,
  wishSphereBaseDiameter,
  wishSphereCapacity,
  type WishSphereFieldInput,
  type WishSpherePlacement,
} from './wishSphereField';

// ============================================================
// Сузір'я бажань — вимоги власника до просторової композиції вішліста.
// ------------------------------------------------------------
// Тримають рівно те, що названо вимогою: жодної сітки, стабільні позиції між
// перемальовуваннями, сфери меншi за монарха й такі, що його не перекривають.
// Краса розкладки — смак; ці властивості — ні.
// ============================================================

function subjects(count: number, offset = 0) {
  return Array.from({ length: count }, (_, index) => ({ id: offset + index + 1 }));
}

const PHONE: WishSphereFieldInput = {
  subjects: subjects(7),
  field: { width: 412, height: 915 },
  quality: 'high',
};

function diameters(board: readonly WishSpherePlacement[]): number[] {
  return board.map((sphere) => sphere.diameter);
}

describe('wish sphere constellation', () => {
  it('puts the same wish in the same place on every render', () => {
    // Сфера, що стрибає на кожен rerender, — шум, а не сузір'я. Позиція
    // виводиться з id бажання, тож вона переживає і перемальовування, і зміну
    // сусідів.
    const first = buildWishSphereField(PHONE);
    for (let repeat = 0; repeat < 5; repeat += 1) {
      expect(buildWishSphereField(PHONE)).toEqual(first);
    }
    // Інші бажання — інші місця: розкладка не є нумерацією за порядком.
    const shifted = buildWishSphereField({ ...PHONE, subjects: subjects(7, 100) });
    expect(shifted.map((sphere) => sphere.x)).not.toEqual(first.map((sphere) => sphere.x));
  });

  it('is a constellation, not a grid', () => {
    // Вимога сформульована прямо: «item item / monarch / item item» треба
    // прибрати. Сітка видає себе повторюваними координатами — у сузір'ї
    // кожна сфера має власні.
    const board = buildWishSphereField({ ...PHONE, subjects: subjects(12) });
    // Сітка видає себе тим, що координат мало: дванадцять плиток стоять на
    // трьох x і чотирьох y. Тут майже кожна сфера має власні обидві.
    const columns = new Set(board.map((sphere) => sphere.x.toFixed(2)));
    const rows = new Set(board.map((sphere) => sphere.y.toFixed(2)));
    expect(columns.size).toBeGreaterThan(board.length * 0.75);
    expect(rows.size).toBeGreaterThan(board.length * 0.75);
  });

  it('leaves the monarch its silhouette', () => {
    // Монарх у вішлісті — фон, але фон, який має лишатись упізнаваним. Жодна
    // сфера не заходить у його силует.
    for (const count of [1, 3, 7, 12, 16]) {
      const board = buildWishSphereField({ ...PHONE, subjects: subjects(count) });
      for (const sphere of board) {
        const halfX = (sphere.diameter / 2) / PHONE.field.width;
        expect(
          Math.abs(sphere.x - DEFAULT_MONARCH_KEEP_OUT.centreX) - halfX,
          `${count}/${sphere.id}`,
        ).toBeGreaterThanOrEqual(
          monarchKeepOut(DEFAULT_MONARCH_KEEP_OUT, sphere.y) - 1e-9,
        );
      }
    }
  });

  it('keeps every sphere inside the field, clear of the tabs and the dock', () => {
    for (const field of [
      { width: 412, height: 915 },
      { width: 360, height: 640 },
      { width: 1280, height: 800 },
    ]) {
      const board = buildWishSphereField({ ...PHONE, subjects: subjects(12), field });
      for (const sphere of board) {
        const halfX = (sphere.diameter / 2) / field.width;
        const halfY = (sphere.diameter / 2) / field.height;
        const label = `${field.width}x${field.height}/${sphere.id}`;
        expect(sphere.x - halfX, label).toBeGreaterThan(0);
        expect(sphere.x + halfX, label).toBeLessThan(1);
        expect(sphere.y - halfY, label).toBeGreaterThan(0.1);
        expect(sphere.y + halfY, label).toBeLessThan(0.92);
      }
    }
  });

  it('never stacks two spheres in one place', () => {
    // Змінена вимога. Раніше тут вимагалась повна відсутність дотику, і
    // розкладка це тримала — поки кулі були дрібні. Відколи розмір означає
    // вагу мрії, вони більші, і дванадцять великих куль у кадр без жодного
    // дотику вже не завжди стають.
    //
    // Гарантію перебрала на себе фізика: `stepWishSpheres` розсовує будь-яке
    // перекриття за частку секунди (див. `wishSphereMotion.test.ts`), і саме
    // там вона тепер під тестом. Розкладці лишається не ставити двох в одну
    // точку — інакше перший же кадр вистрілив би ними в різні боки.
    const board = buildWishSphereField({ ...PHONE, subjects: subjects(12) });
    for (const a of board) {
      for (const b of board) {
        if (a === b) continue;
        const gap = Math.hypot(
          (a.x - b.x) * PHONE.field.width,
          (a.y - b.y) * PHONE.field.height,
        );
        expect(gap, `${a.id}~${b.id}`).toBeGreaterThan(Math.max(a.diameter, b.diameter) / 2);
      }
    }
  });

  it('sizes a sphere by how much the wish is wanted', () => {
    // Вимога власника, сформульована прямо: приємне — маленька куля, бажане —
    // середня, жадане — велика. Порівняння йде на одному й тому самому id,
    // тобто на одному шарі глибини: інакше вимірювався б шар, а не вага.
    const of = (priority: 'high' | 'medium' | 'low') =>
      buildWishSphereField({ ...PHONE, subjects: [{ id: 7, priority }] })[0]!.diameter;
    expect(of('high')).toBeGreaterThan(of('medium'));
    expect(of('medium')).toBeGreaterThan(of('low'));
    // Помітно з першого погляду, але найлегше бажання не стає крихтою.
    expect(of('high') / of('low')).toBeGreaterThan(1.25);
    expect(of('high') / of('low')).toBeLessThan(1.6);
  });

  it('is bigger again, and still nowhere near the monarch', () => {
    // Розмір піднімався двічі, обидва рази з живого екрана: 44–64 → «занадто
    // малий», далі → «погано видно саме фото бажання», ще на 20%.
    //
    // Міряються КРАЙНІ значення, а не випадковий набір із дванадцяти. Перша
    // редакція цієї перевірки брала дванадцять бажань і питала, чи всі влізли
    // в межі, — і коли базовий діаметр виріс на 20%, вона лишилась зеленою,
    // хоч найбільша можлива куля межу перетнула: у той набір просто не
    // потрапило жаданого бажання на ближньому шарі. Стеля, якої ніщо не
    // торкається, нічого не стереже.
    //
    // Шар глибини виводиться з id, тож крайні випадки шукаються перебором id.
    const of = (priority: 'high' | 'medium' | 'low', id: number) =>
      buildWishSphereField({ ...PHONE, subjects: [{ id, priority }] })[0]!.diameter;
    const across = (priority: 'high' | 'medium' | 'low') =>
      Array.from({ length: 300 }, (_, index) => of(priority, index + 1));

    const smallest = Math.min(...across('low'));
    const biggest = Math.max(...across('high'));
    // Найменша куля — приємне бажання на дальньому шарі. Раніше таких було 47.
    expect(smallest).toBeGreaterThanOrEqual(58);
    // Сто пікселів — це вже не бажання поруч із артефактом, а другий артефакт.
    expect(biggest).toBeLessThan(100);
    // Крок між сусідніми вагами лишається помітним оку, а не «на волосину».
    expect(Math.min(...across('medium'))).toBeGreaterThan(Math.max(...across('low')));
    expect(Math.min(...across('high'))).toBeGreaterThan(Math.max(...across('medium')));

    // І на широкому екрані теж: розмір іде за меншим боком поля, тож там межа
    // впирається у власну стелю базового діаметра, а не в розмір екрана.
    const wide = buildWishSphereField({
      ...PHONE,
      subjects: subjects(120).map((subject) => ({ ...subject, priority: 'high' as const })),
      field: { width: 1600, height: 900 },
    });
    for (const size of diameters(wide)) expect(size).toBeLessThan(100);
  });

  it('spreads the wishes over three depth layers, delicately', () => {
    const board = buildWishSphereField({ ...PHONE, subjects: subjects(16) });
    const layers = new Set(board.map((sphere) => sphere.layer));
    expect(layers.size).toBeGreaterThan(1);
    const smallest = Math.min(...diameters(board));
    const largest = Math.max(...diameters(board));
    // Різниця між шарами делікатна: це глибина, а не два розміри кнопок.
    expect(largest / smallest).toBeLessThan(1.45);
  });

  it('gives every sphere its own drift, inside the range the owner asked for', () => {
    const board = buildWishSphereField({ ...PHONE, subjects: subjects(12) });
    for (const sphere of board) {
      expect(sphere.driftY).toBeGreaterThanOrEqual(3);
      expect(sphere.driftY).toBeLessThanOrEqual(7);
      expect(sphere.driftX).toBeGreaterThanOrEqual(1);
      expect(sphere.driftX).toBeLessThanOrEqual(4);
      expect(sphere.period).toBeGreaterThanOrEqual(5);
      expect(sphere.period).toBeLessThanOrEqual(9);
    }
    // Несинхронні: спільна фаза перетворила б сузір'я на пульс.
    expect(new Set(board.map((sphere) => sphere.phase)).size).toBe(board.length);
  });

  it('never draws hundreds, and never silently drops the rest without a cap', () => {
    for (const quality of ['high', 'balanced', 'low', 'fallback'] as const) {
      const cap = wishSphereCapacity(quality);
      const board = buildWishSphereField({ ...PHONE, subjects: subjects(400), quality });
      expect(board).toHaveLength(cap);
    }
  });

  it('survives nonsense rather than placing a sphere at infinity', () => {
    const board = buildWishSphereField({
      subjects: [{ id: Number.NaN }, { id: 2 }],
      field: { width: Number.NaN, height: 0 },
      quality: 'high',
    });
    expect(board).toHaveLength(2);
    for (const sphere of board) {
      for (const value of [
        sphere.x, sphere.y, sphere.diameter, sphere.driftX, sphere.driftY,
        sphere.period, sphere.phase,
      ]) {
        expect(Number.isFinite(value)).toBe(true);
      }
    }
    expect(wishSphereBaseDiameter({ width: Number.NaN, height: Number.NaN })).toBeGreaterThan(0);
  });
});
