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
import type { SwipeType, SwipeCard, SwipeDirection } from '@/types';

const TYPE_TABS: { type: SwipeType; label: string }[] = [
  { type: 'movie', label: '🎬 Фільми' },
  { type: 'series', label: '📺 Серіали' },
];

export function SwipeDeck({ enabled }: { enabled: boolean }) {
  const [type, setType] = useState<SwipeType>('movie');
  const { cards, loading, exhausted, commitTop, reload } = useSwipeDeck(type, enabled);
  const [detail, setDetail] = useState<SwipeCard | null>(null);

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

      <div className="swipe-stack">
        {loading ? (
          <p className="empty-state">Завантаження…</p>
        ) : exhausted ? (
          <div className="swipe-empty">
            <p className="empty-state">Картки скінчились 🎬</p>
            <button type="button" className="btn" onClick={() => void reload()}>
              Оновити
            </button>
          </div>
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
        <div className="swipe-actions">
          <button type="button" className="swipe-act swipe-act-left" onClick={() => act('left')} title="В планах">
            🕐
          </button>
          <button type="button" className="swipe-act swipe-act-down" onClick={() => act('down')} title="Пропустити">
            ✕
          </button>
          <button type="button" className="swipe-act swipe-act-up" onClick={() => act('up')} title="Подивились">
            ✅
          </button>
          <button type="button" className="swipe-act swipe-act-right" onClick={() => act('right')} title="Дивимось">
            ▶
          </button>
        </div>
      )}

      {detail && <SwipeDetailModal card={detail} type={type} onClose={() => setDetail(null)} />}
    </div>
  );
}
