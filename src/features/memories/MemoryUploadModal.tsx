// ============================================================
// Додавання одного спогаду.
// ------------------------------------------------------------
// Найважливіше тут — вибір ТОЧНОСТІ дати. Дата завантаження ніколи не
// стає датою спогаду мовчки: за замовчуванням підставляється сьогодні,
// але користувач може сказати «травень 2024» чи «приблизно 2019» і
// поставити старе фото в правильне місце хронології.
// ============================================================
import { useState } from 'react';
import { todayISO } from '@/lib/utils';
import { normalizeMemoryDate, formatMemoryDate } from './memoriesDate';
import type { UploadMemoryInput } from './useMemories';
import type { MemoryPrecision } from '@/types';

const PRECISIONS: Array<{ value: MemoryPrecision; label: string }> = [
  { value: 'day', label: 'Точний день' },
  { value: 'month', label: 'Місяць і рік' },
  { value: 'year', label: 'Лише рік' },
  { value: 'approx', label: 'Приблизно' },
];

interface MemoryUploadModalProps {
  userId: number;
  busy: boolean;
  onClose: () => void;
  onSubmit: (input: UploadMemoryInput) => void;
}

export function MemoryUploadModal({ userId, busy, onClose, onSubmit }: MemoryUploadModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [date, setDate] = useState(todayISO());
  const [precision, setPrecision] = useState<MemoryPrecision>('day');
  const [caption, setCaption] = useState('');

  const pick = (picked: File | null) => {
    setFile(picked);
    setPreview((old) => {
      if (old) URL.revokeObjectURL(old);
      return picked ? URL.createObjectURL(picked) : null;
    });
  };

  const close = () => {
    if (preview) URL.revokeObjectURL(preview);
    onClose();
  };

  const save = () => {
    if (!file || busy) return;
    onSubmit({
      file,
      date: normalizeMemoryDate(date, precision),
      precision,
      caption: caption.trim() || null,
      userId,
    });
  };

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div className="modal-sheet" role="dialog" aria-modal="true">
        <h2 className="modal-title">Новий спогад</h2>

        <label className="form-field">
          <span>Фотографія</span>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => pick(e.target.files?.[0] ?? null)}
          />
        </label>

        {preview && <img className="mem-upload-preview" src={preview} alt="" />}

        <div className="form-field">
          <span>Що відомо про дату</span>
          <div className="chips">
            {PRECISIONS.map((p) => (
              <button
                key={p.value}
                type="button"
                className={`chip${precision === p.value ? ' active' : ''}`}
                onClick={() => setPrecision(p.value)}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <label className="form-field">
          <span>Дата</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>

        {/* Показуємо, як спогад справді підпишеться: при точності «місяць»
            число з поля не має значення, і краще це побачити до збереження. */}
        <p className="mem-upload-hint">
          У хронології: <b>{formatMemoryDate(normalizeMemoryDate(date, precision), precision)}</b>
        </p>

        <label className="form-field">
          <span>Підпис (необов'язково)</span>
          <textarea
            rows={2}
            value={caption}
            maxLength={500}
            onChange={(e) => setCaption(e.target.value)}
            style={{ resize: 'vertical' }}
          />
        </label>

        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={close}>Скасувати</button>
          <button type="button" className="btn" onClick={save} disabled={!file || busy}>
            {busy ? 'Додаю…' : 'Зберегти'}
          </button>
        </div>
      </div>
    </div>
  );
}
