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
// ============================================================
import { Link } from 'react-router-dom';
import { fanLeaves } from './momentStyle';
import { formatMemoryDate } from './memoriesDate';
import type { Moment } from './useMoments';

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
              <img src={photo.photo_url} alt="" loading="lazy" decoding="async" draggable={false} />
            </span>
          );
        })}

        <span className="mm-card-frame">
          {moment.cover ? (
            <img
              src={moment.cover.photo_url}
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
