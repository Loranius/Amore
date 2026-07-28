// ============================================================
// Віджет «Плани» на головній.
// ------------------------------------------------------------
// Модуль щойно отримав місце в нижній панелі, але головна про нього
// мовчала: щоб дізнатись, що найближче й що ще треба зробити, треба
// було спершу туди зайти.
//
// Картку не переписуємо — це та сама `NextPlanCard`, що на сторінці
// планів. Друга реалізація «найближчого» розійшлася б із першою на
// першій же зміні правил (а вони вже мінялись: непідтверджена
// пропозиція найближчою не стає).
// ============================================================
import { Link } from 'react-router-dom';
import { pluralUA } from '@/lib/utils';
import { NextPlanCard } from '@/features/plans/NextPlanCard';
import { isClosed, nextPlan } from '@/features/plans/planModel';
import { usePlans } from '@/features/plans/usePlans';
import '@/features/plans/plans.css';

export function HomePlansCard() {
  const { data: plans = [], isPending } = usePlans();

  // Поки вантажиться — нічого: скелет під кристалом смикав би сторінку
  // рівно там, де щойно з'явився сам кристал.
  if (isPending) return null;

  const next = nextPlan(plans);
  const open = plans.filter((p) => !isClosed(p)).length;

  // Жодного плану — жодного блоку. Головна не місце для докору за
  // порожній модуль.
  if (open === 0 && !next) return null;

  return (
    <section className="home-plans">
      <div className="home-plans-hd">
        <h2>Плани</h2>
        <Link className="home-plans-all" to="/plans">Усі плани</Link>
      </div>

      {next ? (
        <NextPlanCard plan={next} />
      ) : (
        /* Плани є, але з точною датою попереду — жодного. Тоді чесніше
           сказати скільки їх у роботі, ніж вигадувати «найближчий». */
        <Link className="home-plans-empty" to="/plans">
          {open} {pluralUA(open, ['план', 'плани', 'планів'])} у роботі · без дати
        </Link>
      )}
    </section>
  );
}
