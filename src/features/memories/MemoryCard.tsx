// ============================================================
// Полароїд у галереї «Спогадів».
// ------------------------------------------------------------
// Картка складається з трьох речей і жодної більше: кадр, назва, дата.
// Місце, опис і решта альбому живуть на сторінці спогаду — у сітці з двох
// колонок на телефоні для них немає ширини, і спроба втиснути їх дає
// стовпчик обрізаних рядків замість фотографій.
// ============================================================
import { Link } from 'react-router-dom';
import { momentTilt } from './momentStyle';
import { formatMemoryDate } from './memoriesDate';
import type { Moment } from './useMoments';

export function MemoryCard({ moment }: { moment: Moment }) {
  const title = moment.title.trim();
  const date = formatMemoryDate(moment.memory_date, 'day');
  return (
    <Link
      to={`/memories/${moment.id}`}
      className="mm-card"
      style={{ rotate: `${momentTilt(moment.id)}deg` }}
    >
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
      {/* Без назви дата підіймається на місце заголовка: два однакові
          рядки поспіль читались би як помилка, а не як «назви немає». */}
      <span className="mm-card-foot">
        <b>{title || date}</b>
        {title && <i>{date}</i>}
      </span>
    </Link>
  );
}
