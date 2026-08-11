import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// ============================================================
// Горизонтальний жест у вішлісті має рівно одного власника — кулю.
// ------------------------------------------------------------
// Вада, яку знайшов власник на живому порталі: проводиш пальцем по бажанню
// зліва направо, щоб штовхнути кулю, — а портал натомість відкриває сусідню
// вкладку. У своїх бажаннях свайп відкривав Лєнині, у Лєниних — спільні.
//
// Причина була не в порозі й не в напрямку. Свайп слухав `pointerdown` на
// ВІКНІ й виключав лише навігацію та аркуші (`.wl-world-nav`, `.bottom-nav`,
// `.modal-overlay`, `.wl-cloud-sheet-overlay`) — сфери у тому списку не було й
// бути не могло, бо їх тоді ще не існувало. Тягнення кулі проходило повз
// фільтр цілком.
//
// Полагодити «додаванням `.wl-sphere` у виняток» було б неправильно: двох
// власників одного горизонтального жесту на одному екрані не буває, а куля —
// це те, з чим справді граються. Тому жест прибрано, а не звужено.
//
// Перевіряється сам файл: поведінки, якої немає, не можна відрендерити й
// клікнути. Зникнення пропса `onTabChange` — теж частина гарантії: у
// компонента більше немає чим перемкнути вкладку.
// ============================================================

const ROOT = join(__dirname, '../../..');
const NAV = readFileSync(join(ROOT, 'src/features/wishlist/WishlistWorldNav.tsx'), 'utf8');
const CODE = NAV.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

describe('a horizontal drag in the wishlist belongs to the sphere', () => {
  it('has no window-level pointer listener that could steal it', () => {
    // Саме «на вікні» й було вадою: обробник ловив жест, що почався де завгодно,
    // зокрема на кулі.
    expect(CODE).not.toMatch(/addEventListener\(\s*'pointer/);
    expect(CODE).not.toMatch(/window\.addEventListener/);
  });

  it('cannot change the tab at all, having no way to say so', () => {
    // Не «не викликає», а «не має чим викликати»: пропса немає в типі.
    expect(CODE).not.toMatch(/onTabChange/);
    expect(NAV).not.toMatch(/onTabChange\??:/);
  });

  it('leaves the sheet its own buttons, so nothing lived only in the gesture', () => {
    // §48: жодна дія не існує лише через жест. Свайп перемикав вкладки —
    // вкладки лишились кнопками вгорі, а стан і вигляд — кнопками тут.
    expect(CODE).toMatch(/onArchiveChange/);
    expect(CODE).toMatch(/onViewChange/);
  });

  it('keeps no styles for the swipe hint that no longer appears', () => {
    // Підпис «Лєни · 3 бажання» показувався тільки після свайпу. Стилі, що
    // пережили свою поведінку, — найтихіший різновид мертвого коду.
    const css = readFileSync(join(ROOT, 'src/features/wishlist/wishlistCrystalWorld.css'), 'utf8');
    expect(css).not.toMatch(/wl-world-hint/);
  });
});
