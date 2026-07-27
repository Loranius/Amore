// ============================================================
// AddPinModal — нове місце (порт openAddModal)
// ============================================================
import { useState } from 'react';
import { todayISO } from '@/lib/utils';
import { normalize } from '@/lib/images';
import { CATEGORIES, CATEGORY_ORDER } from './mapConstants';
import { useToast } from '@/providers/ToastProvider';
import { FilePickerButton } from '@/components/ui/FilePickerButton';
import type { PinCategory } from '@/types';

interface AddPinModalProps {
  lat: number;
  lng: number;
  initialTitle?: string | undefined;
  onClose: () => void;
  onSubmit: (payload: {
    title: string; category: PinCategory; note: string | null;
    file: File | null; visitedAt: string;
  }) => void;
}

export function AddPinModal({ lat, lng, initialTitle = '', onClose, onSubmit }: AddPinModalProps) {
  const toast = useToast();
  const [title, setTitle] = useState(initialTitle);
  const [category, setCategory] = useState<PinCategory>('visited');
  const [note, setNote] = useState('');
  const [file, setFile] = useState<File | null>(null);
  // За замовчуванням сьогодні, але змінюване: мітку часто ставлять уже
  // після поїздки, і саме ця дата вирішує, в який день архіву
  // «Спогадів» стане фото місця.
  const [visitedAt, setVisitedAt] = useState(todayISO());
  const [preview, setPreview] = useState<string | null>(null);

  const pickFile = async (f: File) => {
    let normalized = f;
    try {
      normalized = await normalize(f); // HEIC → JPEG для прев'ю
    } catch (e) {
      toast.show('Не вдалося обробити HEIC-фото: ' + (e as Error).message);
      return;
    }
    setFile(normalized);
    setPreview(URL.createObjectURL(normalized));
  };

  const save = () => {
    const t = title.trim();
    if (!t) return;
    onSubmit({ title: t, category, note: note.trim() || null, file, visitedAt });
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-sheet" role="dialog" aria-modal="true">
        <h2 className="modal-title">Нове місце</h2>

        <label className="form-field">
          <span>Назва</span>
          <input
            id="pin-title"
            name="title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Наприклад, Ресторан Gaspar"
            autoFocus
          />
        </label>

        <div className="form-field">
          <span>Категорія</span>
          <div className="pin-category-grid">
            {CATEGORY_ORDER.map((key) => {
              const cat = CATEGORIES[key];
              return (
                <button
                  key={key}
                  type="button"
                  className={`pin-cat-btn${category === key ? ' active' : ''}`}
                  onClick={() => setCategory(key)}
                >
                  {cat.emoji} {cat.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="form-field">
          <span>Фото місця</span>
          <FilePickerButton id="pin-photo-file" onPick={(f) => void pickFile(f)}>
            🖼 Обрати з пристрою
          </FilePickerButton>
          {preview && <img className="pin-add-preview" src={preview} alt="" />}
        </div>

        <label className="form-field">
          <span>Коли були</span>
          <input
            id="pin-visited"
            name="visited_at"
            type="date"
            value={visitedAt}
            onChange={(e) => setVisitedAt(e.target.value)}
          />
        </label>

        <label className="form-field">
          <span>Нотатка</span>
          {/* Не «враження»: враження — окреме поле в модалці перегляду, і
              коли обидва плейсхолдери обіцяли одне й те саме, текст
              розтікався по двох колонках, з яких показувалась одна. */}
          <textarea id="pin-note" name="note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Деталь, яку не хочеться забути…" />
        </label>

        <p className="pin-coords">📌 {lat.toFixed(4)}, {lng.toFixed(4)}</p>

        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Скасувати
          </button>
          <button type="button" className="btn" onClick={save} disabled={!title.trim()}>
            Зберегти
          </button>
        </div>
      </div>
    </div>
  );
}
