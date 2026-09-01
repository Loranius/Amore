// ============================================================
// Смуга років — індикатор прогресу, який показує саме те, заради чого
// пара відповідає.
// ------------------------------------------------------------
// Замість «крок 2 з 4» тут стоять їхні власні роки, і кожен рівно такої
// висоти, якої його зробила історія. Порожній рік — це не нуль, а 0.3
// (стеля порожнечі), тож смуга ніколи не буває порожньою на вигляд:
// одинадцять однакових низьких стовпчиків і є те, як давня пара
// виглядає для рушія, поки її минуле не заповнене.
//
// Висота анімована навмисно: перша ж щорічна річниця піднімає ВСІ роки
// одразу, і цей стрибок — головне, що пара має побачити.
// ============================================================
import { yearsBehind } from './sweepModel';
import type { RelationshipYearFill } from './yearFills';

interface YearStripProps {
  years: RelationshipYearFill[];
  emptyCount: number;
  /** Рік, який зараз заповнюють; -1 — жодного. */
  activeIndex?: number;
  /** Смуга стає й навігацією: рік обирається дотиком по стовпчику. */
  onPick?: (index: number) => void;
}

/** Скільки років ще вміщується з підписом на кожному стовпчику. */
const LABEL_EVERY_YEAR = 8;

function yearsWord(count: number): string {
  const tens = count % 100;
  if (tens >= 11 && tens <= 14) return 'років';
  switch (count % 10) {
    case 1: return 'рік';
    case 2: case 3: case 4: return 'роки';
    default: return 'років';
  }
}

function emptyWord(count: number): string {
  return count % 10 === 1 && count % 100 !== 11 ? 'порожній' : 'порожні';
}

export function YearStrip({ years, emptyCount, activeIndex = -1, onPick }: YearStripProps) {
  if (years.length === 0) return null;
  const step = years.length <= LABEL_EVERY_YEAR ? 1 : 2;
  const completed = yearsBehind(years);
  const current = years.length > completed ? years.length : 0;

  return (
    <div className="sweep-strip">
      <p className="sweep-strip-line">
        <strong>{completed}</strong> {yearsWord(completed)} позаду
        {current > 0 && <> · іде {current}-й</>}
        {emptyCount > 0 && (
          <>
            {' · '}
            <span className="sweep-strip-empty">
              {emptyCount} {emptyWord(emptyCount)}
            </span>
          </>
        )}
      </p>

      <div className="sweep-strip-bars" role="img" aria-label={
        `Роки стосунків: ${years.length}, з них порожніх ${emptyCount}`
      }>
        {years.map((year, position) => {
          const body = (
            <>
              <div className="sweep-strip-track">
                <div
                  className={`sweep-strip-fill${year.complete ? '' : ' sweep-strip-fill--current'}`}
                  style={{ height: `${Math.round(year.fill * 100)}%` }}
                />
              </div>
              <span className="sweep-strip-label">
                {position % step === 0 || position === years.length - 1 ? year.label : ''}
              </span>
            </>
          );
          const className = `sweep-strip-year${position === activeIndex ? ' sweep-strip-year--on' : ''}`;

          /*
           * Кнопка ЛИШЕ коли по ній справді можна тицьнути. Див була б
           * простішою, але смуга під час проходу — це навігація, і
           * навігація мусить діставатись із клавіатури.
           */
          return onPick
            ? (
              <button
                type="button"
                className={className}
                key={year.index}
                onClick={() => onPick(position)}
                aria-label={`${year.label} — ${year.label + 1}, ${year.index}-й рік`}
                aria-pressed={position === activeIndex}
              >
                {body}
              </button>
            )
            : <div className={className} key={year.index}>{body}</div>;
        })}
      </div>
    </div>
  );
}
