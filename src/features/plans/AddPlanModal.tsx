// ============================================================
// Швидке створення спільного плану.
// ------------------------------------------------------------
// Перший рівень просить лише назву. Тип, фото й нотатка відкриваються
// окремо, тому форма не перетворюється на анкету.
// ============================================================
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { ModalClose } from '@/components/ui/ModalClose';
import { CheckIcon, ChevronDownIcon, CloseIcon } from '@/components/icons/UiIcon';
import { CameraIcon } from '@/components/icons/NavIcon';
import { PLAN_CATEGORIES, PLAN_CATEGORY_ORDER } from './planConstants';
import './plansCreate.css';
import './plansCreateAccordion.css';
import './plansCreatePhoto.css';
import type { NewPlanInput } from './usePlans';
import type { PlanCategory } from '@/types';

const PLAN_TYPES = PLAN_CATEGORY_ORDER.filter((key) => key !== 'holiday');
const CLOSE_MOTION_MS = 150;

export function AddPlanModal({
  busy,
  createdPlanId,
  onClose,
  onSubmit,
  onContinue,
}: {
  busy: boolean;
  createdPlanId: number | null;
  onClose: () => void;
  onSubmit: (input: NewPlanInput) => void;
  onContinue: (id: number) => void;
}) {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<PlanCategory>('other');
  const [description, setDescription] = useState('');
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [typeOpen, setTypeOpen] = useState(false);
  const [photoOpen, setPhotoOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const closeTimer = useRef<number | null>(null);

  const selected = PLAN_CATEGORIES[category];
  const style = { '--plan-create-accent': selected.color } as CSSProperties;

  useEffect(() => () => {
    if (closeTimer.current !== null) window.clearTimeout(closeTimer.current);
  }, []);

  useEffect(() => {
    if (!coverFile) {
      setCoverPreview(null);
      return;
    }
    const url = URL.createObjectURL(coverFile);
    setCoverPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [coverFile]);

  const finishWithMotion = (action: () => void) => {
    if (busy || closing) return;
    setClosing(true);
    closeTimer.current = window.setTimeout(action, CLOSE_MOTION_MS);
  };

  const requestClose = () => finishWithMotion(onClose);
  const requestContinue = (id: number) => finishWithMotion(() => onContinue(id));

  const save = () => {
    const cleanTitle = title.trim();
    if (!cleanTitle || busy || createdPlanId !== null) return;
    onSubmit({
      title: cleanTitle,
      category,
      description: description.trim() || null,
      coverFile,
    });
  };

  return (
    <div
      className={`modal-overlay plan-create-overlay${closing ? ' is-closing' : ''}`}
      onClick={(event) => {
        if (!busy && event.target === event.currentTarget) requestClose();
      }}
    >
      <div
        className={`modal-sheet plan-create-sheet${closing ? ' is-closing' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="plan-create-title"
        style={style}
      >
        {/* Хрестик спільний на обидві гілки — форму й екран успіху. */}
        <ModalClose onClose={requestClose} disabled={busy} />
        {createdPlanId === null ? (
          <form
            className="plan-create-form"
            onSubmit={(event) => {
              event.preventDefault();
              save();
            }}
          >
            <header className="plan-create-head">
              <span className="plan-create-eyebrow">Новий спільний план</span>
              <h2 id="plan-create-title">Що хочете зробити разом?</h2>
              <p>Запишіть задум одним реченням. Дату, місце, бюджет і підготовку можна додати пізніше.</p>
            </header>

            <label className="plan-create-title-field">
              <textarea
                id="plan-title"
                name="title"
                aria-label="Назва плану"
                rows={2}
                maxLength={120}
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Наприклад, поїхати разом у Карпати"
                autoFocus
                disabled={busy || closing}
              />
              <small>{title.trim().length}/120</small>
            </label>

            <section className="plan-create-accordion" aria-labelledby="plan-type-title">
              <button
                type="button"
                className={`plan-create-accordion-toggle${typeOpen ? ' open' : ''}`}
                aria-expanded={typeOpen}
                onClick={() => setTypeOpen((value) => !value)}
                disabled={busy || closing}
              >
                <span className="plan-create-accordion-icon" aria-hidden="true"><selected.Icon size={18} /></span>
                <span className="plan-create-accordion-copy">
                  <small id="plan-type-title">Тип плану</small>
                  <strong>{category === 'other' ? 'Не вибрано' : selected.label}</strong>
                </span>
                <span className="plan-create-accordion-optional">необов’язково</span>
                <ChevronDownIcon size={17} />
              </button>

              {typeOpen && (
                <div className="plan-create-type-grid" aria-label="Типи спільних планів">
                  {PLAN_TYPES.map((key) => {
                    const item = PLAN_CATEGORIES[key];
                    const active = category === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        className={`plan-create-type-option${active ? ' active' : ''}`}
                        aria-pressed={active}
                        onClick={() => {
                          setCategory(key);
                          setTypeOpen(false);
                        }}
                        disabled={busy || closing}
                      >
                        <item.Icon size={17} />
                        <span>{key === 'other' ? 'Без типу' : item.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </section>

            <section className="plan-create-accordion">
              <button
                type="button"
                className={`plan-create-accordion-toggle${photoOpen ? ' open' : ''}`}
                aria-expanded={photoOpen}
                onClick={() => setPhotoOpen((value) => !value)}
                disabled={busy || closing}
              >
                <span className="plan-create-accordion-icon" aria-hidden="true"><CameraIcon size={18} /></span>
                <span className="plan-create-accordion-copy">
                  <small>Обкладинка плану</small>
                  <strong>{coverFile ? 'Фото вибрано' : 'Додати фото'}</strong>
                </span>
                <span className="plan-create-accordion-optional">необов’язково</span>
                <ChevronDownIcon size={17} />
              </button>

              {photoOpen && (
                <div className="plan-create-photo">
                  {coverPreview ? (
                    <div className="plan-create-photo-preview">
                      <img src={coverPreview} alt="Попередній перегляд обкладинки плану" />
                      <button
                        type="button"
                        aria-label="Прибрати фото"
                        onClick={() => setCoverFile(null)}
                        disabled={busy || closing}
                      >
                        <CloseIcon size={15} />
                      </button>
                    </div>
                  ) : (
                    <label className="plan-create-photo-picker">
                      <CameraIcon size={24} />
                      <span>
                        <strong>Вибрати фото</strong>
                        <small>Воно стане обкладинкою плану</small>
                      </span>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                        onChange={(event) => setCoverFile(event.target.files?.[0] ?? null)}
                        disabled={busy || closing}
                      />
                    </label>
                  )}
                </div>
              )}
            </section>

            <section className="plan-create-accordion">
              <button
                type="button"
                className={`plan-create-accordion-toggle plan-create-accordion-toggle--note${noteOpen ? ' open' : ''}`}
                aria-expanded={noteOpen}
                onClick={() => setNoteOpen((value) => !value)}
                disabled={busy || closing}
              >
                <span className="plan-create-accordion-copy">
                  <small>Додаткова деталь</small>
                  <strong>{description.trim() ? 'Нотатку додано' : 'Додати нотатку'}</strong>
                </span>
                <ChevronDownIcon size={17} />
              </button>

              {noteOpen && (
                <label className="form-field plan-create-note plan-create-note--accordion">
                  <span>Що важливо не забути?</span>
                  <textarea
                    id="plan-description"
                    name="description"
                    rows={3}
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    placeholder="Наприклад, поїхати власною машиною та взяти фотоапарат"
                    disabled={busy || closing}
                  />
                </label>
              )}
            </section>

            <div className="modal-actions plan-create-actions">
              <button type="button" className="btn btn-ghost" onClick={requestClose} disabled={busy || closing}>
                Скасувати
              </button>
              <button type="submit" className="btn" disabled={busy || closing || !title.trim()}>
                {busy ? 'Зберігаю…' : 'Зберегти ідею'}
              </button>
            </div>
          </form>
        ) : (
          <section className="plan-create-success" aria-labelledby="plan-create-title">
            <span className="plan-create-success-mark" aria-hidden="true"><CheckIcon size={28} /></span>
            <span className="plan-create-eyebrow">План додано</span>
            <h2 id="plan-create-title">{title.trim()}</h2>
            <p>Він збережений серед ідей. Можна залишити його так або одразу додати дату, кроки й бюджет.</p>

            {/* Порядок як у каноні: тиха дія ліворуч, головна праворуч.
                Тут вони стояли навпаки — «Продовжити планування» вгорі,
                «Залишити як ідею» під ним, — тобто ще й іншою віссю. */}
            <div className="modal-actions plan-create-success-actions">
              <button type="button" className="btn btn-ghost" onClick={requestClose} disabled={closing}>
                Залишити як ідею
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => requestContinue(createdPlanId)}
                disabled={closing}
              >
                Продовжити планування
              </button>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
