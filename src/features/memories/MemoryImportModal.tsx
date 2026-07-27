// ============================================================
// Масовий імпорт (§8): вибрати багато → прочитати метадані → показати
// розкладку по днях → дати виправити → завантажити.
// ------------------------------------------------------------
// Попередній перегляд ДО запису — суть екрана. Виправити дату один раз
// для групи з тридцяти знімків можна лише тут; після завантаження це
// тридцять окремих правок.
// ============================================================
import { useState } from 'react';
import { todayISO } from '@/lib/utils';
import { formatMemoryDate, normalizeMemoryDate } from './memoriesDate';
import { readExifTakenAt } from '@/lib/exif';
import {
  groupFilesByDay, importSummary, isImportReady, mergeGroupsByDate,
  type ImportGroup, type ScannedFile,
} from './bulkImport';
import type { MemoryPrecision } from '@/types';

const PRECISIONS: Array<{ value: MemoryPrecision; label: string }> = [
  { value: 'day', label: 'День' },
  { value: 'month', label: 'Місяць' },
  { value: 'year', label: 'Рік' },
  { value: 'approx', label: 'Приблизно' },
];

interface MemoryImportModalProps {
  busy: boolean;
  progress: { done: number; total: number } | null;
  onClose: () => void;
  onSubmit: (
    items: Array<{ file: File; date: string; precision: MemoryPrecision; takenAt: string | null }>,
  ) => void;
}

export function MemoryImportModal({ busy, progress, onClose, onSubmit }: MemoryImportModalProps) {
  const [groups, setGroups] = useState<ImportGroup[]>([]);
  const [scanning, setScanning] = useState(false);
  const [editing, setEditing] = useState<number | null>(null);

  const scan = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setScanning(true);
    const scanned: ScannedFile[] = [];
    for (const file of Array.from(files)) {
      // Читаємо лише початок файлу: EXIF лежить у перших кілобайтах, а
      // тягнути в пам'ять сотню повних знімків телефон не пробачить.
      let takenAt: string | null = null;
      try {
        takenAt = readExifTakenAt(await file.slice(0, 128 * 1024).arrayBuffer());
      } catch {
        takenAt = null;
      }
      scanned.push({ file, takenAt });
    }
    setGroups(groupFilesByDay(scanned));
    setScanning(false);
  };

  const setGroupDate = (index: number, date: string, precision: MemoryPrecision) => {
    setGroups((current) =>
      // Злиття — на випадок, коли вказали день, який у розкладці вже є:
      // інакше той самий день стояв би у списку двічі.
      mergeGroupsByDate(
        current.map((g, i) =>
          i === index ? { ...g, date: normalizeMemoryDate(date, precision), precision } : g,
        ),
      ),
    );
    setEditing(null);
  };

  const summary = importSummary(groups);
  const ready = isImportReady(groups);

  const submit = () => {
    if (!ready || busy) return;
    onSubmit(
      groups.flatMap((g) => {
        // `ready` вже гарантує, що дати є; перевірка тут — щоб не тягнути
        // «!» і не втратити цю гарантію при майбутній зміні кнопки.
        const date = g.date;
        return date === null
          ? []
          : g.files.map((f) => ({ file: f.file, date, precision: g.precision, takenAt: f.takenAt }));
      }),
    );
  };

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}>
      <div className="modal-sheet mem-import" role="dialog" aria-modal="true">
        <h2 className="modal-title">Додати багато фото</h2>

        {groups.length === 0 ? (
          <>
            <label className="form-field">
              <span>Оберіть знімки</span>
              <input type="file" accept="image/*" multiple onChange={(e) => void scan(e.target.files)} />
            </label>
            <p className="mem-import-hint">
              {scanning
                ? 'Читаю метадані…'
                : 'Дати зйомки візьму з самих файлів і згрупую по днях. Те, що без метаданих, спитаю окремо.'}
            </p>
          </>
        ) : (
          <>
            <p className="mem-import-sum">
              {summary.total} фото · {summary.days} {summary.days === 1 ? 'день' : 'днів'}
              {summary.undated > 0 && <> · <b>{summary.undated} без дати</b></>}
            </p>

            <div className="mem-import-list">
              {groups.map((group, index) => (
                <div
                  key={index}
                  className={`mem-import-row${group.date === null ? ' mem-import-row--todo' : ''}`}
                >
                  <div className="mem-import-thumbs">
                    {group.files.slice(0, 3).map((f, i) => (
                      <span key={`${i}-${f.file.name}`} className="mem-import-thumb" aria-hidden="true" />
                    ))}
                  </div>
                  <div className="mem-import-lbl">
                    <b>{group.date ? formatMemoryDate(group.date, group.precision) : 'Без дати'}</b>
                    <span>
                      {group.files.length} фото
                      {group.date ? ' · з метаданих' : ' · метаданих немає'}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="mem-import-fix"
                    onClick={() => setEditing(editing === index ? null : index)}
                    disabled={busy}
                  >
                    {group.date ? 'Змінити' : 'Вказати'}
                  </button>

                  {editing === index && (
                    <GroupDateEditor
                      initial={group.date ?? todayISO()}
                      precision={group.precision}
                      onApply={(date, precision) => setGroupDate(index, date, precision)}
                    />
                  )}
                </div>
              ))}
            </div>

            {progress && (
              <p className="mem-import-progress">
                Завантажую {progress.done} з {progress.total}…
              </p>
            )}

            {!ready && !busy && (
              <p className="mem-import-hint">
                Вкажіть дату для групи «Без дати» — інакше ці фото стануть у день
                завантаження, а не туди, де вони справді були.
              </p>
            )}
          </>
        )}

        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>
            {busy ? 'Зачекайте…' : 'Скасувати'}
          </button>
          <button type="button" className="btn" onClick={submit} disabled={!ready || busy}>
            {busy ? 'Завантажую…' : `Додати ${summary.total || ''}`}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Редактор дати однієї групи — дата плюс те, наскільки вона точна. */
function GroupDateEditor({
  initial, precision, onApply,
}: {
  initial: string;
  precision: MemoryPrecision;
  onApply: (date: string, precision: MemoryPrecision) => void;
}) {
  const [date, setDate] = useState(initial);
  const [p, setP] = useState<MemoryPrecision>(precision);

  return (
    <div className="mem-import-editor">
      <div className="chips">
        {PRECISIONS.map((item) => (
          <button
            key={item.value}
            type="button"
            className={`chip${p === item.value ? ' active' : ''}`}
            onClick={() => setP(item.value)}
          >
            {item.label}
          </button>
        ))}
      </div>
      <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      <p className="mem-import-preview">
        Стане: <b>{formatMemoryDate(normalizeMemoryDate(date, p), p)}</b>
      </p>
      <button type="button" className="btn" onClick={() => onApply(date, p)}>Застосувати</button>
    </div>
  );
}
