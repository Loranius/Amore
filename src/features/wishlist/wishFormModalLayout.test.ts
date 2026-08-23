import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const RAW_FORM = readFileSync(join(__dirname, 'WishFormModal.tsx'), 'utf8');

/**
 * Текст без коментарів.
 *
 * Потрібен там, де тест стверджує ВІДСУТНІСТЬ рядка: коментарі в цьому
 * файлі пояснюють, чому саме `'partner'` прибрано, тож без стрипу
 * перевірка ловила б власне пояснення.
 */
const FORM = RAW_FORM
  .replace(/\/\*[\s\S]*?\*\//g, (match) => match.replace(/[^\n]/g, ' '))
  .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, '')
  .replace(/(^|[^:])\/\/[^\n]*/g, (_m, lead) => lead);
const STYLES = readFileSync(join(__dirname, 'wishlistFormSections.css'), 'utf8');
const MOBILE_STYLES = readFileSync(join(__dirname, 'wishlistV3.mobile.css'), 'utf8');

describe('WishFormModal quick-create layout', () => {
  it('keeps the frequent fields visible and optional work collapsed', () => {
    expect(FORM).toContain('className="form-field wm-title-field"');
    expect(FORM).toContain('className="form-field wm-link-field"');
    expect(FORM).toContain('className="wm-photo-summary"');
    expect(FORM).toContain('aria-expanded={photoOpen}');
    expect(FORM).toContain('className="wm-details-summary"');
    expect(FORM).toContain('aria-expanded={detailsOpen}');
    expect(FORM).toContain('{detailsOpen && (');
    expect(FORM).not.toContain('wm-form-section-index');
  });

  it('має канонічну смугу дій, як усі модалки порталу', () => {
    /*
     * **Вимога змінена власником, і попередня була не помилкою.**
     *
     * Тут стояла одна кнопка на всю ширину, і тест закріплював саме це
     * — «одна головна дія замість дубльованого скасування», бо в кутку
     * аркуша вже є хрестик. Аргумент чесний.
     *
     * Але власник попросив, щоб «зберегти / створити / скасувати» в
     * УСІХ модалках були одного розміру, одного кольору й на одному
     * місці. Не всі модалки порталу мають хрестик, тож звести їх до
     * «лише головна дія» неможливо — звести можна лише до пари
     * «скасувати + головна». Отже дублювання з хрестиком — свідома
     * ціна однаковості, а не недогляд.
     */
    const actions = FORM.match(
      /<div className="modal-actions">([\s\S]*?)<\/div>/,
    )?.[1];

    expect(actions).toBeDefined();
    expect(actions?.match(/<button/g)).toHaveLength(2);
    expect(actions).toContain('btn btn-ghost');
    expect(actions).toContain('Скасувати');
    expect(actions).toContain('Створити бажання');
    // Ширину й висоту задає канон в `index.css`, а не власне правило.
    expect(STYLES).not.toMatch(/\.wm-form-actions/);
  });

  it('пара створює лише свої або спільні бажання', () => {
    /*
     * `'partner'` прибрано за рішенням власника: загадувати бажання ЗА
     * іншу людину — це не список бажань, а завдання їй.
     *
     * Друга половина не менш важлива за першу. `owner` рахувався як
     * `scope === 'partner' ? partner.id : me.id`, і працювало це лише
     * тому, що при редагуванні перемикач схований, а `defaultScope`
     * приносив 'partner'. Прибрати варіант і лишити формулу означало б
     * ПРИСВОЮВАТИ собі чуже бажання при кожному редагуванні. Тому
     * власник тепер береться із самого запису.
     */
    expect(FORM).toContain("type Scope = 'me' | 'shared'");
    expect(FORM).not.toContain("'partner'");
    expect(FORM).toContain('owner: item ? item.owner : me.id');
    expect(FORM).toContain("isSecret: scope === 'me' && isSecret");
    expect(FORM).toContain('Видиме партнеру');
    expect(FORM).toContain('Таємне');
  });

  it('обидва перемикачі модалки — той самий сегментний контрол', () => {
    /*
     * Було два різні: «Для кого» — пігулки `TabBar`, «Видимість» — дві
     * власні картки заввишки 74px із рамками й окремим тлом. Два різні
     * перемикачі в одній формі читаються як дві різні системи, а
     * вищий із них ще й додавав модалці пів екрана.
     */
    const pickers = FORM.match(/<TabBar</g) ?? [];
    expect(pickers).toHaveLength(2);
    expect(STYLES).not.toMatch(/wm-visibility-(?:picker|option)/);
  });

  it('keeps accordion cards content-sized inside the scrollable flex modal', () => {
    expect(MOBILE_STYLES).toMatch(
      /\.wm-wish-editor\s*>\s*:is\(\.wm-photo-disclosure,\s*\.wm-details-disclosure\)\s*\{[^}]*flex:\s*0\s+0\s+auto/,
    );
  });
});
