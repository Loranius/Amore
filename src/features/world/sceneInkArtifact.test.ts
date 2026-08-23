import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const THEME_CSS = readFileSync(
  fileURLToPath(new URL('./worldTheme.css', import.meta.url)),
  'utf8',
);
const WORLD_TSX = readFileSync(
  fileURLToPath(new URL('./ArtifactWorld.tsx', import.meta.url)),
  'utf8',
);

/** Той самий CSS без коментарів: вони цитують саме ту ваду, що перевіряється. */
const CODE = THEME_CSS.replace(/\/\*[\s\S]*?\*\//g, (b) => b.replace(/[^\n]/g, ' '));

describe('чорнило сцени йде за артефактом, а не лише за темою', () => {
  it('обраний артефакт оголошений на корені', () => {
    /*
     * Текст шапки (`.home-*`) лежить у `.home`, а `data-artifact-world`
     * стоїть на `.artifact-world`. Це СУСІДИ, не предок і нащадок, тож
     * атрибут на самому світі до тексту не дістає. Саме тому артефакт
     * дублюється на `<html>`, поруч із `data-theme`.
     */
    expect(WORLD_TSX).toContain("root.setAttribute('data-artifact', artifact)");
    expect(WORLD_TSX).toContain("root.removeAttribute('data-artifact')");
  });

  it('денне чорнило дерева стоїть під КОМПАУНДНИМ селектором', () => {
    /*
     * `data-theme` і `data-artifact` — обидва на `<html>`. Селектор із
     * пробілом («нащадок») не збігся б ніколи й мовчки: CSS не дає
     * помилки, правило просто не діє. Цю пастку в проєкті вже ловили
     * (`rootAttributeSelectors.test.ts`), і вона коштувала прозорого
     * дока на семи маршрутах.
     */
    expect(CODE).toContain("html[data-theme='dark'][data-artifact='tree']");
    expect(CODE).not.toMatch(/\[data-theme='dark'\]\s+\[data-artifact/);
  });

  it('дерево в темній темі бере денне чорнило', () => {
    /*
     * Виміряно на живому екрані, 412×915@2, тема dark, світ «Дерево»:
     * `.home-title` 15.16 → 1.52, лічильник 9.54 → 1.35, підпис
     * 11.11 → 1.59, привітання 17.36 → 3.41. Заголовок і число були
     * фактично невидимі.
     *
     * Причина: небо дерева денне ЗАВЖДИ, а чорнило йшло за темою. У
     * світлій темі вони збігались випадково — саме тому вада ховалась.
     */
    const at = CODE.indexOf("html[data-theme='dark'][data-artifact='tree']");
    expect(at).toBeGreaterThan(-1);
    const rule = CODE.slice(at, CODE.indexOf('}', at));
    // Ті самі значення, що й у світлої теми: небо одне, чорнило одне.
    expect(rule).toContain('--scene-ink: #22364a');
    expect(rule).toContain('--scene-ink-muted: #334759');
    expect(rule).toContain('--scene-ink-accent: #5c3390');
  });

  it('кристал і риф лишаються на чорнилі теми', () => {
    // Небо кристала йде за темою (ніч/полудень), а риф власного неба ще
    // не малює — крізь нього видно CSS-небо порталу, яке теж за темою.
    // Оверрайд для них зламав би те, що працює.
    expect(CODE).not.toContain("[data-artifact='crystal']");
    expect(CODE).not.toContain("[data-artifact='reef']");
  });
});
