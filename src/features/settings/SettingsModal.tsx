// ============================================================
// SettingsModal — тема, вихід і фото полароїда
// ------------------------------------------------------------
// Менеджер фото Storage-бакету family_photos (HEIC-normalize +
// compress → upload/видалення). useSettings.ts інвалідує qk.photos()
// на кожній зміні, тож грань «Фотографії» кристала на головній одразу
// підхоплює нове.
//
// **РОЗМІРІВ ТУТ БІЛЬШЕ НЕМАЄ.** Вони стали окремим модулем «Заміри» в
// «Ще», поруч із грою: налаштування відкривають, щоб щось ЗМІНИТИ, а
// заміри — щоб ПОДИВИТИСЬ, здебільшого стоячи в магазині. Разом із ними
// пішла й вкладка: коли вкладка лишається одна, вона перестає бути
// вибором і стає зайвим рядком над вмістом.
// ============================================================
import { useEffect, useState, type ChangeEvent, type DragEvent } from 'react';
import { Link } from 'react-router-dom';
import { Photo } from '@/components/ui/Photo';
import { ModalClose } from '@/components/ui/ModalClose';
import { useAuth } from '@/providers/AuthProvider';
import { useConfirm } from '@/providers/ConfirmProvider';
import { MoonIcon, PlusIcon, SunIcon, TrashIcon } from '@/components/icons/UiIcon';
import { useTheme } from '@/providers/ThemeProvider';
import { usePhotoManager, usePhotoMutations } from './useSettings';

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
}

export function SettingsModal({ open, onClose }: SettingsModalProps) {
  const { user, logout } = useAuth();
  const confirmDialog = useConfirm();

  const confirmLogout = async () => {
    if (await confirmDialog('Вийти з порталу? Щоб повернутись, знадобиться PIN.')) logout();
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="modal-sheet settings-modal-sheet"
        role="dialog"
        aria-modal="true"
        aria-label="Налаштування"
      >
        <ModalClose onClose={onClose} />
        <h2 className="modal-title">Налаштування</h2>
        {user && <p className="modal-sub">Профіль: {user.name}</p>}

        <PhotosSection />

        <div className="settings-divider" />

        {/*
          * Вхід у заповнення історії.
          *
          * Не в доці й не в «Ще»: це не модуль, а робота, яку роблять
          * кілька разів за життя порталу. Але й не захована — пара, яка
          * разом давно, інакше ніколи не дізнається, що її минулі роки
          * можна підняти з порожньої стелі.
          */}
        <section className="settings-section">
          <div className="settings-section-title">Наша історія</div>
          <Link className="btn btn-ghost settings-history" to="/start" onClick={onClose}>
            Заповнити минулі роки
          </Link>
        </section>

        <div className="settings-divider" />


        <div className="settings-divider" />

        <ThemeSection />

        {/*
          * «Вийти» тиха, і це не боязкість.
          *
          * Була `btn btn-danger` на всю ширину — найгучніше на екрані,
          * гучніше за будь-яке «Зберегти» в порталі. Вихід не є ані
          * головною дією налаштувань, ані частою; він просто мусить
          * бути знайденим. І він тепер питає: пароль у порталі — PIN, і
          * випадковий тап коштує повторного входу вдвох.
          *
          * «Закрити» звідси пішла: хрестик угорі робить те саме
          * (ADR-0051), а дві кнопки з одним значенням — це вибір, якого
          * немає.
          */}
        <div className="modal-actions settings-actions">
          <button type="button" className="btn btn-ghost settings-logout" onClick={() => void confirmLogout()}>
            Вийти з порталу
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// ТЕМА
// ============================================================

/**
 * Вибір теми.
 *
 * Сегмент, а не перемикач: тем рівно дві й обидві мають імена, тож
 * показати обидві чесніше, ніж ховати одну за станом тумблера. Той самий
 * вибір намальований на обох аркушах референсу.
 */
function ThemeSection() {
  const { theme, setTheme } = useTheme();
  return (
    <section className="settings-section">
      <div className="settings-section-title">Тема</div>
      <div className="settings-switch" role="group" aria-label="Тема порталу">
        <button
          type="button"
          className={`settings-switch-btn${theme === 'light' ? ' is-on' : ''}`}
          aria-pressed={theme === 'light'}
          onClick={() => setTheme('light')}
        >
          <SunIcon size={18} />
          Світла
        </button>
        <button
          type="button"
          className={`settings-switch-btn${theme === 'dark' ? ' is-on' : ''}`}
          aria-pressed={theme === 'dark'}
          onClick={() => setTheme('dark')}
        >
          <MoonIcon size={18} />
          Темна
        </button>
      </div>
    </section>
  );
}

// ============================================================
// ФОТО ПОЛАРОЇДА
// ============================================================

function PhotosSection() {
  const { data: photos = [], isPending } = usePhotoManager();
  const { upload, remove } = usePhotoMutations();
  const confirmDialog = useConfirm();
  const [dragOver, setDragOver] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [deletingName, setDeletingName] = useState<string | null>(null);

  const handleFiles = async (files: File[]) => {
    if (!files.length) return;
    setProgress({ done: 0, total: files.length });
    for (const file of files) {
      try {
        await upload.mutateAsync(file);
      } catch {
        // Тост про помилку вже показано в onError мутації — переходимо далі.
      }
      setProgress((p) => (p ? { done: p.done + 1, total: p.total } : p));
    }
    setTimeout(() => setProgress(null), 1200);
  };

  const onInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    void handleFiles(files);
  };

  const onDrop = (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files).filter(
      (f) => f.type.startsWith('image/') || /\.(heic|heif)$/i.test(f.name),
    );
    void handleFiles(files);
  };

  const onDelete = async (name: string) => {
    if (!(await confirmDialog('Видалити це фото з полароїда?'))) return;
    setDeletingName(name);
    try {
      await remove.mutateAsync(name);
    } catch {
      // Тост про помилку вже показано в onError мутації.
    } finally {
      setDeletingName(null);
    }
  };

  return (
    <section className="settings-section">
      {/* Назви секції немає: вкладка «Фото» вже двома рядками вище. */}
      <p className="settings-section-desc">
        Фото з&apos;являються на головному екрані. Рекомендований формат — квадрат.
      </p>

      <label
        className={`photo-upload-zone${dragOver ? ' drag-over' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
      >
        <span className="photo-upload-icon" aria-hidden="true"><PlusIcon size={22} /></span>
        <span className="photo-upload-label">Додати фото</span>
        <input
          id="settings-photo-file"
          name="photoFile"
          type="file"
          accept="image/*,.heic,.heif"
          multiple
          onChange={onInputChange}
          style={{ display: 'none' }}
        />
      </label>

      {progress && (
        <div className="photo-upload-progress">
          <div
            className="photo-upload-bar"
            style={{ width: `${Math.round((progress.done / progress.total) * 100)}%` }}
          />
          <span className="photo-upload-status">
            {progress.done < progress.total
              ? `Завантажується ${progress.done + 1} з ${progress.total}…`
              : `Готово! Завантажено ${progress.done} з ${progress.total}`}
          </span>
        </div>
      )}

      <div className="photo-manager-grid">
        {isPending ? (
          <p className="photo-manager-loading">Завантаження…</p>
        ) : photos.length === 0 ? (
          <p className="empty-state">Фото ще немає. Додай перше!</p>
        ) : (
          photos.map((p) => (
            <div
              key={p.name}
              className={`photo-manager-thumb${deletingName === p.name ? ' deleting' : ''}`}
            >
              {/*
                * Сітка `auto-fill, minmax(84px, 1fr)` — тобто картка
                * близько 84–110 CSS px. Сирий `<img src={p.url}>` тягнув
                * сюди ОРИГІНАЛ: у пари це в середньому 416 КБ на знімок
                * при 21 КБ, яких вистачає на цей розмір.
                */}
              <Photo src={p.url} cssWidth={110} alt="" loading="lazy" />
              <button
                type="button"
                className="photo-manager-del"
                aria-label="Видалити фото"
                disabled={deletingName === p.name}
                onClick={() => void onDelete(p.name)}
              >
                <TrashIcon size={14} />
              </button>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
