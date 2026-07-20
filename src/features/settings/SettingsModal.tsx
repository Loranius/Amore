// ============================================================
// SettingsModal — тема, вихід, розміри й фото полароїда
// ------------------------------------------------------------
// Порт modules/settings.js: розміри (user_sizes, per-user, upsert)
// і менеджер фото Storage-бакету family_photos (HEIC-normalize +
// compress → upload/видалення). useSettings.ts інвалідує qk.photos()
// на кожній зміні, тож PhotoCloud на головній одразу підхоплює нове.
// ============================================================
import { useEffect, useState, type ChangeEvent, type DragEvent } from 'react';
import { useTheme } from '@/providers/ThemeProvider';
import { useAuth, useCurrentUser } from '@/providers/AuthProvider';
import { useConfirm } from '@/providers/ConfirmProvider';
import { useUsers } from '@/features/_shared/useUsers';
import { usePhotoManager, usePhotoMutations, useUserSizes, useSaveSizes } from './useSettings';
import type { InsertRow, UserName, UserSizesRow } from '@/types';

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
}

export function SettingsModal({ open, onClose }: SettingsModalProps) {
  const { theme, toggle } = useTheme();
  const { user, logout } = useAuth();

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
        <h2 className="modal-title">Налаштування</h2>
        {user && <p className="modal-sub">Профіль: {user.name}</p>}

        <button type="button" className="btn" onClick={toggle}>
          Тема: {theme === 'dark' ? 'темна' : 'світла'}
        </button>

        <div className="settings-divider" />
        <SizesSection />

        <div className="settings-divider" />
        <PhotosSection />

        <div className="settings-divider" />

        <button type="button" className="btn btn-danger" onClick={logout}>
          Вийти
        </button>

        <button type="button" className="btn btn-ghost" onClick={onClose}>
          Закрити
        </button>
      </div>
    </div>
  );
}

// ============================================================
// РОЗМІРИ
// ============================================================

function userEmoji(name: UserName): string {
  return name === 'Лєна' ? '👩' : '🧔';
}

function SizesSection() {
  const { data: users = [] } = useUsers();
  const me = useCurrentUser();
  const [activeUserId, setActiveUserId] = useState(me.id);
  const [editing, setEditing] = useState(false);

  const activeUser = users.find((u) => u.id === activeUserId);
  const isFemale = activeUser?.name === 'Лєна';
  const { data: sizes } = useUserSizes(activeUserId);

  return (
    <section className="settings-section">
      <div className="settings-section-title">Розміри 📏</div>

      {users.length > 1 && (
        <div className="chips">
          {users.map((u) => (
            <button
              key={u.id}
              type="button"
              className={`chip${u.id === activeUserId ? ' active' : ''}`}
              onClick={() => {
                setActiveUserId(u.id);
                setEditing(false);
              }}
            >
              {userEmoji(u.name)} {u.name}
            </button>
          ))}
        </div>
      )}

      {editing ? (
        <SizesEditForm
          userId={activeUserId}
          isFemale={isFemale}
          sizes={sizes ?? null}
          onDone={() => setEditing(false)}
        />
      ) : (
        <SizesView sizes={sizes ?? null} isFemale={isFemale} onEdit={() => setEditing(true)} />
      )}
    </section>
  );
}

function SizesView({
  sizes,
  isFemale,
  onEdit,
}: {
  sizes: UserSizesRow | null;
  isFemale: boolean;
  onEdit: () => void;
}) {
  const v = (val: string | number | null | undefined, unit = ''): string =>
    val !== null && val !== undefined && val !== '' ? `${val}${unit}` : '—';

  return (
    <>
      <div className="sizes-grid">
        <div className="sizes-group">
          <div className="sizes-group-title">📏 Базові габарити</div>
          <div className="sizes-row"><span>Зріст</span><b>{v(sizes?.height, ' см')}</b></div>
          <div className="sizes-row"><span>Груди</span><b>{v(sizes?.chest, ' см')}</b></div>
          <div className="sizes-row"><span>Талія</span><b>{v(sizes?.waist, ' см')}</b></div>
          <div className="sizes-row"><span>Стегна</span><b>{v(sizes?.hips, ' см')}</b></div>
        </div>
        <div className="sizes-group">
          <div className="sizes-group-title">👗 Одяг</div>
          <div className="sizes-row"><span>Міжнар.</span><b>{v(sizes?.intl_size)}</b></div>
          <div className="sizes-row"><span>EU</span><b>{v(sizes?.eu_size)}</b></div>
          <div className="sizes-row"><span>UA</span><b>{v(sizes?.ua_size)}</b></div>
        </div>
        <div className="sizes-group">
          <div className="sizes-group-title">👟 Взуття</div>
          <div className="sizes-row"><span>Устілка</span><b>{v(sizes?.insole_cm, ' см')}</b></div>
          <div className="sizes-row"><span>EU</span><b>{v(sizes?.shoe_eu)}</b></div>
          <div className="sizes-row"><span>US</span><b>{v(sizes?.shoe_us)}</b></div>
        </div>
        {isFemale && (
          <div className="sizes-group">
            <div className="sizes-group-title">🩱 Нижня білизна</div>
            <div className="sizes-row"><span>Бюстгальтер</span><b>{v(sizes?.bra)}</b></div>
            <div className="sizes-row"><span>Труси</span><b>{v(sizes?.underwear)}</b></div>
          </div>
        )}
        <div className="sizes-group">
          <div className="sizes-group-title">💍 Аксесуари</div>
          <div className="sizes-row"><span>Каблучка (безім.)</span><b>{v(sizes?.ring_ring)}</b></div>
          <div className="sizes-row"><span>Каблучка (вказ.)</span><b>{v(sizes?.ring_index)}</b></div>
        </div>
      </div>
      <button type="button" className="btn-secondary" onClick={onEdit}>
        ✏️ Редагувати розміри
      </button>
    </>
  );
}

interface SizesFormState {
  height: string;
  chest: string;
  waist: string;
  hips: string;
  intl_size: string;
  eu_size: string;
  ua_size: string;
  insole_cm: string;
  shoe_eu: string;
  shoe_us: string;
  bra: string;
  underwear: string;
  ring_ring: string;
  ring_index: string;
}

function toFormState(sizes: UserSizesRow | null): SizesFormState {
  return {
    height: sizes?.height?.toString() ?? '',
    chest: sizes?.chest?.toString() ?? '',
    waist: sizes?.waist?.toString() ?? '',
    hips: sizes?.hips?.toString() ?? '',
    intl_size: sizes?.intl_size ?? '',
    eu_size: sizes?.eu_size ?? '',
    ua_size: sizes?.ua_size ?? '',
    insole_cm: sizes?.insole_cm?.toString() ?? '',
    shoe_eu: sizes?.shoe_eu ?? '',
    shoe_us: sizes?.shoe_us ?? '',
    bra: sizes?.bra ?? '',
    underwear: sizes?.underwear ?? '',
    ring_ring: sizes?.ring_ring ?? '',
    ring_index: sizes?.ring_index ?? '',
  };
}

function numOrNull(s: string): number | null {
  const n = parseFloat(s);
  return Number.isNaN(n) ? null : n;
}
function strOrNull(s: string): string | null {
  const t = s.trim();
  return t || null;
}

function SizesEditForm({
  userId,
  isFemale,
  sizes,
  onDone,
}: {
  userId: number;
  isFemale: boolean;
  sizes: UserSizesRow | null;
  onDone: () => void;
}) {
  const [form, setForm] = useState<SizesFormState>(() => toFormState(sizes));
  const save = useSaveSizes();

  const set = (key: keyof SizesFormState) => (e: ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = () => {
    const patch: InsertRow<'user_sizes'> = {
      user_id: userId,
      height: numOrNull(form.height),
      chest: numOrNull(form.chest),
      waist: numOrNull(form.waist),
      hips: numOrNull(form.hips),
      intl_size: strOrNull(form.intl_size),
      eu_size: strOrNull(form.eu_size),
      ua_size: strOrNull(form.ua_size),
      insole_cm: numOrNull(form.insole_cm),
      shoe_eu: strOrNull(form.shoe_eu),
      shoe_us: strOrNull(form.shoe_us),
      bra: isFemale ? strOrNull(form.bra) : null,
      underwear: isFemale ? strOrNull(form.underwear) : null,
      ring_ring: strOrNull(form.ring_ring),
      ring_index: strOrNull(form.ring_index),
    };
    save.mutate(patch, { onSuccess: onDone });
  };

  return (
    <div className="sizes-edit">
      <div className="sizes-form-group">
        <div className="sizes-group-title">📏 Базові</div>
        <label className="form-field">
          <span>Зріст (см)</span>
          <input id="sz-height" name="height" type="number" value={form.height} onChange={set('height')} />
        </label>
        <label className="form-field">
          <span>Груди (см)</span>
          <input id="sz-chest" name="chest" type="number" value={form.chest} onChange={set('chest')} />
        </label>
        <label className="form-field">
          <span>Талія (см)</span>
          <input id="sz-waist" name="waist" type="number" value={form.waist} onChange={set('waist')} />
        </label>
        <label className="form-field">
          <span>Стегна (см)</span>
          <input id="sz-hips" name="hips" type="number" value={form.hips} onChange={set('hips')} />
        </label>
      </div>

      <div className="sizes-form-group">
        <div className="sizes-group-title">👗 Одяг</div>
        <label className="form-field">
          <span>Міжнар.</span>
          <input id="sz-intl" name="intlSize" type="text" value={form.intl_size} onChange={set('intl_size')} />
        </label>
        <label className="form-field">
          <span>EU</span>
          <input id="sz-eu" name="euSize" type="text" value={form.eu_size} onChange={set('eu_size')} />
        </label>
        <label className="form-field">
          <span>UA</span>
          <input id="sz-ua" name="uaSize" type="text" value={form.ua_size} onChange={set('ua_size')} />
        </label>
      </div>

      <div className="sizes-form-group">
        <div className="sizes-group-title">👟 Взуття</div>
        <label className="form-field">
          <span>Устілка (см)</span>
          <input
            id="sz-insole"
            name="insoleCm"
            type="number"
            step="0.5"
            value={form.insole_cm}
            onChange={set('insole_cm')}
          />
        </label>
        <label className="form-field">
          <span>EU</span>
          <input id="sz-shoe-eu" name="shoeEu" type="text" value={form.shoe_eu} onChange={set('shoe_eu')} />
        </label>
        <label className="form-field">
          <span>US</span>
          <input id="sz-shoe-us" name="shoeUs" type="text" value={form.shoe_us} onChange={set('shoe_us')} />
        </label>
      </div>

      {isFemale && (
        <div className="sizes-form-group">
          <div className="sizes-group-title">🩱 Нижня білизна</div>
          <label className="form-field">
            <span>Бюстгальтер</span>
            <input id="sz-bra" name="bra" type="text" value={form.bra} onChange={set('bra')} />
          </label>
          <label className="form-field">
            <span>Труси</span>
            <input id="sz-underwear" name="underwear" type="text" value={form.underwear} onChange={set('underwear')} />
          </label>
        </div>
      )}

      <div className="sizes-form-group">
        <div className="sizes-group-title">💍 Каблучки</div>
        <label className="form-field">
          <span>Безіменний</span>
          <input id="sz-ring" name="ringRing" type="text" value={form.ring_ring} onChange={set('ring_ring')} />
        </label>
        <label className="form-field">
          <span>Вказівний</span>
          <input id="sz-ring-idx" name="ringIndex" type="text" value={form.ring_index} onChange={set('ring_index')} />
        </label>
      </div>

      <div className="modal-actions">
        <button type="button" className="btn-secondary" onClick={onDone}>
          Скасувати
        </button>
        <button type="button" className="btn" onClick={submit} disabled={save.isPending}>
          {save.isPending ? 'Зберігаю…' : 'Зберегти'}
        </button>
      </div>
    </div>
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
      <div className="settings-section-title">Фото полароїда 🖼</div>
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
        <span className="photo-upload-icon">＋</span>
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
              <img src={p.url} alt="" loading="lazy" />
              <button
                type="button"
                className="photo-manager-del"
                title="Видалити"
                disabled={deletingName === p.name}
                onClick={() => void onDelete(p.name)}
              >
                ✕
              </button>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
