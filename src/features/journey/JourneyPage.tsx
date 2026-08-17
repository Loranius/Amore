// ============================================================
// «Наш шлях» на весь екран — власний зоряний простір пари.
// ------------------------------------------------------------
// Це єдиний маршрут застосунку, який забирає екран цілком: док і бічна панель
// ідуть з дороги (`useImmersiveRoute`), а кристала тут немає взагалі.
//
// Кристал ховати не довелось: світ видимий лише під `[data-portal-scene]`,
// який ставить `useWorldVisibleRoute`. Ця сторінка його не викликає — і тим
// самим лишається на власному небі, не пов'язаному з артефактом.
// ============================================================
import { useMemo, useState, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { CloseIcon, PlusIcon } from '@/components/icons/UiIcon';
import { useEvents } from '@/features/_shared/events';
import { useCrystalSeed } from '@/features/home/useHome';
import { useCalendarMutations } from '@/features/calendar/useCalendar';
import { AddEventModal } from '@/features/calendar/AddEventModal';
import { readWorldQuality } from '@/features/world/worldDim';
import { useImmersiveRoute } from '@/features/world/useImmersiveRoute';
import type { EventRow } from '@/types';
import { ConstellationSky } from './ConstellationSky';
import { buildStarfield, steadyShadow } from './starfield';
import nebulaUrl from '@/assets/journey/nebula.webp';
import './journeyScene.css';

function isJourneyEvent(event: EventRow): boolean {
  return event.type === 'anniversary';
}

export function JourneyPage() {
  useImmersiveRoute();
  const navigate = useNavigate();
  const { seed } = useCrystalSeed();
  const { data: events = [] } = useEvents();
  const { addEvent, updateEvent } = useCalendarMutations();
  const [editing, setEditing] = useState<EventRow | null>(null);
  const [creating, setCreating] = useState(false);

  // Профіль читається один раз: він не змінюється, поки сторінка відкрита, а
  // перечитувати його щокадру означало б платити за відповідь, яка вже є.
  const [quality] = useState(readWorldQuality);

  const moments = useMemo(() => events.filter(isJourneyEvent), [events]);
  const field = useMemo(() => buildStarfield(seed ?? 'amore', quality), [quality, seed]);
  const steady = useMemo(() => steadyShadow(field.steady), [field.steady]);

  return (
    <div className="journey-scene" data-quality={quality}>
      <div className="jn-space" aria-hidden="true">
        <div className="jn-depth" />
        <div className="jn-nebula" style={{ backgroundImage: `url(${nebulaUrl})` }} />
        <div className="jn-drift jn-drift--cool" />
        <div className="jn-drift jn-drift--warm" />
        {steady && <div className="jn-dust" style={{ boxShadow: steady } as CSSProperties} />}
        {field.twinkling.map((star, index) => (
          <span
            key={index}
            className="jn-twinkle"
            style={{
              left: `${(star.x * 100).toFixed(3)}%`,
              top: `${(star.y * 100).toFixed(3)}%`,
              width: `${star.size.toFixed(2)}px`,
              height: `${star.size.toFixed(2)}px`,
              '--twinkle-alpha': star.alpha.toFixed(3),
              '--twinkle-period': `${star.period.toFixed(2)}s`,
              '--twinkle-delay': `${star.delay.toFixed(2)}s`,
            } as CSSProperties}
          />
        ))}
      </div>

      <header className="jn-chrome">
        <button
          type="button"
          className="jn-exit"
          aria-label="Закрити карту"
          onClick={() => navigate('/plans?tab=events')}
        >
          <CloseIcon size={18} />
        </button>
        <span className="jn-title">
          <small>Карта подій стосунків</small>
          <strong>Наш шлях</strong>
        </span>
        <span className="jn-count">{moments.length}</span>
      </header>

      <div className="jn-stage">
        {moments.length === 0 ? (
          <section className="jn-empty">
            <strong>Небо ще порожнє</strong>
            <p>Перша подія засвітить першу зірку, і шлях почнеться з неї.</p>
          </section>
        ) : (
          <ConstellationSky events={moments} onOpen={setEditing} />
        )}
      </div>

      <footer className="jn-foot">
        <p>Кожна нова подія засвітить свою зірку й дотягне промінь до попередньої.</p>
        <button type="button" className="jn-add" onClick={() => setCreating(true)}>
          <PlusIcon size={16} /> Подія
        </button>
      </footer>

      {(creating || editing) && (
        <AddEventModal
          event={editing}
          initialType="anniversary"
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSubmit={(input) => {
            if (editing) updateEvent.mutate({ id: editing.id, input });
            else addEvent.mutate(input);
          }}
        />
      )}
    </div>
  );
}
