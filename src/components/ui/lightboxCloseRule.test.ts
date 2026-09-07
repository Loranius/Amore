// ============================================================
// Хрестик лайтбокса стоїть на ФОТО, а не в кутку екрана.
// ------------------------------------------------------------
// ЩО ЦЕ СТЕРЕЖЕ. `.wl-lb-close` був `position: absolute` від самої
// підкладки, тобто від в'юпорта. Знімок лежить по центру, тож на
// телефоні між кнопкою й фото лишалась половина екрана: хрестик
// опинявся над вкладками сторінки, яка просвічує крізь підкладку, і
// читався як щось чуже, що з'їхало набік. Власник надіслав саме такий
// кадр.
//
// Вада мовчазна: кнопка працює, тест на поведінку її не побачить, а на
// вузькому знімку (портрет на весь екран) вона навіть може випадково
// опинитись близько до кута фото. Тому перевіряється БУДОВА: точка
// відліку — рамка, яка стискається до знімка.
// ============================================================
import { readFileSync } from 'node:fs';
import postcss, { type Rule } from 'postcss';
import { describe, expect, it } from 'vitest';

const CSS = readFileSync('src/index.css', 'utf8');
const LIGHTBOX = readFileSync('src/components/ui/Lightbox.tsx', 'utf8');

/*
 * Розбір лінивий і всередині тесту, як у `sidebarRule.test.ts`: на
 * зіпсованому CSS postcss кидає, і збій на рівні модуля перетворив би це
 * на «no tests» замість імені файла з рядком.
 */
function rule(selector: string): Rule | null {
  let found: Rule | null = null;
  postcss.parse(CSS, { from: 'src/index.css' }).walkRules((candidate) => {
    if (candidate.selector === selector) found = candidate;
  });
  return found;
}

function decl(selector: string, prop: string): string | null {
  const found = rule(selector);
  if (!found) return null;
  let value: string | null = null;
  found.walkDecls(prop, (declaration) => { value = declaration.value; });
  return value;
}

describe('хрестик лайтбокса', () => {
  it('рахується від рамки знімка, а не від в’юпорта', () => {
    // Рамка мусить бути точкою відліку…
    expect(decl('.wl-lb-frame', 'position')).toBe('relative');
    // …і стискатись рівно до знімка, інакше її кут — знову кут екрана.
    expect(decl('.wl-lb-frame', 'display')).toBe('flex');
    expect(decl('.wl-lb-frame', 'max-width')).toBe('100%');
    expect(decl('.wl-lb-frame', 'max-height')).toBe('100%');
    // А сам хрестик — усередині неї.
    expect(rule('.wl-lb-frame .modal-close')).not.toBeNull();
  });

  it('це ТОЙ САМИЙ хрестик порталу, а не тринадцятий власний', () => {
    /*
     * ADR-0051 звів дванадцять різних хрестиків до одного. Лайтбокс був
     * єдиним місцем, яке лишилось із власним виглядом — квадрат 40px із
     * напівпрозорою білою заливкою.
     */
    expect(LIGHTBOX).toContain('<ModalClose');
    expect(CSS).not.toContain('.wl-lb-close');
    // Форма й поріг дотику приходять зі спільного правила; тут можна
    // перевизначати лише колір і відступ від кута знімка.
    const own = rule('.wl-lb-frame .modal-close');
    const props = own === null ? [] : own.nodes
      .filter((node): node is postcss.Declaration => node.type === 'decl')
      .map((node) => node.prop);
    expect(props.sort()).toEqual(['background', 'box-shadow', 'color', 'right', 'top']);
  });

  it('підкладка тримає безпечні поля, щоб кнопка не пішла під чубчик', () => {
    const padding = decl('.wl-lightbox', 'padding') ?? '';
    expect(padding).toContain('safe-area-inset-top');
    expect(padding).toContain('safe-area-inset-bottom');
  });
});
