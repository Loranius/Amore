import { readFileSync } from 'node:fs';
import { globSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// ============================================================
// Кругла кнопка дії — один рецепт на портал.
// ------------------------------------------------------------
// До того, як власник попросив коло всюди, той самий рецепт стояв у
// ЧОТИРЬОХ місцях: `.mm-fab` і `.mm-map-fab` у спогадах, `.pm-fab` у
// планах, `.wl-world-add` у вішлісті. Три з них іще збігалися, а
// четвертий уже розійшовся — у планів це була пігулка з підписом.
//
// Історія цього репозиторію знає, чим таке закінчується: у «Планах»
// накопичилось вісім шарів стилю, шість із яких перевизначали той самий
// псевдоелемент. Починалось так само — з другої копії значення.
// ============================================================

const ROOT = join(__dirname, '../../..');
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8');
const bare = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '');

describe('кругла кнопка дії', () => {
  it('живе тільки в шарі порталу', () => {
    // Не «рівно одне правило»: у `index.css` їх законно кілька — базове,
    // стан натискання, фокус, занурений маршрут, reduced-motion. Важить
    // інше: жоден модуль не заводить власного.
    const files = globSync('src/**/*.css', { cwd: ROOT }).filter(
      (file) => /(^|[\s,])\.fab[\s:{,]/m.test(bare(read(file))),
    );
    expect(files).toEqual(['src/index.css']);
  });

  it('сідає нижче там, де немає дока', () => {
    // «Наш шлях» — занурений маршрут: док схований, і кнопка на висоті
    // «над доком» висіла б посеред екрана. Виміряно на живому екрані:
    // 837 px проти 765 на звичайному маршруті.
    const css = bare(read('src/index.css'));
    expect(css).toMatch(/--fab-lift, 92px/);
    expect(css).toMatch(/\[data-immersive='true'\] \.fab \{ --fab-lift: \d+px; \}/);
  });

  it('стоїть на всіх чотирьох екранах, де пара щось додає', () => {
    // Спогади, плани, «Наш шлях», вішліст. П'ята кнопка — карта спогадів —
    // це те саме коло, віддзеркалене ліворуч.
    const pages = {
      'src/features/memories/MemoriesPage.tsx': ['className="fab"', 'className="fab fab--left"'],
      'src/features/plans/PlansPage.tsx': ['className="fab"'],
      'src/features/journey/JourneyPage.tsx': ['className="fab"'],
      'src/features/wishlist/WishlistWorldNav.tsx': ['className="fab"'],
    };
    for (const [file, expected] of Object.entries(pages)) {
      const source = read(file);
      for (const marker of expected) expect(source, file).toContain(marker);
    }
  });

  it('називає свою дію, бо підпису всередині кола немає', () => {
    // Коло без тексту — це кнопка без назви для тих, хто не бачить значка.
    for (const file of [
      'src/features/memories/MemoriesPage.tsx',
      'src/features/plans/PlansPage.tsx',
      'src/features/journey/JourneyPage.tsx',
      'src/features/wishlist/WishlistWorldNav.tsx',
    ]) {
      const source = read(file);
      // Беремо текст від відкриття `<button` до найближчого `</button>`:
      // атрибути можуть містити стрілкові функції, і зупинятись на першому
      // `>` означало б різати розмітку посеред `onClick={() =>`.
      for (const block of source.matchAll(/<button\b[\s\S]*?<\/button>/g)) {
        if (!/className="fab[^"]*"/.test(block[0])) continue;
        expect(block[0], file).toMatch(/aria-label=/);
      }
    }
  });
});
