// ============================================================
// «Наша історія» — розкладка екрана, без мережі.
// ------------------------------------------------------------
// Відділено від `HistorySweepPage` не заради охайності: цей екран
// НЕМОЖЛИВО зняти в пісочниці. Живий портал вимагає Supabase й логіна, а
// правило CLAUDE.md §8 вимагає перевіряти на екрані все, що пара
// побачить. Доти цей екран був єдиним місцем, де правило не виконувалось
// узагалі.
//
// Тепер розкладка бере ГОТОВИЙ `HistorySweep` пропом, тож лабораторія
// (`sweep-lab.html`) підставляє в неї вигадану пару й показує ті самі
// стани, які побачить справжня: порожній рік, повний рік, чужі рядки,
// помилку. Друга розкладка при цьому не заводиться — сторінка й
// лабораторія малюють ОДИН компонент.
//
// ЩО ЗМІНИЛОСЬ ПРОТИ ПОПЕРЕДНЬОЇ РЕДАКЦІЇ (скарга власника: «візуально
// важко зрозуміти що де»):
//
//   1. Питання про ОДИН рік зібрані в одну панель під спільною шапкою з
//      роком. Доти їх було три окремі картки, однакові на вигляд, і
//      тільки перша казала, про який рік мова: прогорнувши її, пара
//      відповідала невідомо про що.
//   2. Шапка року липка. На телефоні панель на кілька екранів заввишки,
//      і рік мусить лишатись видимим, поки пара в ньому.
//   3. Смуга років піднялась НАД панеллю — перемикач і карта всіх років
//      тепер поруч, а не через півекрана одне від одного.
//   4. Кожен рік показує, ЧИМ він наповнений (`SweepEntryList`), а не
//      число «Уже 5».
// ============================================================
import { useMemo, useState } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { CloseIcon } from '@/components/icons/UiIcon';
import { formatSinceDate } from '@/features/home/homeUtils';
import { ANNIVERSARY_SUGGESTIONS, type HistorySweep } from './useHistorySweep';
import { YEAR_MILESTONES, quietestYearIndex } from './sweepModel';
import { SweepDeclared } from './SweepDeclared';
import { SweepEntryList } from './SweepEntryList';
import { SweepPhotos } from './SweepPhotos';
import { SweepPlaces } from './SweepPlaces';
import { SweepSpecies } from './SweepSpecies';
import { SweepWatched } from './SweepWatched';
import { YearStrip } from './YearStrip';
import './historySweep.css';

/** Сьогодні у вигляді `YYYY-MM-DD` — стеля для полів дати. */
function todayInput(): string {
  return new Date().toISOString().slice(0, 10);
}

export function HistorySweepView({
  sweep, onDone,
}: { sweep: HistorySweep; onDone: () => void }) {
  const [startDraft, setStartDraft] = useState('');
  const [title, setTitle] = useState(ANNIVERSARY_SUGGESTIONS[0]!);
  const [date, setDate] = useState('');
  const [dropping, setDropping] = useState<number | null>(null);
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
  const entries = active ? sweep.entriesFor(active) : null;
  const hasForeign = entries !== null && [
    ...entries.milestone, ...entries.place, ...entries.watched,
  ].some((item) => !item.removable);

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
            <ul className="sweep-entries">
              {sweep.yearlyAnniversaries.map((entry) => (
                <li className="sweep-entry" key={entry.id}>
                  <span className="sweep-entry-name">
                    {/*
                      * НАЗВА, А НЕ САМА ДАТА. Доти тут стояли чотири
                      * однакові плашки «22 травня 2022 р.» — пара не
                      * могла сказати, котра з них перше побачення, а
                      * котру додано помилково.
                      */}
                    {entry.title === '' ? formatSinceDate(entry.date) : entry.title}
                    {entry.title !== '' && <small> · {formatSinceDate(entry.date)}</small>}
                  </span>
                  {dropping === entry.id ? (
                    <span className="sweep-entry-confirm">
                      <button
                        type="button"
                        className="sweep-entry-yes"
                        disabled={sweep.isSaving}
                        onClick={() => {
                          setDropping(null);
                          void sweep.removeAnniversary(entry.id);
                        }}
                      >
                        Прибрати
                      </button>
                      <button
                        type="button"
                        className="sweep-entry-no"
                        onClick={() => setDropping(null)}
                      >
                        Ні
                      </button>
                    </span>
                  ) : (
                    <button
                      type="button"
                      className="sweep-entry-remove"
                      disabled={sweep.isSaving}
                      onClick={() => setDropping(entry.id)}
                      aria-label={`Прибрати «${entry.title || formatSinceDate(entry.date)}»`}
                    >
                      <CloseIcon size={14} />
                    </button>
                  )}
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

      {sweep.step === 'years' && active && entries && (
        <section className="sweep-year" aria-label={`Рік ${active.label}`}>
          <header className="sweep-year-head">
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
          </header>

          <div className="sweep-part">
            <h2 className="sweep-sub">Що було того року?</h2>
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
              * Далі це був лічильник — «Уже 5». Тепер це список: п'ять із
              * іменами й кнопкою прибрати, бо саме безіменна п'ятірка й
              * була скаргою.
              */}
            <SweepEntryList
              entries={entries.milestone}
              isSaving={sweep.isSaving}
              onRemove={(entry) => void sweep.removeEntry(entry)}
              removeVerb="Прибрати"
              empty="Поки що цей рік порожній — такий самий, як усі роки, яких портал не бачив."
            />
          </div>

          <SweepPlaces
            year={active}
            entries={entries.place}
            isSaving={sweep.isSaving}
            onAdd={(place) => sweep.addPlace({ place, year: active })}
            onRemove={(entry) => void sweep.removeEntry(entry)}
          />

          <SweepWatched
            year={active}
            entries={entries.watched}
            isSaving={sweep.isSaving}
            onAdd={(item, type) => sweep.addWatched({ item, type, year: active })}
            onRemove={(entry) => void sweep.removeEntry(entry)}
          />

          {/*
            * Один раз на панель, а не під кожним із трьох списків — і
            * ОДРАЗУ за ними, до блоку чисел: посунута нижче, вона читалась
            * би приміткою до полів, яких не стосується взагалі.
            */}
          {hasForeign && (
            <p className="sweep-hint sweep-foreign-note">
              Тьмяні рядки прийшли з ваших модулів — їх міняють там, де завели.
            </p>
          )}

          {/*
            * ДРУГИЙ ШЛЯХ КРІЗЬ РІК — наприкінці, а не поруч із кожним
            * питанням (ADR-0110). Спершу екран питає, ЩО саме було; тільки
            * коли пара цього не пригадала, він питає скільки.
            */}
          <SweepDeclared
            year={active}
            counts={sweep.declared[active.startsAt] ?? {}}
            gaps={sweep.declaredGapFor(active)}
            isSaving={sweep.isSaving}
            onSet={(kind, count) => sweep.setDeclared(active, kind, count)}
          />
        </section>
      )}

      {sweep.step === 'years' && (
        <SweepPhotos
          years={years}
          asOf={sweep.asOf.slice(0, 10)}
          isSaving={sweep.isSaving}
          onImport={sweep.importPhotos}
        />
      )}

      {sweep.step === 'years' && <SweepSpecies yearCount={years.length} />}

      {sweep.step === 'years' && (
        <div className="sweep-actions">
          <button type="button" className="btn" onClick={onDone}>
            До артефакта
          </button>
        </div>
      )}
    </div>
  );
}
