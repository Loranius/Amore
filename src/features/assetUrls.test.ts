import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// ============================================================
// Жоден асет не адресується голим слешем.
// ------------------------------------------------------------
// Привід — знімок із телефона власника: «WebGL недоступний / 3D-кристал
// не вдалося відкрити». У консолі стояло зовсім інше:
//
//   Could not load /models/amore_ruin.glb: fetch for
//   "https://loranius.github.io/models/amore_ruin.glb" responded with 404
//
// Портал живе на `loranius.github.io/Amore/`, а `RUIN_MODEL_URL` був
// записаний як `'/models/amore_ruin.glb'`. Голий слеш — це корінь
// ДОМЕНУ, а не корінь застосунку, тож адреса втрачала `/Amore/`.
//
// Локально це не видно НІКОЛИ: dev-сервер віддає базу `/`, і той самий
// рядок там правильний. Живий екран цього проєкту теж не побачив би —
// він знімає той самий dev-сервер. Тобто вада, яку може впіймати лише
// читання коду, і саме тому вона тут.
//
// Ціна була не «немає файлу»: `useGLTF` кидає, сцена падає в запасний
// рендерер, і пара читає повідомлення про WebGL — про причину, якої не
// було. Перший розбір цього екрана пішов шукати стелю WebGL-контекстів.
// ============================================================

const SRC = fileURLToPath(new URL('..', import.meta.url));

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry.startsWith('.')) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...sourceFiles(full));
      continue;
    }
    if (/\.(ts|tsx)$/.test(entry) && !/\.test\.(ts|tsx)$/.test(entry)) out.push(full);
  }
  return out;
}

/** Без коментарів: вони цитують саме ті рядки, що перевіряються. */
const bare = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, (block) => block.replace(/[^\n]/g, ' '))
    .replace(/^\s*\/\/.*$/gm, '');

/**
 * Теки з асетами, які лежать у `public/`.
 *
 * Перелічені, а не «будь-який слеш»: маршрути порталу (`/wishlist`),
 * ключі кешу й шляхи Supabase теж починаються зі слеша, і вони
 * правильні. Ламається саме те, що браузер піде тягнути з домену.
 */
const PUBLIC_DIRS = ['models', 'assets', 'textures', 'icons', 'img', 'fonts'];

describe('адреси асетів рахуються від бази застосунку', () => {
  const files = sourceFiles(SRC);

  it('у src/ узагалі є що перевіряти', () => {
    // Інакше зміна структури тек тихо перетворила б цей файл на
    // перевірку порожнечі, яка завжди зелена.
    expect(files.length).toBeGreaterThan(200);
  });

  it.each(PUBLIC_DIRS)('жоден рядок не починається з /%s/', (dir) => {
    const pattern = new RegExp(`['"\`]/${dir}/`);
    const offenders: string[] = [];
    for (const file of files) {
      if (pattern.test(bare(readFileSync(file, 'utf8')))) {
        offenders.push(file.slice(SRC.length));
      }
    }
    expect(
      offenders,
      `голий слеш губить базу застосунку — рахуй через import.meta.env.BASE_URL`,
    ).toEqual([]);
  });

  it('КОЖЕН, хто називає модель, рахує адресу від бази', () => {
    /*
     * Тут стояв точковий випадок, з якого все почалось: `PortalRuin.tsx`
     * і 404 на GitHub Pages. Руїни більше немає — світом кристала стала
     * печера (ADR-0117), — і разом із файлом зникла б перевірка.
     *
     * Зникнути вона не має права: вада була не в тому файлі, а в звичці
     * писати голий слеш. Тому замість одного імені тут ПРАВИЛО — будь-який
     * рядок із `models/` мусить стояти поруч із `BASE_URL` у своєму файлі.
     */
    const offenders: string[] = [];
    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      /*
       * Чужий хост не рахується: `wishlistPortraitSegmentation.ts` тягне
       * модель сегментації з `storage.googleapis.com`, і база застосунку
       * до неї не має жодного стосунку. Правило про АДРЕСИ ВСЕРЕДИНІ
       * САЙТА, тобто про ті, що не мають схеми.
       */
      const local = [...bare(source).matchAll(/['"`]([^'"`]*models\/[^'"`]*)['"`]/g)]
        .some((match) => !match[1]!.includes('://'));
      if (!local) continue;
      if (!source.includes('import.meta.env.BASE_URL')) offenders.push(file.slice(SRC.length));
    }
    expect(offenders, 'адреса моделі без BASE_URL — це 404 на GitHub Pages').toEqual([]);
  });
});
