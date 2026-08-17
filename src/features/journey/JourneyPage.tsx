// ============================================================
// «Наш шлях» на весь екран — власний зоряний простір пари.
// ------------------------------------------------------------
// Це єдиний маршрут застосунку, який забирає екран цілком: док і бічна панель
// ідуть з дороги (`useImmersiveRoute`), а кристала тут немає взагалі.
//
// Кристал ховати не довелось: світ видимий лише під `[data-portal-scene]`,
// який ставить `useWorldVisibleRoute`. Ця сторінка його не викликає — і тим
// самим лишається на власному небі, не пов'язаному з артефактом. Поки вона
// відкрита, світовому полотну ще й зупинено цикл кадрів: контекст живий, але
// невидиму сцену ніхто не малює.
//
// Саме небо — WebGL, не CSS: скайбокс навколо камери, зірки подій у X/Y/Z,
// обертання на 360°. Що з цього чому саме так — у `scene/`.
// ============================================================
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CloseIcon, PlusIcon } from '@/components/icons/UiIcon';
import { useEvents } from '@/features/_shared/events';
import { useCrystalSeed } from '@/features/home/useHome';
import { useCalendarMutations } from '@/features/calendar/useCalendar';
import { AddEventModal } from '@/features/calendar/AddEventModal';
import { useImmersiveRoute } from '@/features/world/useImmersiveRoute';
import type { EventRow } from '@/types';
import type { ConstellationEvent } from './constellationRules';
import { JourneyScene } from './scene/JourneyScene';
import './journeyScene.css';

function isJourneyEvent(event: EventRow): boolean {
  return event.type === 'anniversary';
}

/** Розкладці потрібні три поля, і жодного більше. */
function toConstellationEvent(event: EventRow): ConstellationEvent {
  return { id: event.id, date: event.date, significance: event.significance };
}

export function JourneyPage() {
  useImmersiveRoute();
  const navigate = useNavigate();
  const { seed } = useCrystalSeed();
  const { data: events = [] } = useEvents();
  const { addEvent } = useCalendarMutations();
  const [creating, setCreating] = useState(false);

  // Читається один раз: поки сторінка відкрита, відповідь не змінюється, а
  // підписка на медіазапит коштувала б слухача заради цього.
  const [reducedMotion] = useState(
    () => typeof window !== 'undefined'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );

  const moments = useMemo(() => events.filter(isJourneyEvent), [events]);
  const sceneEvents = useMemo(() => moments.map(toConstellationEvent), [moments]);

  return (
    <div className="journey-page">
      {moments.length === 0 ? (
        <section className="jn-empty">
          <strong>Небо ще порожнє</strong>
          <p>Перша подія засвітить першу зірку, і шлях почнеться з неї.</p>
        </section>
      ) : (
        <JourneyScene events={sceneEvents} seed={seed} reducedMotion={reducedMotion} />
      )}

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

      <footer className="jn-foot">
        <p>Кожна нова подія засвітить свою зірку й дотягне промінь до попередньої.</p>
        <button type="button" className="jn-add" onClick={() => setCreating(true)}>
          <PlusIcon size={16} /> Подія
        </button>
      </footer>

      {creating && (
        <AddEventModal
          event={null}
          initialType="anniversary"
          onClose={() => setCreating(false)}
          onSubmit={(input) => addEvent.mutate(input)}
        />
      )}
    </div>
  );
}
