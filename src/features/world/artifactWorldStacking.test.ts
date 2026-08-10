import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// ============================================================
// Порядок накладання оболонки: модалка над доком.
// ------------------------------------------------------------
// Не стиль, а працездатність. Коли світ переїхав в оболонку, `.content` і
// `.bottom-nav` стали сусідами з однаковим z-index — і `.modal-overlay`, який
// має 200, опинився замкнений у стековому контексті `.content` зі стелею 1.
// При рівності виграє той, хто далі в розмітці, тобто док. Наслідок:
// «Скасувати» в аркушах «Скарбнички» й «Планів» неможливо натиснути —
// перехоплює `<a class="nav-btn">`.
//
// Знайшов це браузерний набір; тут інваріант тримається дешевше, ніж
// п'ятнадцятихвилинним прогоном.
// ============================================================

const CSS = readFileSync(
  join(__dirname, '../../../src/features/world/artifactWorld.css'),
  'utf8',
).replace(/\/\*[\s\S]*?\*\//g, '');

describe('shell stacking', () => {
  it('puts the content and the chrome above the world', () => {
    // Сама причина, через яку блок узагалі існує: без нього світ і вміст
    // ділять один контекст, і порядок вирішує те, хто кого імпортує.
    expect(CSS).toMatch(/\.app-shell > \.content,[\s\S]*?z-index: 1;/);
  });

  it('never lets the dock paint over an open modal', () => {
    // Правило мусить бути загальним: вішліст мав власне, і рівно тому вада
    // жила в усіх інших модулях непоміченою.
    const rule = /\.app-shell:has\(> \.content \.modal-overlay\) > \.bottom-nav \{([^}]*)\}/.exec(CSS);
    expect(rule).not.toBeNull();
    expect(rule![1]).toMatch(/z-index:\s*0/);
    // Мало опустити шар: док лишався б прозорою пасткою для дотиків саме там,
    // де в аркушів стоять кнопки.
    expect(rule![1]).toMatch(/pointer-events:\s*none/);
  });
});
