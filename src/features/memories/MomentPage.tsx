// ============================================================
// Сторінка одного спогаду.
// ------------------------------------------------------------
// Порядок згори вниз узятий із концепту дослівно: обкладинка на всю
// ширину, що розчиняється в тлі; над нею — «назад» і «•••»; далі назва,
// рядок «дата • місце», кілька слів; і лише потім альбом.
//
// Обкладинка не має рамки й не стоїть у картці. Вона ПЕРЕХОДИТЬ у сторінку
// градієнтом: рамка зробила б із неї ще одну плитку в списку плиток, а
// градієнт лишає відчуття, що сторінка — це сам спогад, а не запис про нього.
//
// Альбом показує ВСІ знімки, включно з обкладинкою. Інакше з неї не можна
// було б потрапити у повний екран свайпом із сусідніх кадрів.
// ============================================================
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useConfirm } from '@/providers/ConfirmProvider';
import { useCurrentUser } from '@/providers/AuthProvider';
import { ChevronLeftIcon } from '@/components/icons/UiIcon';
import { DotsIcon } from '@/components/icons/PlanIcon';
import { MapPinIcon } from '@/components/icons/MapIcon';
import { MomentComposer } from './MomentComposer';
import { PhotoLightbox } from './PhotoLightbox';
import { albumColumns, photoAspect } from './momentStyle';
import { placeLabel } from './momentPlace';
import { formatMemoryDate } from './memoriesDate';
import { useMomentMutations, useMoments } from './useMoments';
import './memories.css';

/**
 * Скільки колонок в альбомі: дві на телефоні, три на широкому екрані.
 *
 * Колонки набираються в JS (див. `albumColumns`), тому медіазапитом тут не
 * обійтись — ширину доводиться питати й переслуховувати. Поріг 720 px —
 * це межа, за якою два стовпці полароїдів стають ширшими за долоню й
 * альбом починає читатись як банер.
 */
function useAlbumLanes(): number {
  const read = () => (typeof window !== 'undefined' && window.innerWidth >= 720 ? 3 : 2);
  const [lanes, setLanes] = useState(read);
  useEffect(() => {
    const onResize = () => setLanes(read());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return lanes;
}

export function MomentPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const me = useCurrentUser();
  const confirm = useConfirm();
  const { data, isPending } = useMoments();
  const { remove } = useMomentMutations();

  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [lightbox, setLightbox] = useState<number | null>(null);
  const lanes = useAlbumLanes();

  const moment = data?.moments.find((m) => String(m.id) === id);

  if (isPending) {
    return <section className="memories"><div className="mm-skeleton mm-skeleton--hero" /></section>;
  }

  if (!moment) {
    return (
      <section className="memories">
        <div className="empty-state">
          <p>Такого спогаду немає — можливо, його видалили.</p>
          <button type="button" className="btn" onClick={() => navigate('/memories')}>
            До спогадів
          </button>
        </div>
      </section>
    );
  }

  const place = moment.place ? placeLabel(moment.place) : '';
  const album = albumColumns(moment.photos, lanes);

  return (
    <section className="memories mm-page">
      <div className="mm-hero">
        {moment.cover && (
          // Обкладинка теж відкривається на повний екран: інакше спогад з
          // одним знімком не мав би жодного способу його роздивитись.
          <button
            type="button" className="mm-hero-shot"
            onClick={() => setLightbox(moment.cover!.id)} aria-label="Відкрити фото"
          >
            <img src={moment.cover.photo_url} alt="" decoding="async" />
          </button>
        )}
        <div className="mm-hero-veil" aria-hidden="true" />
        <div className="mm-hero-bar">
          <button type="button" className="mm-round" onClick={() => navigate(-1)} aria-label="Назад">
            <ChevronLeftIcon size={22} />
          </button>
          <button
            type="button" className="mm-round"
            onClick={() => setMenuOpen((v) => !v)}
            aria-expanded={menuOpen} aria-label="Дії зі спогадом"
          >
            <DotsIcon size={22} />
          </button>
        </div>
        {menuOpen && (
          <>
            <button type="button" className="mm-menu-scrim" aria-label="Закрити меню"
              onClick={() => setMenuOpen(false)} />
            <div className="mm-menu" role="menu">
              <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); setEditing(true); }}>
                Редагувати
              </button>
              <button
                type="button" role="menuitem" className="is-danger"
                onClick={() => {
                  setMenuOpen(false);
                  void (async () => {
                    // Видалення забирає й фото зі сховища, і відкотити його
                    // нічим — тому підтвердження тут обов'язкове.
                    const ok = await confirm(
                      `Видалити спогад разом із ${moment.photos.length} фото?`,
                      { danger: true, confirmLabel: 'Видалити' },
                    );
                    if (ok) remove.mutate(moment, { onSuccess: () => navigate('/memories') });
                  })();
                }}
              >
                Видалити
              </button>
            </div>
          </>
        )}
      </div>

      <header className="mm-page-head">
        <h1>{moment.title.trim() || formatMemoryDate(moment.memory_date, 'day')}</h1>
        <p className="mm-page-meta">
          <span>{formatMemoryDate(moment.memory_date, 'day')}</span>
          {place && (
            <>
              <em aria-hidden="true">•</em>
              <span className="mm-page-place"><MapPinIcon size={14} />{place}</span>
            </>
          )}
        </p>
        {moment.note && <p className="mm-page-note">{moment.note}</p>}
      </header>

      {moment.photos.length > 1 && (
        <div className="mm-album">
          {album.map((lane, laneIndex) => (
            <div key={laneIndex} className="mm-album-lane">
              {lane.map((photo) => (
                <button
                  key={photo.id}
                  type="button"
                  className="mm-album-shot"
                  style={{ aspectRatio: String(photoAspect(photo.id)) }}
                  onClick={() => setLightbox(photo.id)}
                  aria-label="Відкрити фото"
                >
                  <img src={photo.photo_url} alt="" loading="lazy" decoding="async" />
                </button>
              ))}
            </div>
          ))}
        </div>
      )}

      {lightbox !== null && (
        <PhotoLightbox
          photos={moment.photos}
          startId={lightbox}
          onClose={() => setLightbox(null)}
        />
      )}

      {editing && (
        <MomentComposer
          userId={me.id}
          moment={moment}
          places={data?.places ?? []}
          onClose={() => setEditing(false)}
        />
      )}
    </section>
  );
}
