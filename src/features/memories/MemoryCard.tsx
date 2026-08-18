// ============================================================
// Картка спогаду в галереї.
// ------------------------------------------------------------
// Сам знімок із заокругленими кутами, а за ним — ВІЯЛО решти фото
// спогаду. Підпис лежить під кадром, на тлі сторінки.
//
// Полароїдної рамки більше немає: власник дав референс, у якому спогад —
// це фотографія, а не картка з фотографією всередині. Біла рамка з
// підписом усередині з'їдала близько третини площі клітинки, і на сітці
// 2×N це коштувало саме тієї величини, заради якої галерея існує.
//
// Віяло малюється лише коли фото більше одного. Порожнє віяло під
// одиноким знімком обіцяло б те, чого в спогаді немає.
//
// **Кадри йдуть мініатюрами, і це не оптимізація «про всяк випадок».**
// Виміряно на живому порталі: галерея тягнула 15.83 МБ, щоб намалювати
// картки 127×127. Ширини нижче — CSS-пікселі; щільність екрана
// домножується всередині `thumbUrl`.
// ============================================================

import { Link } from 'react-router-dom';
import { Photo } from '@/components/ui/Photo';
import { fanLeaves } from './momentStyle';
import { formatMemoryDate } from './memoriesDate';
import type { Moment } from './useMoments';

/** Ширина головного кадру в сітці: 68% клітинки, тобто ~128 CSS-пікселів. */
const COVER_CSS_WIDTH = 132;

/**
 * Лист віяла просимо ще меншим, і якість йому теж занижуємо.
 *
 * Видно з нього хіба смужку вздовж краю, та й ту під затемненням у 38%.
 * Платити за такий кадр повну якість — це платити за пікселі, яких ніхто
 * не побачить.
 */
const LEAF_CSS_WIDTH = 96;
const LEAF_QUALITY = 55;

export function MemoryCard({ moment }: { moment: Moment }) {
  const title = moment.title.trim();
  const date = formatMemoryDate(moment.memory_date, 'day');

  // Обкладинка йде першою (див. `orderPhotos`), тож у віяло лягає решта.
  const rest = moment.photos.slice(1);
  const leaves = fanLeaves(rest.length);

  return (
    <Link to={`/memories/${moment.id}`} className="mm-card">
      <span className="mm-card-stack">
        {leaves.map((leaf, i) => {
          const photo = rest[i];
          if (!photo) return null;
          return (
            <span
              key={photo.id}
              className="mm-fan-leaf"
              style={{ transform: `rotate(${leaf.rotate}deg) scale(${leaf.scale})` }}
              aria-hidden="true"
            >
              <Photo
                src={photo.photo_url}
                cssWidth={LEAF_CSS_WIDTH}
                quality={LEAF_QUALITY}
                alt=""
                loading="lazy"
                decoding="async"
                draggable={false}
              />
            </span>
          );
        })}

        <span className="mm-card-frame">
          {moment.cover ? (
            <Photo
              src={moment.cover.photo_url}
              cssWidth={COVER_CSS_WIDTH}
              alt=""
              loading="lazy"
              decoding="async"
              draggable={false}
            />
          ) : (
            // Спогад без фото створити не можна, але видалення останнього
            // знімка лишає саме такий стан — і порожня рамка чесніша за
            // зламану іконку.
            <span className="mm-card-blank" aria-hidden="true" />
          )}
          {moment.photos.length > 1 && (
            <span className="mm-card-count" aria-hidden="true">{moment.photos.length}</span>
          )}
        </span>
      </span>

      {/* Без назви дата підіймається на місце заголовка: два однакові
          рядки поспіль читались би як помилка, а не як «назви немає». */}
      <span className="mm-card-foot">
        <b>{title || date}</b>
        {title && <i>{date}</i>}
      </span>
    </Link>
  );
}
