// ============================================================
// SwipeDeck — стек свайпу (порт initStack/renderCard UI)
// ------------------------------------------------------------
// Верхні 3 картки; тільки верхня інтерактивна. Кнопки-дублери під
// стеком (для тих, хто не любить свайпати). Тап по картці → деталі
// з трейлером.
// ============================================================
import { useState } from 'react';
import { SwipeCardView } from './SwipeCardView';
import { SwipeDetailModal } from './SwipeDetailModal';
import { useSwipeDeck } from './useSwipeDeck';
import { SWIPE_VERDICTS } from './swipeDirections';
import { useTmdbGenres } from '@/features/media/useTmdb';
import type { SwipeType, SwipeCard, SwipeDirection } from '@/types';
import { EmptyState } from '@/components/ui/EmptyState';
import { FilmIcon } from '@/components/icons/NavIcon';
import { VerdictIcon } from './VerdictIcon';

const TYPE_TABS: { type: SwipeType; label: string }[] = [
  { type: 'movie', label: 'Фільми' },
  { type: 'series', label: 'Серіали' },
];

export function SwipeDeck({ enabled }: { enabled: boolean }) {
  const [type, setType] = useState<SwipeType>('movie');
  // Жанри окремі на кожен тип: у TMDB списки різні (у фільмів «Бойовик»,
  // у серіалів «Sci-Fi & Fantasy»), тож обране для фільмів не має сенсу
  // для серіалів — і не переноситься.
  const [genresByType, setGenresByType] = useState<Record<SwipeType, number[]>>({
    movie: [],
    series: [],
  });
  const selectedGenres = genresByType[type];
  const { data: genres = [] } = useTmdbGenres(type, enabled);
  const { cards, loading, exhausted, commitTop, reload } = useSwipeDeck(
    type,
    enabled,
    selectedGenres,
  );
  const [detail, setDetail] = useState<SwipeCard | null>(null);

  const toggleGenre = (id: number) => {
    setGenresByType((current) => {
      const chosen = current[type];
      return {
        ...current,
        [type]: chosen.includes(id)
          ? chosen.filter((g) => g !== id)
          : [...chosen, id],
      };
    });
  };

  // Показуємо верхні 3, верхня — остання в DOM (найвищий z-index через depth=0).
  const visible = cards.slice(0, 3);

  const act = (dir: SwipeDirection) => {
    const top = cards[0];
    if (top) commitTop(top, dir);
  };

  return (
    <div className="swipe">
      <div className="swipe-type-tabs">
        {TYPE_TABS.map((t) => (
          <button
            key={t.type}
            type="button"
            className={`swipe-type-btn${type === t.type ? ' active' : ''}`}
            onClick={() => setType(t.type)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Фільтр жанрів. Ряд гортається вбік: жанрів у TMDB під два
          десятки, і вертикальний список з'їв би саму колоду. */}
      {genres.length > 0 && (
        <div className="swipe-genres" role="group" aria-label="Фільтр за жанром">
          {selectedGenres.length > 0 && (
            <button
              type="button"
              className="swipe-genre swipe-genre--clear"
              onClick={() => setGenresByType((c) => ({ ...c, [type]: [] }))}
            >
              Усі жанри
            </button>
          )}
          {genres.map((genre) => {
            const on = selectedGenres.includes(genre.id);
            return (
              <button
                key={genre.id}
                type="button"
                className={`swipe-genre${on ? ' active' : ''}`}
                aria-pressed={on}
                onClick={() => toggleGenre(genre.id)}
              >
                {genre.name}
              </button>
            );
          })}
        </div>
      )}

      <div className="swipe-stack">
        {loading ? (
          <p className="empty-state">Завантаження…</p>
        ) : exhausted ? (
          <EmptyState
            icon={<FilmIcon size={26} />}
            title="Картки скінчились"
            hint="Ви переглянули все, що знайшлося за цим фільтром. Спробуйте інші жанри або оновіть колоду."
            action={(
              <button type="button" className="btn" onClick={() => void reload()}>
                Оновити колоду
              </button>
            )}
          />
        ) : (
          visible
            .map((card, i) => (
              <SwipeCardView
                key={card.tmdb_id}
                card={card}
                active={i === 0}
                depth={i}
                onSwipe={commitTop}
                onTap={setDetail}
              />
            ))
            // Верхня картка має бути останньою в DOM для коректного накладання.
            .reverse()
        )}
      </div>

      {!loading && !exhausted && (
        // Кнопки беруть підпис і значок звідти ж, звідки картка
        // (`swipeDirections.ts`). Доки опис був у двох місцях, свайп
        // казав «Подивились», а власник називав дію «Переглянуто».
        <div className="swipe-actions">
          {SWIPE_VERDICTS.map((verdict) => (
            <button
              key={verdict.direction}
              type="button"
              className={`swipe-act swipe-act-${verdict.direction}`}
              onClick={() => act(verdict.direction)}
              title={verdict.label}
              aria-label={verdict.label}
            >
              <VerdictIcon name={verdict.icon} />
            </button>
          ))}
        </div>
      )}

      {detail && <SwipeDetailModal card={detail} type={type} onClose={() => setDetail(null)} />}
    </div>
  );
}
