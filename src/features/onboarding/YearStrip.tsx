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

export function YearStrip({ years, emptyCount }: YearStripProps) {
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
        {years.map((year, position) => (
          <div className="sweep-strip-year" key={year.index}>
            <div className="sweep-strip-track">
              <div
                className={`sweep-strip-fill${year.complete ? '' : ' sweep-strip-fill--current'}`}
                style={{ height: `${Math.round(year.fill * 100)}%` }}
              />
            </div>
            <span className="sweep-strip-label">
              {position % step === 0 || position === years.length - 1 ? year.label : ''}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
