// ============================================================
// SettingsModal — тема, вихід, розміри й фото полароїда
// ------------------------------------------------------------
// Порт modules/settings.js: розміри (user_sizes, per-user, upsert)
// і менеджер фото Storage-бакету family_photos (HEIC-normalize +
// compress → upload/видалення). useSettings.ts інвалідує qk.photos()
// на кожній зміні, тож грань «Фотографії» кристала на головній одразу
// підхоплює нове.
// ============================================================
import { useEffect, useState, type ChangeEvent, type DragEvent } from 'react';
import { Link } from 'react-router-dom';
import { ModalClose } from '@/components/ui/ModalClose';
import { useAuth, useCurrentUser } from '@/providers/AuthProvider';
import { useConfirm } from '@/providers/ConfirmProvider';
import { useUsers } from '@/features/_shared/useUsers';
import { TabBar } from '@/components/ui/TabBar';
import {
  ImageIcon, ListIcon, MoonIcon, PencilIcon, PlusIcon, SunIcon, TrashIcon, UserIcon,
} from '@/components/icons/UiIcon';
import { EmptyState } from '@/components/ui/EmptyState';
import { useTheme } from '@/providers/ThemeProvider';
import { usePhotoManager, usePhotoMutations, useUserSizes, useSaveSizes } from './useSettings';
import { useNotificationPrefs, useSaveNotificationPrefs } from './useNotificationPrefs';
import type { InsertRow, UserSizesRow } from '@/types';

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
}

// Вкладки «Тема» більше немає: тема в порталі одна (див. `ThemeProvider`),
// і перемикач, який нічого не перемикає, гірший за його відсутність.
type Section = 'sizes' | 'photos';

export function SettingsModal({ open, onClose }: SettingsModalProps) {
  const { user, logout } = useAuth();
  const confirmDialog = useConfirm();
  const [section, setSection] = useState<Section>('sizes');

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

        <TabBar<Section>
          value={section}
          onChange={setSection}
          items={[
            { value: 'sizes', label: 'Розміри', icon: <ListIcon size={15} /> },
            { value: 'photos', label: 'Фото', icon: <ImageIcon size={15} /> },
          ]}
        />

        {section === 'sizes' && <SizesSection />}
        {section === 'photos' && <PhotosSection />}

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

        <QuietDaysOffSection />

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
// РОЗМІРИ
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

/**
 * Тиша у вихідний.
 *
 * Сегмент із двох названих станів, а не тумблер, — з тієї самої причини,
 * що й у теми: станів рівно два, обидва мають імена, і показати обидва
 * чесніше, ніж ховати один за положенням перемикача.
 *
 * НАЛАШТУВАННЯ ОСОБИСТЕ. Кожен вирішує за себе, і чужий рядок не
 * редагується — це стоїть у політиці таблиці, а не лише тут.
 *
 * Правило виконує база: у день, позначений у «Графіку» як вихідний,
 * сповіщення не створюються взагалі. Порожня клітинка — не вихідний, а
 * невідомо, тож поки місяць не заповнений, тиша не вмикається.
 */
function QuietDaysOffSection() {
  const me = useCurrentUser();
  const { data: prefs, isPending } = useNotificationPrefs(me.id);
  const save = useSaveNotificationPrefs();
  const quiet = prefs?.quiet_on_days_off ?? false;

  const choose = (next: boolean) => {
    if (next === quiet || save.isPending) return;
    save.mutate({ userId: me.id, quietOnDaysOff: next });
  };

  return (
    <section className="settings-section">
      <div className="settings-section-title">Сповіщення</div>
      <p className="settings-section-desc">
        У день, позначений у «Графіку» вихідним, сповіщення не приходять.
      </p>
      <div className="settings-switch" role="group" aria-label="Сповіщення у вихідний">
        <button
          type="button"
          className={`settings-switch-btn${!quiet ? ' is-on' : ''}`}
          aria-pressed={!quiet}
          disabled={isPending || save.isPending}
          onClick={() => choose(false)}
        >
          Приходять завжди
        </button>
        <button
          type="button"
          className={`settings-switch-btn${quiet ? ' is-on' : ''}`}
          aria-pressed={quiet}
          disabled={isPending || save.isPending}
          onClick={() => choose(true)}
        >
          Тиша у вихідний
        </button>
      </div>
    </section>
  );
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
      {/*
        * Заголовка секції тут немає навмисно.
        *
        * Був рядок «Розміри 📏» — тобто те саме слово, що на активній
        * вкладці двома рядками вище. Вкладка вже сказала, де ми.
        */}
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
              <UserIcon size={14} />
              <span>{u.name}</span>
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

  /*
   * Порожні розміри показуються порожнім станом, а не стіною прочерків.
   *
   * На знімку власника з дванадцяти значень сім були «—». Таблиця, у
   * якій більшість рядків нічого не каже, — це не «ще не заповнено», це
   * шум, крізь який треба шукати те одне, що заповнене.
   */
  const filled = [
    sizes?.height, sizes?.chest, sizes?.waist, sizes?.hips,
    sizes?.intl_size, sizes?.eu_size, sizes?.ua_size,
    sizes?.insole_cm, sizes?.shoe_eu, sizes?.shoe_us,
    sizes?.bra, sizes?.underwear, sizes?.ring_ring, sizes?.ring_index,
  ].filter((one) => one !== null && one !== undefined && one !== '').length;

  if (filled === 0) {
    return (
      <EmptyState
        icon={<ListIcon size={26} />}
        title="Розміри ще не заповнені"
        hint="Зріст, одяг, взуття й каблучки — щоб не питати одне в одного перед подарунком."
        action={(
          <button type="button" className="btn" onClick={onEdit}>
            Заповнити розміри
          </button>
        )}
      />
    );
  }

  return (
    <>
      <div className="sizes-grid">
        <div className="sizes-group">
          <div className="sizes-group-title">Габарити</div>
          <div className="sizes-row"><span>Зріст</span><b>{v(sizes?.height, ' см')}</b></div>
          <div className="sizes-row"><span>Груди</span><b>{v(sizes?.chest, ' см')}</b></div>
          <div className="sizes-row"><span>Талія</span><b>{v(sizes?.waist, ' см')}</b></div>
          <div className="sizes-row"><span>Стегна</span><b>{v(sizes?.hips, ' см')}</b></div>
        </div>
        <div className="sizes-group">
          <div className="sizes-group-title">Одяг</div>
          <div className="sizes-row"><span>Міжнар.</span><b>{v(sizes?.intl_size)}</b></div>
          <div className="sizes-row"><span>EU</span><b>{v(sizes?.eu_size)}</b></div>
          <div className="sizes-row"><span>UA</span><b>{v(sizes?.ua_size)}</b></div>
        </div>
        <div className="sizes-group">
          <div className="sizes-group-title">Взуття</div>
          <div className="sizes-row"><span>Устілка</span><b>{v(sizes?.insole_cm, ' см')}</b></div>
          <div className="sizes-row"><span>EU</span><b>{v(sizes?.shoe_eu)}</b></div>
          <div className="sizes-row"><span>US</span><b>{v(sizes?.shoe_us)}</b></div>
        </div>
        {isFemale && (
          <div className="sizes-group">
            <div className="sizes-group-title">Білизна</div>
            <div className="sizes-row"><span>Бюстгальтер</span><b>{v(sizes?.bra)}</b></div>
            <div className="sizes-row"><span>Труси</span><b>{v(sizes?.underwear)}</b></div>
          </div>
        )}
        <div className="sizes-group">
          <div className="sizes-group-title">Каблучки</div>
          <div className="sizes-row"><span>Безіменний</span><b>{v(sizes?.ring_ring)}</b></div>
          <div className="sizes-row"><span>Вказівний</span><b>{v(sizes?.ring_index)}</b></div>
        </div>
      </div>
      <button type="button" className="btn btn-ghost sizes-edit-btn" onClick={onEdit}>
        <PencilIcon size={15} />
        <span>Редагувати розміри</span>
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
        <div className="sizes-group-title">Габарити</div>
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
        <div className="sizes-group-title">Одяг</div>
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
        <div className="sizes-group-title">Взуття</div>
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
          <div className="sizes-group-title">Білизна</div>
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
        <div className="sizes-group-title">Каблучки</div>
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
        <button type="button" className="btn btn-ghost" onClick={onDone}>
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
              <img src={p.url} alt="" loading="lazy" />
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
