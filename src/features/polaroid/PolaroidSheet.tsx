// ============================================================
// Полароїд — аркуш із фотографіями, що висять на острові кристала.
// ------------------------------------------------------------
// Живе у «Спогадах», і поруч зі спогадами мусить одразу сказати, ЧИМ від
// них відрізняється, — інакше пара питатиме «а куди це піде?» щоразу.
// Тому перший рядок аркуша каже дві речі: куди фото потрапить (на острів,
// поруч із кристалом) і що від нього НЕ вимагається (ні назви, ні дати,
// ні місця).
//
// Аркуш, а не окремий маршрут: це робота на хвилину, після якої пара
// повертається до стрічки, а не переходить кудись.
// ============================================================
import { useState, type ChangeEvent, type DragEvent } from 'react';
import { ModalClose } from '@/components/ui/ModalClose';
import { EmptyState } from '@/components/ui/EmptyState';
import { Photo } from '@/components/ui/Photo';
import { PlusIcon, TrashIcon } from '@/components/icons/UiIcon';
import { CameraIcon } from '@/components/icons/NavIcon';
import { useConfirm } from '@/providers/ConfirmProvider';
import { usePolaroidPhotos, usePolaroidMutations } from './usePolaroid';
import './polaroid.css';

/**
 * Ширина мініатюри в CSS-пікселях.
 *
 * Число тут, а не лише в CSS, бо його читає `<Photo>`, щоб попросити у
 * сховища рівно такий розмір. Сітка — `auto-fill, minmax(96px, 1fr)`,
 * тобто картка виходить 96–130 px; беремо стелю.
 */
const THUMB_CSS_PX = 130;

export function PolaroidSheet({ onClose }: { onClose: () => void }) {
  const { data: photos = [], isPending, isError } = usePolaroidPhotos();
  const { upload, remove } = usePolaroidMutations();
  const confirmDialog = useConfirm();
  const [dragOver, setDragOver] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [deletingName, setDeletingName] = useState<string | null>(null);

  /*
   * Файли ллються ПО ОДНОМУ, і це не лінь, а мобільний інтернет: десять
   * паралельних завантажень на 3G дають десять таймаутів замість перших
   * трьох фото. Помилка одного файлу не спиняє решту — тост про неї вже
   * показала мутація.
   */
  const handleFiles = async (files: File[]) => {
    if (!files.length) return;
    setProgress({ done: 0, total: files.length });
    for (const file of files) {
      try {
        await upload.mutateAsync(file);
      } catch {
        // Уже названо тостом в `onError` мутації — йдемо далі.
      }
      setProgress((p) => (p ? { done: p.done + 1, total: p.total } : p));
    }
    setTimeout(() => setProgress(null), 1200);
  };

  const onInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    void handleFiles(files);
  };

  const onDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setDragOver(false);
    const files = Array.from(event.dataTransfer.files).filter(
      (f) => f.type.startsWith('image/') || /\.(heic|heif)$/i.test(f.name),
    );
    void handleFiles(files);
  };

  const onDelete = async (name: string) => {
    // Питаємо, бо видалення тут остаточне: файл іде зі сховища, і
    // скасувати його нічим.
    if (!(await confirmDialog('Прибрати це фото з полароїда?'))) return;
    setDeletingName(name);
    try {
      await remove.mutateAsync(name);
    } catch {
      // Уже названо тостом в `onError` мутації.
    } finally {
      setDeletingName(null);
    }
  };

  return (
    <div
      className="modal-overlay"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="modal-sheet pl-sheet" role="dialog" aria-modal="true" aria-label="Полароїд">
        <ModalClose onClose={onClose} />
        <h2 className="modal-title">Полароїд</h2>
        <p className="pl-lead">
          Ці фото висять на острові поруч із кристалом. Ні назви, ні дати, ні
          місця — просто фото.
        </p>

        <label
          className={`pl-drop${dragOver ? ' is-over' : ''}`}
          onDragOver={(event) => {
            event.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
        >
          <span className="pl-drop-icon" aria-hidden="true"><PlusIcon size={22} /></span>
          <span className="pl-drop-label">Додати фото</span>
          <input
            id="polaroid-file"
            name="polaroidFile"
            className="pl-file"
            type="file"
            accept="image/*,.heic,.heif"
            multiple
            onChange={onInputChange}
          />
        </label>

        {progress && (
          <div className="pl-progress">
            <div
              className="pl-progress-bar"
              style={{ width: `${Math.round((progress.done / progress.total) * 100)}%` }}
            />
            <span className="pl-progress-status">
              {progress.done < progress.total
                ? `Завантажую ${progress.done + 1} з ${progress.total}…`
                : `Готово — ${progress.done} з ${progress.total}`}
            </span>
          </div>
        )}

        {isError ? (
          <p className="pl-note">Не вдалось прочитати фото зі сховища.</p>
        ) : isPending ? (
          <p className="pl-note">Дивлюсь…</p>
        ) : photos.length === 0 ? (
          <EmptyState
            icon={<CameraIcon size={26} />}
            title="На полароїді ще порожньо"
            hint="Перше фото з’явиться на острові з наступним відкриттям головної."
          />
        ) : (
          <ul className="pl-grid">
            {photos.map((photo) => (
              <li
                key={photo.name}
                className={`pl-thumb${deletingName === photo.name ? ' is-going' : ''}`}
              >
                <Photo src={photo.url} cssWidth={THUMB_CSS_PX} alt="" loading="lazy" />
                <button
                  type="button"
                  className="pl-del"
                  aria-label="Прибрати фото з полароїда"
                  disabled={deletingName === photo.name}
                  onClick={() => void onDelete(photo.name)}
                >
                  <TrashIcon size={14} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
