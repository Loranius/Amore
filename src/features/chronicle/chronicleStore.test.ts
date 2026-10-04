import { afterEach, describe, expect, it } from 'vitest';
import { closeChronicle, focusChronicle, openChronicle, readChronicle, reportChronicleCamera, resetChronicle, setChronicleAsOf } from './chronicleStore';

// ============================================================
// ADR-0238, власник: «легким зумом та прокрутом об'єкту на 90 градусів від
// поточної позиції в будь-який бік».
// ============================================================

afterEach(() => resetChronicle());

describe('стан хроніки', () => {
  it('відкриття повертає камеру на чверть оберту від ПОТОЧНОГО азимута', () => {
    for (const azimuth of [0.3, -1.2, 2.5]) {
      resetChronicle();
      reportChronicleCamera(azimuth);
      openChronicle();
      expect(readChronicle().open).toBe(true);
      expect(Math.abs(readChronicle().azimuth - azimuth)).toBeCloseTo(Math.PI / 2, 12);
    }
  });

  it('повторний дотик по відкритій хроніці не крутить камеру вдруге', () => {
    reportChronicleCamera(0.4);
    openChronicle();
    const first = readChronicle().azimuth;
    reportChronicleCamera(first);
    openChronicle();
    expect(readChronicle().azimuth).toBe(first);
  });

  it('та сама дата повзунка не скидає обраний запис (регресія: фокус губився після вибору)', () => {
    openChronicle();
    const anchor = { point: [0, 1, 0] as [number, number, number], space: 'object' as const, zoom: 0.5 };
    focusChronicle({ key: 'plans:1', anchor }, 'plans');
    setChronicleAsOf(null);
    expect(readChronicle().focus?.key).toBe('plans:1');
    expect(readChronicle().kind).toBe('plans');
  });

  it('закриття повертає звичайний кадр і сьогоднішню дату', () => {
    openChronicle();
    setChronicleAsOf('2024-01-01');
    expect(readChronicle().asOf).toBe('2024-01-01');
    closeChronicle();
    expect(readChronicle()).toMatchObject({ open: false, asOf: null, focus: null, kind: null });
  });
});
