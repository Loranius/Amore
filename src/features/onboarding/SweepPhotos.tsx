// ============================================================
// «Світлини минулих років» — шостий і останній модуль проходу.
// ------------------------------------------------------------
// ЧОМУ ЦЕ НЕ ТЕ, ЩО ВЖЕ Є В КОМПОЗЕРІ. Композер бере скільки завгодно
// файлів, але кладе їх в ОДИН спогад, датований EXIF-ом першого. Для
// сьогоднішньої події це правильно. Для плівки за вісім років це один
// спогад одного дня — тобто видимість роботи при порожніх роках.
//
// Тут файли групуються по ДНЮ зйомки: день — один спогад. Одиниця не
// вигадана, нею портал уже міряє галерею (`memory_days`).
//
// ЩО ЦЕЙ КРОК НЕ ОБІЦЯЄ. Світлина без дати в метаданих не імпортується:
// вигадати день не можна, а спогад із вигаданим днем гірший за
// відсутній. Таких буде багато — виміряно на робочій базі, з 61 світлини
// пари дату мали 11, — і саме тому число пропущених показане нарівні з
// числом знайдених, а не сховане.
// ============================================================
import { useRef, useState } from 'react';
import { formatSinceDate } from '@/features/home/homeUtils';
import { plural } from '@/lib/plural';
import { planPhotoImport, type PhotoImportPlan } from './photoImport';
import { scanPhotos } from './scanPhotos';
import type { ImportProgress, PhotoImportResult } from './useHistorySweep';
import type { RelationshipYearFill } from './yearFills';

interface SweepPhotosProps {
  years: readonly RelationshipYearFill[];
  asOf: string;
  isSaving: boolean;
  onImport: (
    plan: PhotoImportPlan<File>,
    onProgress?: (progress: ImportProgress) => void,
  ) => Promise<PhotoImportResult>;
}

type Stage =
  | { kind: 'idle' }
  | { kind: 'scanning'; done: number; total: number }
  | { kind: 'ready'; plan: PhotoImportPlan<File> }
  | { kind: 'importing'; plan: PhotoImportPlan<File>; progress: ImportProgress }
  | { kind: 'done'; result: PhotoImportResult };

/** «день / дні / днів» — правило спільне, слова свої. */
const dayWord = (count: number) => plural(count, 'день', 'дні', 'днів');

export function SweepPhotos({ years, asOf, isSaving, onImport }: SweepPhotosProps) {
  const input = useRef<HTMLInputElement>(null);
  const [stage, setStage] = useState<Stage>({ kind: 'idle' });

  async function pickFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const chosen = [...files].filter((file) => file.type.startsWith('image/'));
    if (chosen.length === 0) return;

    setStage({ kind: 'scanning', done: 0, total: chosen.length });
    const scanned = await scanPhotos(chosen, (done, total) => {
      setStage({ kind: 'scanning', done, total });
    });
    setStage({ kind: 'ready', plan: planPhotoImport(scanned, years, asOf) });
  }

  async function runImport(plan: PhotoImportPlan<File>) {
    setStage({
      kind: 'importing',
      plan,
      progress: { days: 0, totalDays: plan.days.length, photos: 0, totalPhotos: plan.photoCount },
    });
    const result = await onImport(plan, (progress) => {
      setStage({ kind: 'importing', plan, progress });
    });
    setStage({ kind: 'done', result });
  }

  return (
    <section className="sweep-step">
      <h2 className="sweep-question">Світлини минулих років</h2>
      <p className="sweep-hint">
        Виберіть скільки завгодно — я прочитаю дату зйомки з кожної й зроблю
        по спогаду на кожен день. Світлини без дати в метаданих пропущу й скажу,
        скільки їх було.
      </p>

      <input
        ref={input}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(event) => {
          void pickFiles(event.target.files);
          // Той самий набір файлів має даватись вибрати ще раз.
          event.target.value = '';
        }}
      />

      {stage.kind === 'idle' && (
        <div className="sweep-actions sweep-actions--start">
          <button type="button" className="btn" onClick={() => input.current?.click()}>
            Вибрати світлини
          </button>
        </div>
      )}

      {stage.kind === 'scanning' && (
        <p className="sweep-said">
          Читаю метадані: {stage.done} з {stage.total}.
        </p>
      )}

      {stage.kind === 'ready' && <ImportPlanView plan={stage.plan} onRun={runImport} busy={isSaving} />}

      {stage.kind === 'importing' && (
        <p className="sweep-said">
          Створюю спогади: {stage.progress.days} з {stage.progress.totalDays} {dayWord(stage.progress.totalDays)},
          {' '}світлин {stage.progress.photos} з {stage.progress.totalPhotos}.
        </p>
      )}

      {stage.kind === 'done' && (
        <>
          <p className="sweep-said">
            {stage.result.createdDays === 0
              ? 'Нічого не створено.'
              : `Створено ${stage.result.createdDays} ${dayWord(stage.result.createdDays)}
                 і ${stage.result.createdPhotos} світлин.`}
            {stage.result.failedAt !== null
              && ` Спинилось на ${formatSinceDate(stage.result.failedAt)} — те, що вже створено,
                   лишилось на місці.`}
          </p>
          <div className="sweep-actions sweep-actions--start">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setStage({ kind: 'idle' })}
            >
              Вибрати ще
            </button>
          </div>
        </>
      )}
    </section>
  );
}

function ImportPlanView({
  plan, onRun, busy,
}: {
  plan: PhotoImportPlan<File>;
  onRun: (plan: PhotoImportPlan<File>) => Promise<void>;
  busy: boolean;
}) {
  const years = [...plan.daysByYear.entries()].sort(([a], [b]) => a - b);

  return (
    <>
      {plan.days.length === 0 ? (
        <p className="sweep-said">
          {/*
            * Найважливіший порожній стан на екрані. Мовчазне «готово»
            * тут читалось би як збій, а причина щоразу різна.
            */}
          Жодної світлини з датою, яку можна покласти у ваші роки.
          {plan.undated > 0 && ` Без дати в метаданих: ${plan.undated}.`}
          {plan.outside > 0 && ` Поза вашою історією: ${plan.outside}.`}
        </p>
      ) : (
        <>
          <p className="sweep-said">
            Знайшла {plan.photoCount} світлин за {plan.days.length} {dayWord(plan.days.length)}.
            {plan.undated > 0 && ` Без дати: ${plan.undated} — їх пропущу.`}
            {plan.outside > 0 && ` Поза вашою історією: ${plan.outside}.`}
          </p>

          {years.length > 0 && (
            <ul className="sweep-tally">
              {years.map(([yearIndex, days]) => (
                <li className="sweep-tally-item" key={yearIndex}>
                  {yearIndex}-й рік · {days} {dayWord(days)}
                </li>
              ))}
            </ul>
          )}

          <div className="sweep-actions sweep-actions--start">
            <button
              type="button"
              className="btn"
              disabled={busy}
              onClick={() => { void onRun(plan); }}
            >
              Створити спогади
            </button>
          </div>
        </>
      )}
    </>
  );
}
