// ============================================================
// HomePage — головна (композиція блоків)
// ------------------------------------------------------------
// Ділить кеш подій із календарем (useEvents → qk.events()).
// ============================================================
import { useEvents } from '@/features/_shared/events';
import { useStartDate } from './useHome';
import { Greeting, Counter, NextEvent } from './HomeBlocks';
import { PhotoCloud } from './PhotoCloud';
import { MiniWidgets, WeekWidget } from './HomeWidgets';

export function HomePage() {
  const startDate = useStartDate();
  const { data: events = [] } = useEvents();

  return (
    <section className="home">
      <Greeting />

      <div className="home-counter-wrap">
        <PhotoCloud />
        <Counter startDate={startDate} />
      </div>

      <MiniWidgets />
      <NextEvent events={events} />
      <WeekWidget events={events} />
    </section>
  );
}
