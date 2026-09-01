// ============================================================
// «Наша історія» — екран, яким давня пара заповнює свої минулі роки.
// ------------------------------------------------------------
// Пара, яка разом одинадцять років і щойно завела портал, отримує
// одинадцять ОДНАКОВИХ порожніх років: рушій дає кожному 0.3, бо жоден
// модуль їх не торкнувся. Цей екран існує, щоб це полагодити — і щоб
// пара бачила, як саме кожна відповідь піднімає їхні роки.
//
// ЧОМУ НЕ АНКЕТА. Кожна відповідь створює СПРАВЖНІЙ датований рядок у
// порталі — подію, спогад, місце. Друге джерело правди («рік 2017: три
// подорожі») заповнювалось би швидше, але артефакт ріс би з чисел,
// яких у порталі немає, а пара не могла б відкрити нічого з того, що
// відповіла.
// ============================================================
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/ui/PageHeader';
import { CheckIcon } from '@/components/icons/UiIcon';
import { formatSinceDate } from '@/features/home/homeUtils';
import { ANNIVERSARY_SUGGESTIONS, useHistorySweep } from './useHistorySweep';
import { YEAR_MILESTONES, quietestYearIndex } from './sweepModel';
import { SweepPlaces } from './SweepPlaces';
import { SweepSpecies } from './SweepSpecies';
import { SweepWatched } from './SweepWatched';
import { YearStrip } from './YearStrip';
import './historySweep.css';

/** Сьогодні у вигляді `YYYY-MM-DD` — стеля для полів дати. */
function todayInput(): string {
  return new Date().toISOString().slice(0, 10);
}

export function HistorySweepPage() {
  const sweep = useHistorySweep();
  const navigate = useNavigate();

  const [startDraft, setStartDraft] = useState('');
  const [title, setTitle] = useState(ANNIVERSARY_SUGGESTIONS[0]!);
  const [date, setDate] = useState('');
  /*
   * `null` — «ще не обрано вручну». Тоді відкривається найтихіший рік:
   * прохід кидають на середині, і кидати треба там, де вже все одно
   * порожньо.
   */
  const [picked, setPicked] = useState<number | null>(null);

  const today = useMemo(todayInput, []);
  const canAdd = title.trim() !== '' && date !== '' && !sweep.isSaving;

  const years = sweep.summary.years;
  const activeIndex = picked ?? quietestYearIndex(years);
  const active = years[activeIndex];

  return (
    <div className="page sweep-page">
      <PageHeader eyebrow="Наші роки" title="Наша історія" />

      {sweep.error && (
        <p className="sweep-error">Не вдалось прочитати історію: {sweep.error.message}</p>
      )}

      {sweep.step === 'date' && (
        <section className="sweep-step">
          <h2 className="sweep-question">З якого дня ви разом?</h2>
          <p className="sweep-hint">
            Це єдина дата, на якій тримається все інше: від неї рахуються ваші роки,
            і з неї ж артефакт бере свій колір і свою форму.
          </p>
          <div className="sweep-row">
            <input
              type="date"
              className="input sweep-input"
              value={startDraft}
              max={today}
              onChange={(event) => setStartDraft(event.target.value)}
              aria-label="Дата початку стосунків"
            />
            <button
              type="button"
              className="btn"
              disabled={startDraft === '' || sweep.isSaving}
              onClick={() => void sweep.setStartDate(startDraft)}
            >
              Далі
            </button>
          </div>
        </section>
      )}

      {sweep.step !== 'date' && (
        <section className="sweep-step">
          <h2 className="sweep-question">Які дати ви святкуєте?</h2>
          <p className="sweep-hint">
            {/*
              * Найдешевша дія в усьому екрані, і варто сказати чому:
              * щорічна дата піднімає КОЖЕН минулий рік, а не той, у
              * який вона потрапила. Пара має розуміти, що чотири дотики
              * тут вартують більше за годину спогадів.
              */}
            Кожна така дата повторюється щороку — тож одна відповідь піднімає
            всі ваші роки одразу, а не лише той, у який вона трапилась.
          </p>

          {sweep.yearlyAnniversaries.length > 0 && (
            <ul className="sweep-added">
              {sweep.yearlyAnniversaries.map((entry) => (
                <li className="sweep-added-item" key={entry.id}>
                  <CheckIcon size={14} />
                  {formatSinceDate(entry.date)}
                </li>
              ))}
            </ul>
          )}

          <div className="sweep-chips">
            {ANNIVERSARY_SUGGESTIONS.map((suggestion) => (
              <button
                type="button"
                key={suggestion}
                className={`sweep-chip${title === suggestion ? ' sweep-chip--on' : ''}`}
                onClick={() => setTitle(suggestion)}
              >
                {suggestion}
              </button>
            ))}
          </div>

          <div className="sweep-row">
            <input
              type="text"
              className="input sweep-input"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              aria-label="Назва дати"
            />
            <input
              type="date"
              className="input sweep-input"
              value={date}
              max={today}
              onChange={(event) => setDate(event.target.value)}
              aria-label="Коли це було"
            />
            <button
              type="button"
              className="btn"
              disabled={!canAdd}
              onClick={() => {
                void sweep.addAnniversary({ title, date }).then(() => setDate(''));
              }}
            >
              Додати
            </button>
          </div>
        </section>
      )}

      {sweep.step === 'years' && active && (
        <section className="sweep-step">
          <div className="sweep-year-nav">
            <button
              type="button"
              className="sweep-year-arrow"
              disabled={activeIndex === 0}
              onClick={() => setPicked(Math.max(0, activeIndex - 1))}
              aria-label="Попередній рік"
            >
              ‹
            </button>
            <span className="sweep-year-name">
              {active.label} — {active.label + 1}
              <small>{active.index}-й рік{active.complete ? '' : ' · триває'}</small>
            </span>
            <button
              type="button"
              className="sweep-year-arrow"
              disabled={activeIndex >= years.length - 1}
              onClick={() => setPicked(Math.min(years.length - 1, activeIndex + 1))}
              aria-label="Наступний рік"
            >
              ›
            </button>
          </div>

          <h2 className="sweep-question">Що було того року?</h2>
          <p className="sweep-hint">
            {/*
              * Названо прямо, бо це не дрібниця: фішка вибирає не лише
              * подію, а й КАНАЛ росту. Пара має розуміти, що рік
              * подорожей і рік переїздів дадуть різні артефакти.
              */}
            Кожен дотик — це виконана справа того року. Подорож росте
            дослідженням, переїзд — сталістю, весілля — значущістю: рік
            складеться з того, чим він насправді був.
          </p>

          <div className="sweep-chips">
            {YEAR_MILESTONES.map((milestone) => (
              <button
                type="button"
                key={milestone.label}
                className="sweep-chip"
                disabled={sweep.isSaving}
                onClick={() => void sweep.addMilestone({ milestone, year: active })}
              >
                {milestone.label}
              </button>
            ))}
          </div>

          {/*
            * ЧОМУ ТУТ НЕМАЄ ЦІЛІ. Перша редакція писала «вже N із семи,
            * після яких рік перестає бути порожнім» — і сімка була
            * вигадана. Виміряно на рушії: порожній рік це 0.3, ОДНА віха
            * дає 0.392, а сім разом — 0.473. Тобто рік виходить із
            * порожнечі з першого дотику, а решта шість додають разом
            * менше, ніж перший, бо всі вони пишуть в ОДИН модуль
            * (`plans`), а наповненість зважена в бік широти.
            *
            * Лічильник із цілі перетворений на стан: він каже, що вже є,
            * і не обіцяє числа, якого рушій не дасть.
            */}
          <p className="sweep-hint">
            {(sweep.milestonesByYear.get(active.index) ?? 0) === 0
              ? 'Поки що цей рік порожній — такий самий, як усі роки, яких портал не бачив.'
              : `Уже ${sweep.milestonesByYear.get(active.index) ?? 0} — і цей рік більше не порожній.
                 Далі кожен дотик радше вирішує, ЧИМ рік був, ніж наскільки він повний.`}
          </p>
        </section>
      )}

      {sweep.step === 'years' && active && (
        <SweepPlaces
          year={active}
          count={sweep.placesByYear.get(active.index) ?? 0}
          isSaving={sweep.isSaving}
          onAdd={(place) => sweep.addPlace({ place, year: active })}
        />
      )}

      {sweep.step === 'years' && active && (
        <SweepWatched
          year={active}
          count={sweep.watchedByYear.get(active.index) ?? 0}
          isSaving={sweep.isSaving}
          onAdd={(item, type) => sweep.addWatched({ item, type, year: active })}
        />
      )}

      {sweep.step === 'years' ? (
        <YearStrip
          years={years}
          emptyCount={sweep.summary.emptyCount}
          activeIndex={activeIndex}
          onPick={setPicked}
        />
      ) : (
        <YearStrip years={years} emptyCount={sweep.summary.emptyCount} />
      )}

      {sweep.step === 'years' && <SweepSpecies yearCount={years.length} />}

      {sweep.step === 'years' && (
        <div className="sweep-actions">
          <button type="button" className="btn" onClick={() => void navigate('/')}>
            До артефакта
          </button>
        </div>
      )}
    </div>
  );
}

export default HistorySweepPage;
