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
// Сторінка НЕ керує сценою — вона на неї дивиться. Режим ухвалює машина станів
// усередині (`journeyMode.ts`), а сюди він приходить назовні, щоб під нього
// лягла розкладка: у focus-режимі небо поступається місцем деталям події.
// Спокуса тримати «яка подія відкрита» тут велика, але тоді два джерела
// правди — сторінка й машина — розійшлися б на першому ж перериванні польоту.
// ============================================================
import { useCallback, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CloseIcon, PlusIcon } from '@/components/icons/UiIcon';
import { useEvents } from '@/features/_shared/events';
import { useCrystalSeed } from '@/features/home/useHome';
import { useCalendarMutations } from '@/features/calendar/useCalendar';
import { AddEventModal } from '@/features/calendar/AddEventModal';
import { useImmersiveRoute } from '@/features/world/useImmersiveRoute';
import type { EventRow } from '@/types';
import type { ConstellationEvent } from './constellationRules';
import { EventDetails } from './EventDetails';
import { splitLayout, type JourneyMode } from './journeyMode';
import { JourneyScene } from './scene/JourneyScene';
import './journeyScene.css';

function isJourneyEvent(event: EventRow): boolean {
  return event.type === 'anniversary';
}

/** Сцені потрібні чотири поля, і жодного більше. */
function toConstellationEvent(event: EventRow): ConstellationEvent {
  return {
    id: event.id,
    date: event.date,
    significance: event.significance,
    starColor: event.star_color,
  };
}

export function JourneyPage() {
  useImmersiveRoute();
  const navigate = useNavigate();
  /**
   * `?bloom=off` вимикає сяйво.
   *
   * Той самий прийом, що вже є в порталу для `?gfx=bloom`: єдиний спосіб зняти
   * два кадри однієї сцени з різницею в одному проході й порівняти їх, а не
   * сперечатись про пам'ять. У звичайному житті прапорця немає в адресі, і
   * сяйво просто працює.
   */
  const [search] = useSearchParams();
  const { seed } = useCrystalSeed();
  const { data: events = [] } = useEvents();
  const { addEvent, updateEvent } = useCalendarMutations();

  const [mode, setMode] = useState<JourneyMode>('loading');
  const [focusId, setFocusId] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<EventRow | null>(null);
  /** Зростає з кожним проханням закрити подію — сцена читає саме зміну. */
  const [dismissSignal, setDismissSignal] = useState(0);
  /** Так само для модалки додавання: без цього машина лишиться в `addingEvent`. */
  const [addClosedSignal, setAddClosedSignal] = useState(0);

  // Читається один раз: поки сторінка відкрита, відповідь не змінюється, а
  // підписка на медіазапит коштувала б слухача заради цього.
  const [reducedMotion] = useState(
    () => typeof window !== 'undefined'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );

  const moments = useMemo(() => events.filter(isJourneyEvent), [events]);
  const sceneEvents = useMemo(() => moments.map(toConstellationEvent), [moments]);

  const handleMode = useCallback((next: JourneyMode, id: number | null) => {
    setMode(next);
    setFocusId(id);
  }, []);
  const handleRequestAdd = useCallback(() => setCreating(true), []);
  const dismiss = useCallback(() => setDismissSignal((value) => value + 1), []);

  const focused = useMemo(
    () => (focusId === null ? null : moments.find((event) => event.id === focusId) ?? null),
    [focusId, moments],
  );
  const split = splitLayout(mode);

  return (
    <div className="journey-page" data-journey-layout={split ? 'split' : 'full'}>
      {moments.length === 0 ? (
        <section className="jn-empty">
          <strong>Небо ще порожнє</strong>
          <p>Перша подія засвітить першу зірку, і шлях почнеться з неї.</p>
        </section>
      ) : (
        <JourneyScene
          events={sceneEvents}
          seed={seed}
          reducedMotion={reducedMotion}
          onMode={handleMode}
          onRequestAdd={handleRequestAdd}
          dismissSignal={dismissSignal}
          addClosedSignal={addClosedSignal}
          bloom={search.get('bloom') !== 'off'}
        />
      )}

      <header className="jn-chrome">
        <button
          type="button"
          className="jn-exit"
          aria-label={split ? 'Повернутись до сузір’я' : 'Закрити карту'}
          onClick={() => (split ? dismiss() : navigate('/plans?tab=events'))}
        >
          <CloseIcon size={18} />
        </button>
        <span className="jn-title">
          <small>Карта подій стосунків</small>
          <strong>Наш шлях</strong>
        </span>
        <span className="jn-count">{moments.length}</span>
      </header>

      {split && focused ? (
        <EventDetails
          event={focused}
          onClose={dismiss}
          onEdit={() => setEditing(focused)}
        />
      ) : (
        <footer className="jn-foot">
          <p>Торкніться зірки, щоб відкрити подію.</p>
          {/* Коло, як у «Спогадах». На зануреному маршруті дока немає, і
              кнопка сідає нижче — про це знає сам `.fab`. */}
          <button
            type="button"
            className="fab"
            aria-label="Додати подію"
            onClick={() => setCreating(true)}
          >
            <PlusIcon size={26} />
          </button>
        </footer>
      )}

      {(creating || editing) && (
        <AddEventModal
          event={editing}
          initialType="anniversary"
          onClose={() => {
            setCreating(false);
            setEditing(null);
            setAddClosedSignal((value) => value + 1);
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
