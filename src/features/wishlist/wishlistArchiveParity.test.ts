import { readdirSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const DIR = dirname(fileURLToPath(new URL('./wishlistArchiveParity.test.ts', import.meta.url)));
const read = (name: string) => readFileSync(`${DIR}/${name}`, 'utf8');
/** Без коментарів: вони цитують саме те, чого вже нема. */
const bare = (source: string) => source.replace(/\/\*[\s\S]*?\*\//g, (b) => b.replace(/[^\n]/g, ' '));

const ARCHIVE = bare(read('WishArchiveBase.tsx'));
const PAGE = bare(read('WishlistPageBase.tsx'));
const PICKER = bare(read('WishlistArchiveViewPicker.tsx'));

describe('архів і активні мрії — один вішліст, а не два', () => {
  /*
   * Три вади, які власник побачив на одному екрані (ADR-0056):
   * над архівом стояли ДВА вибори вигляду одразу, самі виглядів було
   * чотири (бульбашки / таблиця / стрічка / полароїд), а виконана мрія
   * малювалась власною карткою, ні на що на дошці не схожою.
   */

  it('виглядів рівно два, і обидва — з дошки', () => {
    const modes = read('wishlistBoardView.ts');
    expect(modes).toContain("export type WishlistViewMode = 'bubbles' | 'grid'");
    // Архів більше не має власного типу вигляду: файл, який його тримав,
    // прибраний, тож розійтись їм нема де.
    expect(readdirSync(DIR)).not.toContain('wishlistArchiveView.ts');
    expect(PICKER).toContain("from './wishlistBoardView'");
  });

  it('архів не тримає власного стану вигляду', () => {
    expect(ARCHIVE).not.toContain('readWishlistArchiveView');
    expect(ARCHIVE).not.toContain('writeWishlistArchiveView');
    expect(ARCHIVE, 'вигляд мусить приходити ззовні, як проп').toContain('view: viewMode,');
  });

  it('другий перемикач вигляду показується лише там, де першого нема', () => {
    /*
     * У світі перемикач уже стоїть в аркуші (`WishlistWorldNav`), і саме
     * там пара бачила два ряди поспіль. Без світу панель дошки при
     * відкритому архіві ховається — тоді перемикач архіву єдиний.
     */
    expect(ARCHIVE).toContain('showViewPicker && (');
    expect(PAGE).toContain('showViewPicker={!worldVisible}');
  });

  it('виконана мрія малюється тією самою карткою, що й активна', () => {
    expect(ARCHIVE).toContain("import { WishlistGridCard } from './WishlistGridCard'");
    expect(ARCHIVE).toContain('<WishlistGridCard');
    expect(read('WishlistGridView.tsx')).toContain('WishlistGridCard');
  });

  it('старі вигляди прибрані разом зі своїми файлами', () => {
    const files = readdirSync(DIR);
    for (const gone of [
      'WishlistFeedView.tsx',
      'WishlistFeedCard.tsx',
      'WishlistPolaroidView.tsx',
      'WishlistPolaroidCard.tsx',
      'wishlistPolaroidLayout.ts',
      'wishlistFeedView.css',
      'wishlistPolaroidView.css',
    ]) {
      expect(files, `${gone} лишився сиротою`).not.toContain(gone);
    }
    expect(ARCHIVE).not.toContain('ArchiveFeedCard');
    expect(ARCHIVE).not.toContain('ArchivePolaroidCard');
  });

  it('шапка архіву не повторює того, що вже видно', () => {
    /*
     * Було три блоки поспіль про одне: заголовок «Подаровані спогади»,
     * картка «4 подаровані спогади» з датою, і вже під ними — сам архів.
     */
    expect(ARCHIVE).toContain('wl-archive-topbar');
    expect(ARCHIVE).not.toContain('wl-archive-page-header');
    expect(ARCHIVE).not.toContain('wl-archive-summary');
  });
});
