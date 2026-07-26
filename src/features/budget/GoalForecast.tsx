import { useMemo, useState } from 'react';
import { fmtMoney } from './useBudget';
import type { GoalForecast } from './useGoalForecast';
import {
  formatGoalDate,
  formatGoalMonth,
  isValidDesiredDate,
  localTodayIso,
} from './forecastModel';
import './forecast.css';

export function GoalForecastCard({
  forecast,
  isLoading,
  paused,
  onEdit,
}: {
  forecast: GoalForecast | null;
  isLoading: boolean;
  paused: boolean;
  onEdit: () => void;
}) {
  const complete = forecast !== null && forecast.remainingAmount <= 0;

  return (
    <section className="goal-forecast-card" aria-label="Орієнтовний прогноз цілі">
      <div className="goal-forecast-body">
        <div className="goal-forecast-head">
          <span><span aria-hidden="true">◔</span> Орієнтовний шлях</span>
          <button type="button" className="goal-forecast-edit" onClick={onEdit}>
            Змінити орієнтир <span aria-hidden="true">✎</span>
          </button>
        </div>

        {isLoading ? (
          <p className="goal-forecast-copy">Формуємо прогноз…</p>
        ) : complete ? (
          <p className="goal-forecast-copy goal-forecast-complete">
            Сума для цієї цілі вже зібрана ✨
          </p>
        ) : paused ? (
          <>
            <p className="goal-forecast-copy goal-forecast-paused">
              Ціль зараз відпочиває. Прогрес, історія та орієнтир збережені.
            </p>
            {forecast?.desiredDate ? (
              <div className="goal-forecast-target">
                <span>Бажаний орієнтир збережено — {formatGoalDate(forecast.desiredDate)}</span>
                <small>
                  Після відновлення прогноз продовжиться без урахування часу паузи.
                </small>
              </div>
            ) : (
              <small className="goal-forecast-hint">
                Повернутися до цієї цілі можна будь-коли, коли буде комфортно.
              </small>
            )}
          </>
        ) : (
          <>
            <p className="goal-forecast-copy">
              {forecast?.forecastDate
                ? `За теперішнього ритму — приблизно ${formatGoalMonth(forecast.forecastDate)}.`
                : 'Коли внески сформують ритм, тут з’явиться орієнтовна дата.'}
            </p>

            {forecast?.desiredDate ? (
              <div className="goal-forecast-target">
                <span>Бажаний орієнтир — {formatGoalDate(forecast.desiredDate)}</span>
                {forecast.monthlyNeeded !== null && (
                  <small>
                    Щоб м’яко рухатися до цієї дати — близько {fmtMoney(forecast.monthlyNeeded)} на місяць.
                  </small>
                )}
              </div>
            ) : (
              <small className="goal-forecast-hint">
                Можна додати бажану дату, але вона залишиться лише орієнтиром.
              </small>
            )}
          </>
        )}
      </div>

      <span className="goal-forecast-art" aria-hidden="true">
        <span className="goal-forecast-calendar-grid" />
        <span className="goal-forecast-clock">•</span>
      </span>
    </section>
  );
}

export function GoalDesiredDateModal({
  goalName,
  currentDate,
  onClose,
  onSubmit,
}: {
  goalName: string;
  currentDate: string | null;
  onClose: () => void;
  onSubmit: (desiredDate: string | null) => Promise<unknown>;
}) {
  const today = useMemo(() => localTodayIso(), []);
  const [date, setDate] = useState(currentDate ?? '');
  const [submitting, setSubmitting] = useState(false);
  const valid = date === '' || isValidDesiredDate(date, today);

  const save = async (nextDate: string | null) => {
    if (submitting || (nextDate !== null && !isValidDesiredDate(nextDate, today))) return;

    setSubmitting(true);
    try {
      await onSubmit(nextDate);
      onClose();
    } catch {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="modal-overlay"
      onClick={(event) => event.target === event.currentTarget && !submitting && onClose()}
    >
      <div className="modal-sheet goal-date-modal finance-modal-sheet" role="dialog" aria-modal="true">
        <h2 className="modal-title">Бажаний орієнтир</h2>
        <p className="fin-hint">
          «{goalName}» — це не дедлайн. Дату можна змінити або прибрати будь-коли.
        </p>

        <label className="form-field">
          <span>Бажана дата</span>
          <input
            id="goal-desired-date"
            name="desired-date"
            type="date"
            min={today}
            value={date}
            onChange={(event) => setDate(event.target.value)}
            autoFocus
          />
        </label>

        <div className="modal-actions goal-date-actions">
          {currentDate && (
            <button
              type="button"
              className="btn btn-ghost goal-date-remove"
              onClick={() => void save(null)}
              disabled={submitting}
            >
              Прибрати дату
            </button>
          )}
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={submitting}>
            Скасувати
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => void save(date || null)}
            disabled={submitting || !valid || date === ''}
          >
            {submitting ? 'Зберігаємо…' : 'Зберегти'}
          </button>
        </div>
      </div>
    </div>
  );
}
