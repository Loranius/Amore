// ============================================================
// Профіль у налаштуваннях — хто ти в цьому порталі.
// ------------------------------------------------------------
// Три речі, і кожна кудись веде далі:
//
//   ІМ'Я → підпис скрізь, де портал називає людину: автор покупки, хто
//          виконав бажання, вкладки графіка, перемикач у «Замірах».
//   ФОТО → кружечок поруч із іменем там само.
//   ДАТА → щорічна подія в календарі, з тим самим іменем у назві.
//
// Тому під кожним полем стоїть рядок, який каже, КУДИ воно піде. Форма,
// яка не каже наслідку, — це форма, яку заповнюють навмання.
//
// Редагувати можна обох: портал знають двоє, і фото одне одному вони
// ставлять так само, як заповнюють заміри. За замовчуванням — СВІЙ
// профіль: свою дату народження вводиш сам.
// ============================================================
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { useCurrentUser } from '@/providers/AuthProvider';
import { usePeople } from '@/features/_shared/useUsers';
import { CameraIcon } from '@/components/icons/NavIcon';
import { Photo } from '@/components/ui/Photo';
import { UserIcon } from '@/components/icons/UiIcon';
import {
  DISPLAY_NAME_MAX,
  birthdayProblem,
  displayNameProblem,
  personInitial,
  type Person,
} from './profileModel';
import { useSaveProfile, useUploadProfilePhoto } from './useProfile';
import './profile.css';

/**
 * Ширина портрета в CSS-пікселях. Число живе тут, а не лише в CSS, бо
 * його читає `<Photo>`, щоб попросити у сховища рівно такий розмір.
 * Мусить збігатися з `.profile-avatar` у `profile.css`.
 */
const AVATAR_CSS_PX = 72;

export function ProfileSection() {
  const me = useCurrentUser();
  const people = usePeople();
  const [editingId, setEditingId] = useState(me.id);
  const person = people.find((one) => one.id === editingId) ?? null;

  return (
    <section className="settings-section profile-section">
      {people.length > 1 && (
        <div className="chips profile-people" role="group" aria-label="Чий профіль">
          {people.map((one) => (
            <button
              key={one.id}
              type="button"
              className={`chip${one.id === editingId ? ' active' : ''}`}
              aria-pressed={one.id === editingId}
              onClick={() => setEditingId(one.id)}
            >
              <UserIcon size={14} />
              <span>{one.displayName}</span>
            </button>
          ))}
        </div>
      )}

      {person && <ProfileForm key={person.id} person={person} />}
    </section>
  );
}

function ProfileForm({ person }: { person: Person }) {
  const [name, setName] = useState(person.displayName);
  const [birthday, setBirthday] = useState(person.birthday ?? '');
  const [photoUrl, setPhotoUrl] = useState(person.photoUrl);
  const [touched, setTouched] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const save = useSaveProfile();
  const upload = useUploadProfilePhoto();

  /*
   * Коли профіль приїхав із сервера пізніше за перший рендер, поля
   * підхоплюють його — але ТІЛЬКИ доки їх не чіпали. Інакше збережене
   * значення стирало б те, що пара саме друкує.
   */
  useEffect(() => {
    if (touched) return;
    setName(person.displayName);
    setBirthday(person.birthday ?? '');
    setPhotoUrl(person.photoUrl);
  }, [person.displayName, person.birthday, person.photoUrl, touched]);

  const nameProblem = displayNameProblem(name);
  const dateProblem = birthdayProblem(birthday);
  const blocked = nameProblem !== null || dateProblem !== null;

  const pickPhoto = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setTouched(true);
    const url = await upload.mutateAsync({ userId: person.id, file }).catch(() => null);
    if (url) setPhotoUrl(url);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (blocked) return;
    save.mutate({
      userId: person.id,
      profile: { displayName: name.trim(), ...(photoUrl ? { photoUrl } : {}) },
      birthday,
    });
    setTouched(false);
  };

  return (
    <form className="profile-form" onSubmit={submit}>
      <div className="profile-portrait">
        <button
          type="button"
          className="profile-avatar"
          onClick={() => fileInput.current?.click()}
          aria-label={photoUrl ? 'Замінити фото профілю' : 'Додати фото профілю'}
          disabled={upload.isPending}
        >
          {/*
            * Через `<Photo>`, а не сирим `<img>`: кружечок тут 72 px, а в
            * бакеті лежить 512 — тобто сирий тег просив би вп'ятеро
            * більше пікселів, ніж малює. Правило записане тестом
            * `components/ui/photoThumbRule.test.ts`, і саме він упіймав
            * цей рядок.
            */}
          {photoUrl
            ? <Photo className="profile-avatar-img" src={photoUrl} cssWidth={AVATAR_CSS_PX} alt="" />
            : <span className="profile-avatar-initial" aria-hidden="true">{personInitial(name)}</span>}
          <span className="profile-avatar-badge" aria-hidden="true">
            <CameraIcon size={15} />
          </span>
        </button>
        <p className="profile-portrait-hint">
          {upload.isPending
            ? 'Готую фото…'
            : 'Торкнись, щоб поставити фото. Воно стане кружечком поруч з ім’ям.'}
        </p>
        <input
          ref={fileInput}
          className="profile-file"
          type="file"
          accept="image/*"
          onChange={(event) => void pickPhoto(event)}
        />
      </div>

      <label className="profile-field">
        <span className="profile-field-label">Ім’я</span>
        <input
          className="profile-input"
          value={name}
          maxLength={DISPLAY_NAME_MAX + 8}
          onChange={(event) => {
            setTouched(true);
            setName(event.target.value);
          }}
          autoComplete="off"
        />
        <span className={`profile-hint${nameProblem ? ' is-problem' : ''}`}>
          {nameProblem ?? 'Цим іменем портал звертається до людини скрізь: автор покупки, хто виконав бажання, вкладки графіка.'}
        </span>
      </label>

      <label className="profile-field">
        <span className="profile-field-label">День народження</span>
        <input
          className="profile-input"
          type="date"
          value={birthday}
          onChange={(event) => {
            setTouched(true);
            setBirthday(event.target.value);
          }}
        />
        <span className={`profile-hint${dateProblem ? ' is-problem' : ''}`}>
          {dateProblem ?? 'Стане щорічною подією в календарі. Порожнє — подію приберемо.'}
        </span>
      </label>

      <div className="profile-actions">
        <button type="submit" className="btn" disabled={blocked || save.isPending}>
          {save.isPending ? 'Зберігаю…' : 'Зберегти профіль'}
        </button>
      </div>
    </form>
  );
}
