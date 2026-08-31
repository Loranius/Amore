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

  const today = useMemo(todayInput, []);
  const canAdd = title.trim() !== '' && date !== '' && !sweep.isSaving;

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

      <YearStrip years={sweep.summary.years} emptyCount={sweep.summary.emptyCount} />

      {sweep.step === 'done' && (
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
