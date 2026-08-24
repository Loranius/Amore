import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

// ============================================================
// Одна смуга дій на всі модалки.
// ------------------------------------------------------------
// **Порахнуто по всіх 26 модалках порталу.** Смуг було вісім різних:
// `.modal-actions` (більшість), `.cal-entry-actions`,
// `.plan-create-actions`, `.shopping-edit-actions`,
// `.wl-archive-gift-actions`, `.mm-map-sheet-actions`,
// `.wl-cloud-sheet-actions`. Разом із ними розходились кнопки:
// скасування писали трьома словниками (`.btn-ghost`, `.btn-secondary`,
// власні `-cancel`), головну дію — двома (`.btn`, `.btn-primary`).
//
// **`.btn-primary` при цьому не мав ЖОДНОГО правила в CSS.** Два місця
// носили клас, який нічого не стилізує, тобто це були неоформлені
// браузерні кнопки.
//
// Наслідок бачила пара, а не розробник: у кожній модалці «зберегти»
// опинялась іншого розміру й в іншому місці, і щоразу її доводилось
// шукати заново.
// ============================================================

const FEATURES = join(__dirname, '..', '..', 'features');

/**
 * Композер спогаду — названий виняток.
 *
 * Його «Готово» стоїть УГОРІ праворуч, бо це повноекранний блокнот, і
 * саме так стоїть телефонний блокнот. Це конвенція платформи, яку пара
 * уже знає, а не розбіжність порталу.
 */
const TOP_BAR_EXCEPTIONS = ['memories/MomentComposer.tsx'];

function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (match) => match.replace(/[^\n]/g, ' '))
    .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, '')
    .replace(/(^|[^:])\/\/[^\n]*/g, (_match, lead: string) => lead);
}

function sourceFiles(root: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(root)) {
    const path = join(root, entry);
    if (statSync(path).isDirectory()) { out.push(...sourceFiles(path)); continue; }
    if (/\.tsx$/.test(entry) && !/\.test\./.test(entry)) out.push(path);
  }
  return out;
}

const rel = (path: string) => relative(FEATURES, path).split(sep).join('/');

describe('смуга дій модалки', () => {
  it('`.btn-primary` не повертається: такого правила в CSS немає', () => {
    /*
     * Клас-привид найгірший саме тим, що виглядає навмисним. Кнопка з
     * ним не має ні кольору, ні розміру, ні тіла — і саме тому її ніхто
     * не помічав як ваду.
     */
    const offenders: string[] = [];
    for (const path of sourceFiles(FEATURES)) {
      if (/btn-primary/.test(stripComments(readFileSync(path, 'utf8')))) {
        offenders.push(rel(path));
      }
    }
    expect(offenders).toEqual([]);
  });

  it('модалки не заводять власних смуг дій', () => {
    const dead = [
      'cal-entry-actions"',
      'plan-create-actions"',
      'shopping-edit-actions',
      'wl-archive-gift-actions"',
      'mm-map-sheet-actions"',
    ];
    const offenders: string[] = [];
    for (const path of sourceFiles(FEATURES)) {
      const source = stripComments(readFileSync(path, 'utf8'));
      for (const name of dead) {
        // Модифікатор поруч із каноном дозволений; самостійна смуга — ні.
        const standalone = new RegExp(`className="${name.replace('"', '')}"`);
        if (standalone.test(source)) offenders.push(`${rel(path)}: ${name}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('канон задає розмір кнопок, а не кожна модалка окремо', () => {
    const index = readFileSync(join(FEATURES, '..', 'index.css'), 'utf8');
    const rule = index.slice(index.indexOf('.modal-actions .btn,'));
    expect(rule.slice(0, rule.indexOf('}'))).toMatch(/min-height:\s*48px/);
  });

  it('виняток із верхньою смугою названий, а не забутий', () => {
    // Якщо композер колись переїде на канон — цей тест має впасти, щоб
    // виняток прибрали свідомо, а не лишили висіти в списку.
    for (const name of TOP_BAR_EXCEPTIONS) {
      const source = stripComments(readFileSync(join(FEATURES, name), 'utf8'));
      expect(source).toMatch(/className="mm-save"/);
      expect(source).not.toMatch(/className="modal-actions"/);
    }
  });
});

// ============================================================
// Заголовок, кільце фокуса й смуга, що не їде за край.
// ------------------------------------------------------------
// Три канони, кожен народжений з виміряної вади (ADR-0050). Тести
// сторожать саме текст правил у CSS: вони не малюють нічого, тож
// перевіряють єдине, що можна перевірити без браузера, — що рецепт
// узагалі є і що модулі не завели своїх.
// ============================================================

const INDEX_CSS = join(__dirname, '..', '..', 'index.css');

/** Одне правило CSS за селектором, без коментарів. */
function ruleBody(css: string, selector: string): string | null {
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const at = clean.indexOf(`\n${selector} {`);
  if (at === -1) return null;
  const open = clean.indexOf('{', at);
  const close = clean.indexOf('}', open);
  return clean.slice(open + 1, close);
}

describe('канони модалки', () => {
  it('заголовок модалки має вагу й кегль, а не саме лише margin', () => {
    /*
     * Виміряно на живому екрані вибору міста ДО зміни: «Де ви зараз?»
     * обчислювалось `font-size: 16px; font-weight: 400` — тобто
     * заголовок був невідрізним від підпису поля під ним. Увесь
     * портальний рецепт складався з `.modal-title { margin: 0 }`.
     */
    const body = ruleBody(readFileSync(INDEX_CSS, 'utf8'), '.modal-title');
    expect(body, '.modal-title мусить мати правило').not.toBeNull();
    expect(body).toMatch(/font-size:\s*20px/);
    expect(body).toMatch(/font-weight:\s*800/);
  });

  it('кільце фокуса є спільним і бере акцент порталу', () => {
    /*
     * Виміряно: поле з `autoFocus` у вибиранні міста давало
     * `outline: rgb(229, 151, 0) auto 1px` — системне кільце Chromium.
     * Власне кільце існувало, але вісьмома окремими правилами для
     * восьми елементів; усе інше лишалось із системним.
     */
    const css = readFileSync(INDEX_CSS, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    const canon = /:where\(a, button, input, select, textarea, summary, \[tabindex\]\):focus-visible \{[^}]*outline:\s*2px solid var\(--accent\)/;
    expect(css, 'спільне правило :focus-visible зникло').toMatch(canon);
  });

  it('смуга дій липне до низу аркуша, що гортається', () => {
    /*
     * Виміряно на перегляді рецепта: аркуш починався на y=69, а
     * «Закрити» й «В покупки» — на y=1558 при вікні 915. Кнопки за 600
     * пікселів під екраном, і єдиний очевидний вихід — тап повз
     * модалку.
     */
    const body = ruleBody(readFileSync(INDEX_CSS, 'utf8'), '.modal-sheet > .modal-actions');
    expect(body, 'липка смуга дій зникла').not.toBeNull();
    expect(body).toMatch(/position:\s*sticky/);
  });

  it('модулі не заводять власного заголовка модалки з тим самим рецептом', () => {
    /*
     * Дві латки вже були — вішліст дописував вагу 800, аркуш плану
     * кегль 20px — і саме вони склались у канон. Копія канону в модулі
     * не змінює нічого сьогодні й тихо розходиться завтра.
     *
     * Власний заголовок дозволений, коли він ІНШИЙ: редактор бажання —
     * повноекранний аркуш із дисплейною назвою на Fredoka 26–32px.
     */
    const cssFiles: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) walk(full);
        else if (entry.endsWith('.css')) cssFiles.push(full);
      }
    };
    walk(FEATURES);

    const offenders: string[] = [];
    for (const file of cssFiles) {
      const clean = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
      for (const match of clean.matchAll(/\.modal-title\s*\{([^}]*)\}/g)) {
        const body = match[1]!;
        const onlyCanon = /font-size:\s*20px/.test(body) || /font-weight:\s*800/.test(body);
        const saysSomethingElse = /font-family|clamp\(/.test(body);
        if (onlyCanon && !saysSomethingElse) offenders.push(rel(file));
      }
    }
    expect(offenders, 'ці файли повторюють канон замість того, щоб на нього спертись').toEqual([]);
  });
});

describe('паддінг аркуша названий, а не вписаний', () => {
  it('липка смуга рахує відступи з `--sheet-pad`, а не з числа', () => {
    /*
     * Смуга дій виходить за паддінг аркуша від'ємними полями, щоб лягти
     * від краю до краю. Спершу там стояло число 22 — і на першому ж
     * аркуші з іншим паддінгом розійшлось: редактор бажання має 24px, і
     * смуга виміряно вилазила за аркуш (397px у 387px).
     */
    const body = ruleBody(readFileSync(INDEX_CSS, 'utf8'), '.modal-sheet > .modal-actions');
    expect(body).not.toBeNull();
    expect(body, 'від’ємні поля мусять читати токен').toMatch(/margin:[^;]*var\(--sheet-pad\)/);
    expect(body, 'жодного вписаного паддінга').not.toMatch(/margin:[^;]*-\d+px/);
  });

  it('аркуш зі своїм паддінгом перевизначає й токен', () => {
    /*
     * Інакше смуга рахує від чужого числа — тихо, бо CSS не скаржиться.
     * Перевіряються лише правила, які МІНЯЮТЬ горизонтальний паддінг:
     * `padding-top`/`padding-bottom` смуги не стосуються.
     */
    const cssFiles: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) walk(full);
        else if (entry.endsWith('.css')) cssFiles.push(full);
      }
    };
    walk(FEATURES);
    cssFiles.push(INDEX_CSS);

    const offenders: string[] = [];
    for (const file of cssFiles) {
      const clean = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
      for (const match of clean.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
        const [, rawSelector, declarations] = match as unknown as [string, string, string];
        const selector = rawSelector.trim();
        // Правило САМОГО аркуша, а не чогось усередині: селектор має ним
        // закінчуватись. `.wm-wish-editor .wm-title-field input` — це поле
        // у формі, і його паддінг смуги дій не стосується.
        const isSheetItself = /\.(?:modal-sheet|wm-wish-editor)(?::[a-z-]+)?$/.test(selector);
        if (!isSheetItself) continue;
        const setsSidePadding = /(^|[;\s])padding(-inline|-left|-right)?\s*:/.test(declarations);
        if (!setsSidePadding) continue;
        if (declarations.includes('--sheet-pad')) continue;
        offenders.push(`${rel(file)} — ${selector}`);
      }
    }
    expect(offenders, 'ці аркуші міняють паддінг, не назвавши --sheet-pad').toEqual([]);
  });
});

// ============================================================
// Хрестик — один на всі модалки.
// ------------------------------------------------------------
// Стан до зміни: `shopping-edit-close` (коло 38px), `gift-memory-close`
// (квадрат 40px, текстовий «×») у п'яти модалках вішліста, і ЖОДНОГО
// хрестика в дванадцяти інших. Власник указав на перший і попросив його
// скрізь (ADR-0051).
// ============================================================

/** Модалки, у яких хрестика немає навмисно. */
const NO_CLOSE_EXCEPTIONS = [
  // Підтвердження — це питання з двома відповідями. Третя кнопка, яка
  // не значить ні «так», ні «ні», робить діалог двозначним саме там, де
  // двозначність найдорожча: перед видаленням.
  'providers/ConfirmProvider.tsx',
];

describe('хрестик модалки', () => {
  it('рецепт живе в index.css, а не в модулях', () => {
    const body = ruleBody(readFileSync(INDEX_CSS, 'utf8'), '.modal-close');
    expect(body, '.modal-close мусить мати правило').not.toBeNull();
    expect(body).toMatch(/position:\s*absolute/);
    expect(body).toMatch(/width:\s*38px/);
    expect(body).toMatch(/border-radius:\s*50%/);
  });

  it('модулі не тримають власних хрестиків', () => {
    /*
     * Два словники вже розійшлись одного разу. Клас із власною назвою —
     * це нова гілка, яка сьогодні виглядає так само, а завтра ні.
     */
    const cssFiles: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) walk(full);
        else if (entry.endsWith('.css')) cssFiles.push(full);
      }
    };
    walk(FEATURES);

    const offenders: string[] = [];
    for (const file of cssFiles) {
      const clean = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
      for (const match of clean.matchAll(/\.([a-z0-9-]*-close)\s*[,{]/g)) {
        const name = match[1]!;
        // Хрестики поза модалками — це інші речі: закрити повноекранну
        // карту, згорнути панель шляху, вийти з меню «Ще».
        if (['modal-close', 'wt-embed-close', 'jn-details-close', 'more-menu-close', 'wl-lb-close'].includes(name)) continue;
        offenders.push(`${rel(file)} — .${name}`);
      }
    }
    expect([...new Set(offenders)], 'модалка завела власний хрестик замість .modal-close').toEqual([]);
  });

  it('кожна модалка порталу має спосіб закритись угорі', () => {
    /*
     * Дванадцять модалок не мали хрестика взагалі, і єдиним виходом
     * угорі був тап повз аркуш — жест, якого ніхто не показує.
     */
    const withoutClose: string[] = [];
    for (const file of sourceFiles(FEATURES)) {
      const source = stripComments(readFileSync(file, 'utf8'));
      if (!source.includes('modal-sheet')) continue;
      if (source.includes('<ModalClose')) continue;
      withoutClose.push(rel(file));
    }
    expect(withoutClose, 'ці модалки лишились без хрестика').toEqual([]);
    // Виняток перевіряється окремо, щоб він не міг зникнути мовчки.
    expect(NO_CLOSE_EXCEPTIONS).toContain('providers/ConfirmProvider.tsx');
  });
});
