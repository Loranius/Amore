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
import { PortalDecor } from '@/features/auth/PortalDecor';

export function HomePage() {
  const startDate = useStartDate();
  const { data: events = [] } = useEvents();

  return (
    <section className="home">
      <Greeting />

      <div className="home-counter-wrap">
        {/* Легша щільність і без парал акса — ділянка менша за портал
            і поруч інтерактивна хмара фото, зайвий рух тут заважав би. */}
        <PortalDecor density="light" parallax={false} />
        <PhotoCloud />
        <Counter startDate={startDate} />
      </div>

      <MiniWidgets />
      <NextEvent events={events} />
      <WeekWidget events={events} />
    </section>
  );
}
