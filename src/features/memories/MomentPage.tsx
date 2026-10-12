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
//
// Унизу — шматок нитки (ADR-0250): попередній і наступний спогади й те,
// скільки між ними минуло. Сторінка спогаду тепер не тупик, з якого треба
// повертатись у галерею: гортати спогад за спогадом можна й звідси.
// ============================================================
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Photo } from '@/components/ui/Photo';
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
import { currentFrameCssWidth, threadNeighbors, type ThreadNeighbor } from './memoryThread';
import { markCoverMorphSource } from './coverMorph';
import { thumbUrl } from '@/lib/imageCdn';
import type { CSSProperties } from 'react';
import { useMomentMutations, useMoments, type Moment } from './useMoments';
import './memories.css';
import { useWorldModule } from '@/features/world/useWorldModule';

/**
 * Скільки колонок в альбомі: дві на телефоні, три на широкому екрані.
 *
 * Колонки набираються в JS (див. `albumColumns`), тому медіазапитом тут не
 * обійтись — ширину доводиться питати й переслуховувати. Поріг 720 px —
 * це межа, за якою два стовпці полароїдів стають ширшими за долоню й
 * альбом починає читатись як банер.
 */
/**
 * Ширини, з якими кадри реально лягають на екран, у CSS-пікселях.
 *
 * Обкладинка йде на всю ширину сторінки, тож беремо найширший телефон із
 * запасом; кадр альбому — це половина ширини мінус проміжок.
 */
const HERO_CSS_WIDTH = 480;
/**
 * На широкому екрані сторінка спогаду стоїть колонкою 760px (ADR-0254) —
 * обкладинка, попрошена на 480, там розмивалась би.
 */
const HERO_CSS_WIDTH_WIDE = 760;
const heroCssWidth = () =>
  (typeof window !== 'undefined' && window.innerWidth >= 900 ? HERO_CSS_WIDTH_WIDE : HERO_CSS_WIDTH);
const ALBUM_CSS_WIDTH = 200;

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
  // Світ позаду, як у вішліста й планів (ADR-0215).
  const worldVisible = useWorldModule();
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
    return <section className="memories world-module" data-world={worldVisible ? 'true' : undefined}><div className="mm-skeleton mm-skeleton--hero" /></section>;
  }

  if (!moment) {
    return (
      <section className="memories world-module" data-world={worldVisible ? 'true' : undefined}>
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
    <section className="memories mm-page world-module" data-world={worldVisible ? 'true' : undefined}>
      <div className="mm-hero">
        {moment.cover && (
          // Обкладинка теж відкривається на повний екран: інакше спогад з
          // одним знімком не мав би жодного способу його роздивитись.
          // `key` — спогад: гортаючи сусідів, обкладинка монтується заново й
          // повертає собі ім'я переходу, яке стара віддала (`coverMorph.ts`).
          // Підложка — той самий кадр, що на нитці: він уже в кеші, тож
          // перехід виростає з фото, а не з порожнього прямокутника.
          <button
            key={moment.id}
            type="button" className="mm-hero-shot"
            style={{ '--mm-hero-thumb': `url("${thumbUrl(moment.cover.photo_url, currentFrameCssWidth())}")` } as CSSProperties}
            onClick={() => setLightbox(moment.cover!.id)} aria-label="Відкрити фото"
          >
            <Photo src={moment.cover.photo_url} cssWidth={heroCssWidth()} alt="" decoding="async" />
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
        {/* Без назви дата вже стоїть заголовком — удруге її не друкуємо,
            як і на нитці. Рядок лишається лише заради місця. */}
        {(moment.title.trim() || place) && (
          <p className="mm-page-meta">
            {moment.title.trim() && <span>{formatMemoryDate(moment.memory_date, 'day')}</span>}
            {moment.title.trim() && place && <em aria-hidden="true">•</em>}
            {place && <span className="mm-page-place"><MapPinIcon size={14} />{place}</span>}
          </p>
        )}
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
                  <Photo
                    src={photo.photo_url}
                    cssWidth={ALBUM_CSS_WIDTH}
                    alt=""
                    loading="lazy"
                    decoding="async"
                  />
                </button>
              ))}
            </div>
          ))}
        </div>
      )}

      <ThreadNeighbors moments={data?.moments ?? []} id={moment.id} />

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
          moments={data?.moments ?? []}
          places={data?.places ?? []}
          onClose={() => setEditing(false)}
        />
      )}
    </section>
  );
}

/**
 * Мініатюра сусіда просить ту саму ширину, що й кадр на нитці: один URL
 * з обкладинкою-підложкою, тож перехід до сусіда виростає з уже
 * завантаженого фото.
 */

/**
 * Шматок нитки: новіший спогад угорі, цей посередині, старіший унизу —
 * у тому самому порядку й тій самій мові, що й нитка галереї: лінія по
 * центру, кадр ліворуч у новішого й праворуч у старішого (чергування),
 * між вузлами — скільки минуло, як підпис паузи.
 */
function ThreadNeighbors({ moments, id }: { moments: readonly Moment[]; id: number }) {
  const { newer, older } = threadNeighbors(moments, id);
  if (!newer && !older) return null;
  return (
    <nav className="mm-thread" aria-label="Сусіди на нитці">
      {newer && <NeighborLink neighbor={newer} side="left" />}
      {newer && <p className="mm-thread-gap">{newer.label}</p>}
      <p className="mm-thread-here">
        <i className="mm-thread-dot" aria-hidden="true" />
        <span>цей спогад</span>
      </p>
      {older && <p className="mm-thread-gap">{older.label}</p>}
      {older && <NeighborLink neighbor={older} side="right" />}
    </nav>
  );
}

function NeighborLink({ neighbor, side }: { neighbor: ThreadNeighbor<Moment>; side: 'left' | 'right' }) {
  const { moment, label } = neighbor;
  const title = moment.title.trim() || formatMemoryDate(moment.memory_date, 'day');
  return (
    <Link
      to={`/memories/${moment.id}`}
      className={`mm-thread-link mm-thread-link--${side}`}
      aria-label={`${title}, ${label}`}
      replace
      viewTransition
      onClick={(e) => markCoverMorphSource(e.currentTarget.querySelector('.mm-thread-shot'))}
    >
      <span className="mm-thread-shot" aria-hidden="true">
        {moment.cover
          ? <Photo src={moment.cover.photo_url} cssWidth={currentFrameCssWidth()} alt="" loading="lazy" decoding="async" />
          : <span className="mt-blank" />}
      </span>
      <span className="mm-thread-dot mm-thread-dot--stone" aria-hidden="true" />
      <span className="mm-thread-text" aria-hidden="true">
        <b>{title}</b>
        {moment.title.trim() && <i>{formatMemoryDate(moment.memory_date, 'day')}</i>}
      </span>
    </Link>
  );
}
