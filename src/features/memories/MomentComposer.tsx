// ============================================================
// Композер спогаду — повноекранний «нотатник».
// ------------------------------------------------------------
// Форма навмисно не схожа на форму. Пара пише назву й кілька слів, а все,
// що можна ДОДАТИ, ховається за однією круглою кнопкою-скріпкою внизу
// справа: фото, кілька фото, місце, дата.
//
// Чому скріпка, а не чотири поля поспіль: поля змушують проходити повз
// кожне, навіть коли потрібне лише одне. Половина спогадів — це знімок і
// підпис; місце й дату пара чіпає рідко, і в розкладці вони мусять коштувати
// нуль висоти, поки їх не покликали.
//
// Один компонент на створення й редагування. Різниця між ними — три рядки
// (початкові значення, текст кнопки і яка мутація виконується), а два
// майже однакові екрани розійшлись би при першій же правці.
// ============================================================
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { exifDay, readExifLocation, readExifTakenAt } from '@/lib/exif';
import { reverseGeocode } from '@/lib/mapbox';
import { Photo } from '@/components/ui/Photo';
import { useToast } from '@/providers/ToastProvider';
import { CalendarIcon, CloseIcon, ImageIcon, LayersIcon, StarIcon, TrashIcon } from '@/components/icons/UiIcon';
import { MapPinIcon } from '@/components/icons/MapIcon';
import { PlaceSheet } from './PlaceSheet';
import { draftIssue, ISSUE_HINT, NOTE_LIMIT, defaultMemoryDate } from './momentDraft';
import { placeLabel } from './momentPlace';
import { formatMemoryDate } from './memoriesDate';
import { useEnsurePlacePin, useMomentMutations } from './useMoments';
import type { PlaceCandidate } from './momentPlace';
import type { Moment, MomentPlace, NewPhoto } from './useMoments';
import type { MemoryRow } from '@/types';

/** Знімок, доданий у чернетку, але ще не залитий у сховище. */
interface StagedPhoto extends NewPhoto {
  /** Стабільний ключ для React: `File` не має id, а імена повторюються. */
  key: string;
  url: string;
}

interface MomentComposerProps {
  userId: number;
  /** Наявний спогад — режим редагування. */
  moment?: Moment;
  /** Мітки карти для вибору місця. */
  places?: readonly MomentPlace[];
  onClose: () => void;
  onSaved?: (momentId: number) => void;
}

type Sheet = 'place' | null;

/** Плитка вже збереженого знімка в композері — сітка 3–4 колонки. */
const STAGE_CSS_WIDTH = 128;

export function MomentComposer({
  userId,
  moment,
  places = [],
  onClose,
  onSaved,
}: MomentComposerProps) {
  const toast = useToast();
  const { create, update, addPhotos, setCover, removePhoto } = useMomentMutations();
  const ensurePin = useEnsurePlacePin();

  const [title, setTitle] = useState(moment?.title ?? '');
  const [note, setNote] = useState(moment?.note ?? '');
  const [memoryDate, setMemoryDate] = useState(moment?.memory_date ?? defaultMemoryDate());
  const [place, setPlace] = useState<{ pinId: number | null; value: PlaceCandidate } | null>(
    moment?.place
      ? {
          pinId: moment.place.id,
          value: {
            title: moment.place.title ?? '',
            city: moment.place.city,
            country: moment.place.country,
            lat: moment.place.lat,
            lng: moment.place.lng,
          },
        }
      : null,
  );

  const [staged, setStaged] = useState<StagedPhoto[]>([]);
  const [saved, setSaved] = useState<MemoryRow[]>(moment?.photos ?? []);
  const [coverId, setCoverId] = useState<number | null>(moment?.cover_photo_id ?? null);

  const [menuOpen, setMenuOpen] = useState(false);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [exifPlace, setExifPlace] = useState<PlaceCandidate | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [saving, setSaving] = useState(false);

  /*
   * Дата й місце, підставлені з метаданих, мають право змінитись лише поки
   * пара їх не чіпала. Щойно вона відкрила календар чи обрала місце — це
   * її рішення, і наступний доданий знімок його не перепише.
   */
  const dateTouched = useRef(moment !== undefined);
  const placeTouched = useRef(moment?.place != null);

  const oneRef = useRef<HTMLInputElement>(null);
  const manyRef = useRef<HTMLInputElement>(null);
  const dateRef = useRef<HTMLInputElement>(null);

  /*
   * Прев'ю живуть на blob-URL, і браузер тримає файл у пам'яті, поки URL не
   * відкликано: десяток закритих чернеток із фото по 4 МБ лишався б у
   * вкладці до перезавантаження.
   *
   * Список ведеться в `ref`, а не в залежностях ефекту. Перша редакція
   * писала `useEffect(… , [staged])` — і прибирання спрацьовувало на КОЖНІЙ
   * зміні списку, тобто друге додане фото відкликало URL першого й ламало
   * його прев'ю просто на очах.
   */
  const blobUrls = useRef<string[]>([]);
  useEffect(() => () => { blobUrls.current.forEach(URL.revokeObjectURL); }, []);

  /** Відкрити календар: `showPicker` там, де він є, і клік там, де немає. */
  function openDatePicker() {
    dateTouched.current = true;
    const el = dateRef.current;
    if (!el) return;
    if (typeof el.showPicker === 'function') el.showPicker();
    else el.click();
  }

  const photoCount = saved.length + staged.length;
  const issue = draftIssue({ title, note, memoryDate, photoCount });

  async function stageFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setMenuOpen(false);
    const next: StagedPhoto[] = [];
    for (const [i, file] of [...files].entries()) {
      if (!file.type.startsWith('image/')) continue;
      let takenAt: string | null = null;
      let gps: { lat: number; lng: number } | null = null;
      try {
        const buffer = await file.arrayBuffer();
        takenAt = readExifTakenAt(buffer);
        gps = readExifLocation(buffer);
      } catch {
        // Метадані — приємний бонус, а не умова. Файл без них додається як є.
      }
      const url = URL.createObjectURL(file);
      blobUrls.current.push(url);
      next.push({ key: `${Date.now()}-${i}-${file.name}`, file, takenAt, url });

      if (!dateTouched.current && takenAt) {
        const day = exifDay(takenAt);
        if (day) setMemoryDate(day);
      }
      if (!placeTouched.current && gps && !exifPlace) {
        void reverseGeocode(gps.lat, gps.lng).then((geo) => {
          const candidate: PlaceCandidate = {
            title: geo.address || geo.city || 'Місце зі знімка',
            city: geo.city || null,
            country: geo.country || null,
            lat: gps.lat,
            lng: gps.lng,
          };
          setExifPlace(candidate);
          // Підставляємо мовчки, але лишаємо видимим і знімним: пара бачить
          // рядок місця й може прибрати його одним дотиком.
          setPlace((current) => current ?? { pinId: null, value: candidate });
        });
      }
    }
    setStaged((old) => [...old, ...next]);
  }

  function dropStaged(key: string) {
    setStaged((old) => {
      const gone = old.find((p) => p.key === key);
      if (gone) URL.revokeObjectURL(gone.url);
      return old.filter((p) => p.key !== key);
    });
  }

  async function save() {
    if (issue) { toast.show(ISSUE_HINT[issue]); return; }
    setSaving(true);
    try {
      let placePinId = place?.pinId ?? null;
      if (place && placePinId === null) {
        placePinId = await ensurePin.mutateAsync({ place: place.value, userId });
      }
      const draft = {
        title: title.trim(),
        note: note.trim() || null,
        memoryDate,
        placePinId,
      };

      if (moment) {
        await update.mutateAsync({ id: moment.id, draft });
        if (staged.length > 0) {
          setProgress({ done: 0, total: staged.length });
          await addPhotos.mutateAsync({
            moment, photos: staged, userId,
            onProgress: (done, total) => setProgress({ done, total }),
          });
        }
        if (coverId !== null && coverId !== moment.cover_photo_id) {
          await setCover.mutateAsync({ momentId: moment.id, photoId: coverId });
        }
        onSaved?.(moment.id);
      } else {
        setProgress({ done: 0, total: staged.length });
        const created = await create.mutateAsync({
          draft, photos: staged, userId,
          onProgress: (done, total) => setProgress({ done, total }),
        });
        onSaved?.(created.id);
      }
      onClose();
    } catch {
      // Текст помилки вже показала мутація — тут лишається не закривати
      // екран, щоб написане не зникло разом із ним.
    } finally {
      setSaving(false);
      setProgress(null);
    }
  }

  const busy = saving || ensurePin.isPending;

  if (typeof document === 'undefined') return null;

  /*
   * Портал у `document.body`, а не звичайний рендер на місці.
   *
   * Сторінка модуля лежить усередині `.page-fade` — того самого елемента,
   * що програє анімацію появи через `animation-name` на `opacity`. Такий
   * елемент створює власний stacking context, і z-index композера
   * (навіть fixed) порівнюється лише всередині нього — нижня навігація
   * (z-index 50, сусід `.content` на рівні `.app-shell`) лишалась би
   * НАД повноекранним нотатником. Живий екран це й показав: скріпку та
   * низ композера перекривав док.
   */
  return createPortal(
    <div className="mm-composer" role="dialog" aria-modal="true" aria-label="Спогад">
      <header className="mm-comp-bar">
        <button type="button" className="mm-icon-btn" onClick={onClose} aria-label="Закрити" disabled={busy}>
          <CloseIcon size={22} />
        </button>
        <button type="button" className="mm-save" onClick={() => void save()} disabled={busy || issue !== null}>
          {progress ? `${progress.done}/${progress.total}` : busy ? 'Зберігаю…' : 'Готово'}
        </button>
      </header>

      <div className="mm-comp-body">
        <input
          className="mm-title-input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Назва"
          maxLength={80}
          enterKeyHint="next"
        />
        <input
          className="mm-note-input"
          value={note}
          onChange={(e) => setNote(e.target.value.slice(0, NOTE_LIMIT))}
          placeholder="Кілька слів"
          maxLength={NOTE_LIMIT}
        />

        {/* Дата й місце — рядки, а не поля: вони майже завжди вже заповнені
            (сьогодні / з метаданих), і форма не мусить про них питати. */}
        <div className="mm-meta-rows">
          <button type="button" className="mm-meta-row" onClick={openDatePicker}>
            <CalendarIcon size={16} />
            <span>{formatMemoryDate(memoryDate, 'day')}</span>
          </button>
          {place && (
            <span className="mm-meta-row mm-meta-row--place">
              <MapPinIcon size={16} />
              <span>{placeLabel(place.value)}</span>
              <button
                type="button"
                className="mm-meta-x"
                aria-label="Прибрати місце"
                onClick={() => { placeTouched.current = true; setPlace(null); }}
              >
                <CloseIcon size={14} />
              </button>
            </span>
          )}
        </div>

        {photoCount > 0 && (
          <div className="mm-stage">
            {saved.map((photo) => (
              <figure key={`s${photo.id}`} className={`mm-stage-item${coverId === photo.id ? ' is-cover' : ''}`}>
                <Photo
                  src={photo.photo_url}
                  cssWidth={STAGE_CSS_WIDTH}
                  alt=""
                  loading="lazy"
                  decoding="async"
                />
                <figcaption>
                  <button
                    type="button"
                    aria-label="Зробити обкладинкою"
                    aria-pressed={coverId === photo.id}
                    onClick={() => setCoverId(photo.id)}
                  >
                    <StarIcon size={15} filled={coverId === photo.id} />
                  </button>
                  <button
                    type="button"
                    aria-label="Видалити фото"
                    onClick={() => {
                      setSaved((old) => old.filter((p) => p.id !== photo.id));
                      if (coverId === photo.id) setCoverId(null);
                      removePhoto.mutate(photo);
                    }}
                  >
                    <TrashIcon size={15} />
                  </button>
                </figcaption>
              </figure>
            ))}
            {staged.map((photo) => (
              <figure key={photo.key} className="mm-stage-item mm-stage-item--new">
                <img src={photo.url} alt="" decoding="async" />
                <figcaption>
                  <button type="button" aria-label="Прибрати фото" onClick={() => dropStaged(photo.key)}>
                    <TrashIcon size={15} />
                  </button>
                </figcaption>
              </figure>
            ))}
          </div>
        )}

        {photoCount === 0 && (
          <p className="mm-comp-hint">
            Натисни скріпку внизу — і додай фото, місце чи дату.
          </p>
        )}
      </div>

      {/* ── Скріпка й віяло дій ───────────────────────────────── */}
      {menuOpen && (
        <button type="button" className="mm-clip-scrim" aria-label="Згорнути" onClick={() => setMenuOpen(false)} />
      )}
      <div className={`mm-clip${menuOpen ? ' is-open' : ''}`}>
        <div className="mm-clip-menu" role="menu" aria-hidden={!menuOpen}>
          {[
            { icon: <ImageIcon size={19} />, label: 'Фото', run: () => oneRef.current?.click() },
            { icon: <LayersIcon size={19} />, label: 'Кілька фото', run: () => manyRef.current?.click() },
            { icon: <MapPinIcon size={19} />, label: 'Місце', run: () => { setMenuOpen(false); setSheet('place'); } },
            {
              icon: <CalendarIcon size={19} />,
              label: 'Дата',
              run: () => { setMenuOpen(false); openDatePicker(); },
            },
          ].map((item, i, all) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              className="mm-clip-item"
              tabIndex={menuOpen ? 0 : -1}
              // Затримка йде знизу вгору: найближча до скріпки з'являється
              // першою, і віяло читається як розкриття, а не як спалах.
              style={{ transitionDelay: `${(all.length - 1 - i) * 38}ms` }}
              onClick={item.run}
            >
              <i>{item.icon}</i>
              <span>{item.label}</span>
            </button>
          ))}
        </div>
        <button
          type="button"
          className="mm-clip-btn"
          onClick={() => setMenuOpen((v) => !v)}
          aria-expanded={menuOpen}
          aria-label={menuOpen ? 'Згорнути' : 'Додати до спогаду'}
        >
          <ClipIcon />
        </button>
      </div>

      {sheet === 'place' && (
        <PlaceSheet
          known={places}
          fromPhoto={exifPlace}
          onPick={(value, pinId) => {
            placeTouched.current = true;
            setPlace({ pinId, value });
            setSheet(null);
          }}
          onClear={() => { placeTouched.current = true; setPlace(null); setSheet(null); }}
          onClose={() => setSheet(null)}
        />
      )}

      {/* Приховані входи. `capture` навмисно не ставиться: на телефоні він
          відкрив би камеру замість галереї, а спогад найчастіше збирають
          зі знятого раніше. */}
      <input
        ref={oneRef} type="file" accept="image/*" hidden
        onChange={(e) => { void stageFiles(e.target.files); e.target.value = ''; }}
      />
      <input
        ref={manyRef} type="file" accept="image/*" multiple hidden
        onChange={(e) => { void stageFiles(e.target.files); e.target.value = ''; }}
      />
      <input
        ref={dateRef} type="date" className="mm-date-input" value={memoryDate}
        onChange={(e) => { dateTouched.current = true; if (e.target.value) setMemoryDate(e.target.value); }}
      />
    </div>,
    document.body,
  );
}

/** Скріпка. Власна, бо в наборі порталу її не було. */
function ClipIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21.44 11.05 12.25 20.24a5.5 5.5 0 0 1-7.78-7.78l9.19-9.19a3.67 3.67 0 0 1 5.19 5.19l-9.2 9.19a1.83 1.83 0 0 1-2.59-2.59l8.49-8.49" />
    </svg>
  );
}
