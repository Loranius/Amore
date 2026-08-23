import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  VERDICT_DEAD_ZONE_PX,
  VERDICT_FULL_PX,
  VERDICT_MAX_TINT,
  activeVerdict,
  verdictProgress,
  verdictTint,
} from './swipeFeedback';
import { SWIPE_VERDICTS, VERDICT_BY_DIRECTION } from './swipeDirections';

describe('який вердикт станеться, якщо відпустити', () => {
  it('мале тремтіння не рахується за жест', () => {
    // Без мертвої зони картка блимала кольором від кожного дотику —
    // зокрема від тапу, який відкриває деталі й свайпом не є.
    expect(activeVerdict(0, 0)).toBeNull();
    expect(activeVerdict(VERDICT_DEAD_ZONE_PX - 1, 0)).toBeNull();
    expect(activeVerdict(0, -(VERDICT_DEAD_ZONE_PX - 1))).toBeNull();
  });

  it('вертикаль і горизонталь розводяться перевагою більшої осі', () => {
    expect(activeVerdict(0, -80)).toBe('up');
    expect(activeVerdict(0, 80)).toBe('down');
    expect(activeVerdict(-80, 0)).toBe('left');
    expect(activeVerdict(80, 0)).toBe('right');
  });

  it('на діагоналі перемагає рівно один напрям', () => {
    /*
     * Головна вимога цього модуля. Раніше прозорість кожного оверлея
     * рахувалась зі своєї осі незалежно, тож рух під 45° підсвічував
     * ДВА вердикти різними кольорами водночас — хоча відпускання
     * пальця дає один. Тепер підказка обіцяє саме те, що станеться.
     */
    const directions = SWIPE_VERDICTS.map((v) => v.direction);
    for (const [dx, dy] of [[70, -60], [-70, -60], [70, 60], [-70, 60], [60, -70]]) {
      const lit = directions.filter((d) => verdictProgress(dx!, dy!, d) > 0);
      expect(lit, `рух ${dx},${dy}`).toHaveLength(1);
      expect(lit[0]).toBe(activeVerdict(dx!, dy!));
    }
  });

  it('рівна діагональ не лишає картку без вердикту', () => {
    // |x| === |y| — горизонталь програє (строга нерівність), тож
    // вердикт вертикальний. Головне, що він Є: мовчазна картка на
    // рівно 45° читалась би як «жест не працює».
    expect(activeVerdict(60, -60)).toBe('up');
    expect(activeVerdict(60, 60)).toBe('down');
  });
});

describe('як швидко картка набирає колір', () => {
  it('у мертвій зоні кольору немає', () => {
    expect(verdictProgress(0, -VERDICT_DEAD_ZONE_PX, 'up')).toBe(0);
  });

  it('на порозі повноти колір повний', () => {
    expect(verdictProgress(0, -VERDICT_FULL_PX, 'up')).toBe(1);
  });

  it('далі порога не перевищує повноти', () => {
    expect(verdictProgress(0, -900, 'up')).toBe(1);
    expect(verdictTint(0, -900, 'up')).toBe(VERDICT_MAX_TINT);
  });

  it('між порогами росте, а не стрибає', () => {
    const middle = (VERDICT_DEAD_ZONE_PX + VERDICT_FULL_PX) / 2;
    const p = verdictProgress(0, -middle, 'up');
    expect(p).toBeGreaterThan(0.4);
    expect(p).toBeLessThan(0.6);
  });

  it('заливка лишає постер видимим', () => {
    // Стеля не одиниця за призначенням: на суцільній плямі пара
    // перестає бачити, ЩО саме позначає.
    expect(VERDICT_MAX_TINT).toBeLessThan(1);
    expect(verdictTint(0, -VERDICT_FULL_PX, 'up')).toBeLessThan(1);
  });

  it('поріг повноти більший за поріг зриву жесту', () => {
    // OFFSET_T у `SwipeCardView` = 80. Коли картка вже майже зірвалась,
    // колір мусить бути повним, а не «майже повним».
    const CARD = readFileSync(
      fileURLToPath(new URL('./SwipeCardView.tsx', import.meta.url)),
      'utf8',
    );
    const offsetT = /const OFFSET_T = (\d+)/.exec(CARD);
    expect(offsetT).not.toBeNull();
    expect(VERDICT_FULL_PX).toBeGreaterThan(Number(offsetT![1]));
  });
});

describe('опис напрямів — один на модуль', () => {
  it('усі чотири напрями описані рівно раз', () => {
    expect(SWIPE_VERDICTS).toHaveLength(4);
    expect(new Set(SWIPE_VERDICTS.map((v) => v.direction)).size).toBe(4);
  });

  it('свайп угору називається «Переглянуто»', () => {
    // Так це називає власник. Доки опис жив у двох місцях, картка
    // казала «Подивились», а кнопка — своє.
    expect(VERDICT_BY_DIRECTION.up.label).toBe('Переглянуто');
  });

  it('картка й кнопки беруть підпис із одного джерела', () => {
    const card = readFileSync(
      fileURLToPath(new URL('./SwipeCardView.tsx', import.meta.url)),
      'utf8',
    );
    const deck = readFileSync(
      fileURLToPath(new URL('./SwipeDeck.tsx', import.meta.url)),
      'utf8',
    );
    for (const source of [card, deck]) {
      expect(source).toContain('SWIPE_VERDICTS');
      // Жодного підпису літералом — інакше копії розійдуться знову.
      // Коментарі не рахуються: вони пояснюють саме цю історію, і
      // згадка старої назви в поясненні — не друга копія.
      const withoutComments = source
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^\s*\/\/.*$/gm, '');
      expect(withoutComments).not.toContain('Подивились');
      expect(withoutComments).not.toContain('Переглянуто');
    }
  });

  it('кожен напрям має власний токен кольору', () => {
    const vars = SWIPE_VERDICTS.map((v) => v.colourVar);
    expect(new Set(vars).size).toBe(4);
    const css = readFileSync(
      fileURLToPath(new URL('../../index.css', import.meta.url)),
      'utf8',
    );
    for (const name of vars) expect(css).toContain(`${name}:`);
  });
});

describe('вердикт заливає картку, а не край', () => {
  it('оверлей розтягнутий на всю картку й центрує підпис', () => {
    const css = readFileSync(
      fileURLToPath(new URL('../../index.css', import.meta.url)),
      'utf8',
    );
    const at = css.indexOf('.swipe-verdict {');
    expect(at).toBeGreaterThan(-1);
    const rule = css.slice(at, css.indexOf('}', at));
    expect(rule).toContain('inset: 0');
    expect(rule).toContain('place-items: center');
    // Стара пігулка, прибита до краю, більше не існує.
    expect(css).not.toContain('.swipe-overlay');
  });
});
