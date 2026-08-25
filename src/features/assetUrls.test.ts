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

  it('модель руїни адресується від бази', () => {
    // Точковий випадок, з якого все почалось: 404 на GitHub Pages.
    const source = readFileSync(join(SRC, 'features/home/crystal3d/scene/PortalRuin.tsx'), 'utf8');
    expect(source).toContain('import.meta.env.BASE_URL');
    expect(bare(source)).not.toContain("'/models/");
  });
});
