// ============================================================
// Жодне фото пари не малюється сирим `<img>`.
// ------------------------------------------------------------
// ЧОМУ ЦЕ ТЕСТ ПО ВИХІДНОМУ КОДУ, А НЕ ПО ПОВЕДІНЦІ.
//
// Вада тут не падає й не кидає. Сирий `<img src={photo_url}>` малює те
// саме, що й `<Photo>`, — просто тягне при цьому ОРИГІНАЛ. У пари це в
// середньому 416 КБ на знімок при 21 КБ, яких вистачає на картку, а
// найбільший файл в архіві — 11.4 МБ на кадр 96×96. На віндовсі з
// вайфаєм цього не видно взагалі; на телефоні це заскоки під час скролу
// й трафік.
//
// `imageCdn.ts` написали саме проти цього, і за кілька місяців повз нього
// встигли пройти шість місць — не з недбалості, а тому, що правило ніде
// не було записане так, щоб його можна було порушити помітно. Тепер
// записане.
//
// Межа навмисно вузька: тест ловить лише ті вирази `src`, у яких видно
// поле знімка пари (`photo_url`, `image_url`, `cover.photo`). Постер із
// TMDB, `blob:`-прев'ю форми й іконка з `public/` — не сховище, і
// `thumbUrl` їх однаково не чіпає.
// ============================================================
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = new URL('../..', import.meta.url).pathname;

/** Поля, у яких у цьому проєкті лежить адреса знімка зі сховища пари. */
const STORAGE_FIELDS = /(photo_url|image_url|photoUrl|imageUrl)/;

function sources(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      sources(path, out);
      continue;
    }
    if (entry.endsWith('.tsx')) out.push(path);
  }
  return out;
}

describe('фото пари не йде повз мініатюри', () => {
  it('жоден сирий <img> не бере адресу зі сховища', () => {
    const offenders: string[] = [];
    for (const file of sources(join(ROOT, 'features'))) {
      const text = readFileSync(file, 'utf8');
      /*
       * Коментарі знімаються ПЕРЕД пошуком, і не для охайності: у JSX
       * коментар `{/* … <img> … *\/}` теж містить рядок `<img`, і без
       * зняття тест ловив власне пояснення сусіднього рядка.
       */
      const code = text.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
      // Тег `<img …>` — від імені до найближчого закриття, не довше
      // чотирьохсот символів: далі це вже сусідній код.
      for (const tag of code.match(/<img\s[\s\S]{0,400}?\/>/g) ?? []) {
        if (!/\bsrc=/.test(tag)) continue;
        if (!STORAGE_FIELDS.test(tag)) continue;
        // `thumbUrl(...)` усередині самого тега — це той самий шлях, лише
        // без обгортки: `MemoriesMap` робить саме так і має на це право.
        if (tag.includes('thumbUrl(')) continue;
        offenders.push(`${file.slice(ROOT.length)}: ${tag.replace(/\s+/g, ' ').slice(0, 90)}`);
      }
    }
    expect(offenders, offenders.join('\n')).toEqual([]);
  });
});
