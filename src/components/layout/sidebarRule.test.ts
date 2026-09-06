import { readFileSync } from 'node:fs';
import postcss, { type Declaration, type Rule } from 'postcss';
import { describe, expect, it } from 'vitest';

/*
 * ЩО ЦЕ СТЕРЕЖЕ. На десктопі бічної панелі не було взагалі — видно було
 * саму сцену. Причина не в React і не в z-index: у `.sidebar` всередині
 * `@media (min-width: 900px)` коментар закривався після першого абзацу, і
 * решта прози лишалась голим текстом серед оголошень.
 *
 * Парсер CSS на такому пропускає все до кінця блоку. У збірці від правила
 * лишалось `z-index; padding; background; border-right` — без
 * `display: flex`, без `width` і без `position: relative`. А поза
 * медіа-запитом стоїть `.sidebar { display: none }`, і перекрити його
 * стало нічим.
 *
 * Тобто ПОЯСНЕННЯ ВАДИ З'ЇЛО ЇЇ ВИПРАВЛЕННЯ, і жоден тест цього не бачив:
 * типізація до CSS не доходить, а збірка на такому не падає — вона просто
 * викидає правила.
 */
const CSS = readFileSync('src/index.css', 'utf8');

/*
 * Розбір ЛІНИВИЙ і всередині тесту, а не на рівні модуля.
 *
 * На тій самій ваді postcss не завжди вертає дивний вузол — на її
 * справжній формі він кидає `CssSyntaxError`. Розбір на рівні модуля
 * робив би з цього збій ЗБИРАННЯ набору, і vitest казав би «no tests»
 * замість того, щоб назвати файл і рядок. Помилка, яку видно, вартніша за
 * помилку, яка просто гасить набір.
 */
function parsed(): postcss.Root {
  return postcss.parse(CSS, { from: 'src/index.css' });
}

function desktopSidebar(): Rule | null {
  let found: Rule | null = null;
  parsed().walkAtRules('media', (media) => {
    if (!media.params.includes('900px')) return;
    media.walkRules((rule) => {
      if (rule.selector.trim() === '.sidebar') found = rule;
    });
  });
  return found;
}

describe('бічна панель десктопу', () => {
  it('стиль порталу взагалі розбирається', () => {
    // Перший і найгрубіший рівень. На справжній формі вади postcss кидає
    // `CssSyntaxError: Unknown word` — а збірка на тому самому файлі не
    // падає взагалі, вона просто викидає оголошення.
    expect(() => parsed()).not.toThrow();
  });

  it('оголошує все, без чого її не видно', () => {
    const rule = desktopSidebar();
    expect(rule, 'правило .sidebar у медіа-запиті десктопу').not.toBeNull();
    const props = new Set<string>();
    rule!.walkDecls((decl: Declaration) => { props.add(decl.prop); });

    // `display` — те, що перекриває `.sidebar { display: none }` мобільного.
    // Без нього панелі немає ВЗАГАЛІ, і саме це й сталось.
    expect(props.has('display'), 'display').toBe(true);
    // `position` + `z-index` — те, без чого вона є, але лежить під полотном
    // порталу: позиціонований шар завжди перекриває непозиціонований.
    expect(props.has('position'), 'position').toBe(true);
    expect(props.has('z-index'), 'z-index').toBe(true);
    expect(props.has('width'), 'width').toBe(true);
  });

  it('у стилі порталу немає голого тексту серед оголошень', () => {
    /*
     * Загальніша половина тієї самої вади. Postcss не кидає винятку на
     * прозі — він робить із неї вузол, який нічого не оголошує; саме так
     * вона й пройшла повз усі перевірки.
     *
     * Тому шукається не виняток, а сам вузол: усередині блоку може стояти
     * оголошення, вкладене правило або коментар — і більше нічого.
     */
    const strays: string[] = [];
    parsed().walkRules((rule) => {
      for (const node of rule.nodes) {
        if (node.type === 'decl' || node.type === 'rule' || node.type === 'comment') continue;
        if (node.type === 'atrule') continue;
        strays.push(`${rule.selector}: ${String(node).slice(0, 60)}`);
      }
    });
    expect(strays).toEqual([]);
  });
});
