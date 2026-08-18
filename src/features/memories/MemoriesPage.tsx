// ============================================================
// MemoriesPage — «Спогади», фотощоденник пари.
// ------------------------------------------------------------
// Один екран і один вхід. Попередня редакція давала три вигляди (стрічка /
// альбом / мозаїка), перемикач між ними й два різні входи додавання — і
// кожен із них показував ті самі фото інакше розкладеними. Модель теж була
// інша: одиницею архіву було ФОТО, згруповане по днях.
//
// Тепер одиниця — СПОГАД: назва, дата, місце, кілька слів і альбом знімків.
// Галерея показує його полароїдом, а все інше відкривається на власній
// сторінці.
//
// Розподіл між сусідніми модулями, щоб ніхто не додав сюди зайвого:
// «Спогади» — що вже було; «Наш шлях» — віхи; «Плани» — чого ще хочеться.
// ============================================================
import { useState } from 'react';
import { useCurrentUser } from '@/providers/AuthProvider';
import { PlusIcon } from '@/components/icons/UiIcon';
import { MemoryCard } from './MemoryCard';
import { MomentComposer } from './MomentComposer';
import { useMoments } from './useMoments';
import './memories.css';

export function MemoriesPage() {
  const me = useCurrentUser();
  const { data, isPending, isError, refetch, isFetching } = useMoments();
  const [composing, setComposing] = useState(false);

  if (isPending) {
    return (
      <section className="memories">
        <div className="mm-grid" aria-hidden="true">
          {[0, 1, 2, 3].map((i) => <div key={i} className="mm-skeleton" />)}
        </div>
      </section>
    );
  }

  if (isError) {
    return (
      <section className="memories">
        <div className="empty-state">
          <p>Не вдалось завантажити спогади.</p>
          <button type="button" className="btn" onClick={() => void refetch()} disabled={isFetching}>
            {isFetching ? 'Пробую…' : 'Спробувати ще раз'}
          </button>
        </div>
      </section>
    );
  }

  const moments = data?.moments ?? [];
  const earliest = moments[moments.length - 1]?.memory_date;

  return (
    <section className="memories">
      <header className="mm-head">
        <h1>Спогади</h1>
        <p className="mm-sub">
          {moments.length === 0
            ? 'Тут буде ваш фотощоденник'
            : `${moments.length} · ${data?.photoCount ?? 0} фото · від ${earliest?.slice(0, 4) ?? ''}`}
        </p>
      </header>

      {moments.length === 0 ? (
        <p className="empty-state">
          Ще жодного спогаду. Натисни «+» і збережи перший.
        </p>
      ) : (
        <div className="mm-grid">
          {moments.map((moment) => <MemoryCard key={moment.id} moment={moment} />)}
        </div>
      )}

      {/* Один вхід, а не меню «Спогад / Особливий день»: концепт просить
          відкривати створення одразу, без проміжного вибору. */}
      <button
        type="button"
        className="mm-fab"
        onClick={() => setComposing(true)}
        aria-label="Новий спогад"
      >
        <PlusIcon size={26} />
      </button>

      {composing && (
        <MomentComposer
          userId={me.id}
          places={data?.places ?? []}
          onClose={() => setComposing(false)}
        />
      )}
    </section>
  );
}
