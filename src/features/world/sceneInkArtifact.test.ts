import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const THEME_CSS = readFileSync(
  fileURLToPath(new URL('./worldTheme.css', import.meta.url)),
  'utf8',
);
const ARTIFACT_CSS = readFileSync(
  fileURLToPath(new URL('./artifactThemes.css', import.meta.url)),
  'utf8',
);
const WORLD_TSX = readFileSync(
  fileURLToPath(new URL('./ArtifactWorld.tsx', import.meta.url)),
  'utf8',
);

/** Той самий CSS без коментарів: вони цитують саме ту ваду, що перевіряється. */
const strip = (css: string) =>
  css.replace(/\/\*[\s\S]*?\*\//g, (b) => b.replace(/[^\n]/g, ' '));
const CODE = strip(THEME_CSS);
const ARTIFACT = strip(ARTIFACT_CSS);

/** Тіло блоку від селектора до `\n}` на початку рядка. */
function rule(css: string, selector: string): string {
  const at = css.indexOf(selector);
  expect(at, `блоку ${selector} немає`).toBeGreaterThan(-1);
  return css.slice(at, css.indexOf('\n}', at));
}

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

  it('чорнило дерева стоїть під КОМПАУНДНИМ селектором', () => {
    /*
     * `data-theme` і `data-artifact` — обидва на `<html>`. Селектор із
     * пробілом («нащадок») не збігся б ніколи й мовчки: CSS не дає
     * помилки, правило просто не діє. Цю пастку в проєкті вже ловили
     * (`rootAttributeSelectors.test.ts`), і вона коштувала прозорого
     * дока на семи маршрутах.
     */
    expect(ARTIFACT).toContain("html[data-theme='light'][data-artifact='tree']");
    expect(ARTIFACT).not.toMatch(/\[data-theme='[a-z]+'\]\s+\[data-artifact/);
  });

  it('дерево бере денне чорнило в ОБОХ темах', () => {
    /*
     * Виміряно на живому екрані, 412×915@2, тема dark, світ «Дерево»:
     * `.home-title` 15.16 → 1.52, лічильник 9.54 → 1.35, підпис
     * 11.11 → 1.59, привітання 17.36 → 3.41. Заголовок і число були
     * фактично невидимі.
     *
     * Причина: небо дерева денне ЗАВЖДИ, а чорнило йшло за темою. У
     * світлій темі вони збігались випадково — саме тому вада ховалась.
     *
     * Тепер обидві теми дерева несуть денне чорнило ЯВНО. Успадкувати
     * його з темного блоку в світлий було б можливо (специфічність це
     * дозволяє), але мовчазне успадкування між темами одного світу —
     * рівно та пастка, через яку вада й з'явилась.
     */
    for (const selector of [
      "html[data-artifact='tree'] {",
      "html[data-theme='light'][data-artifact='tree'] {",
    ]) {
      const body = rule(ARTIFACT, selector);
      expect(body, selector).toContain('--scene-ink: #22364a');
      expect(body, selector).toContain('--scene-ink-muted: #334759');
      /*
       * Акцент — ЗЕЛЕНИЙ. До теми світів тут стояло чорнило кристала, і
       * над деревом число днів лишалось рожевим (`#8e2145`) на світлій
       * темі й фіолетовим (`#5c3390`) на темній — виміряно на живому
       * екрані. 4.39:1 проти денного неба `#7fb8e6` при порозі 3.0.
       */
      expect(body, selector).toContain('--scene-ink-accent: #2a5010');
      expect(body, `${selector}: кримсон кристала лишився`).not.toContain('#8e2145');
      expect(body, `${selector}: фіолет кристала лишився`).not.toContain('#5c3390');
    }
  });

  it('риф має власне небо в обох темах', () => {
    /*
     * Риф власного 3D-неба ще не малює, тож крізь нього видно CSS-небо
     * порталу. Без цих правил воно лишалось би фіолетовим кристалічним
     * над синім рифом — і в темній темі, і в світлій.
     */
    const dark = rule(ARTIFACT, "html[data-artifact='reef'] {");
    expect(dark).toContain('--scene-bg: #0c1220');
    expect(dark).toContain('--scene-ink-accent: #8fc0ff');

    const light = rule(ARTIFACT, "html[data-theme='light'][data-artifact='reef'] {");
    expect(light).toContain('--scene-bg: #7fd0d6');
    expect(light).toContain('--scene-ink-accent: #0a5350');
  });

  it('світла тема кристала бере рожевий акцент лічильника, а не фіолетовий', () => {
    /*
     * Власник побачив це першим: на світлому порталі, де все кримсонове,
     * «1 336» лишалось єдиною фіолетовою річчю на екрані.
     *
     * Сам `--accent` (`#a82f55`) сюди не годиться: проти неба він дає
     * 3.09:1, тобто сидить рівно на порозі великого тексту.
     */
    const body = rule(CODE, "[data-theme='light'] {");
    /*
     * Значення рухалось разом зі сценою: `#8e2145` міряли проти
     * блакитного зеніту храму (4.04:1). Печера (ADR-0117) дає камінь
     * `#b3aabd`, проти якого той самий тон падає до 3.83, тож акцент
     * поглиблено до `#7d1c3c` — 4.47:1, та сама рожева родина.
     */
    expect(body).toContain('--scene-ink-accent: #7d1c3c');
    expect(body, 'фіолетовий із темної теми лишився у світлій').not.toContain('#5c3390');
  });

  it('кристал лишається в worldTheme, а світи — в artifactThemes', () => {
    /*
     * Кристал у `:root` не за старшинством, а структурно: `:root` малює
     * ПЕРШИЙ кадр, до того як провайдери поставлять атрибути. Решта
     * світів — перевизначення за природою, і кожен тримає свою
     * ідентичність в ОДНОМУ блоці.
     */
    expect(CODE).not.toContain("[data-artifact='tree']");
    expect(CODE).not.toContain("[data-artifact='reef']");
    expect(CODE).not.toContain("[data-artifact='crystal']");
    expect(ARTIFACT).not.toContain("[data-artifact='crystal']");
  });
});
