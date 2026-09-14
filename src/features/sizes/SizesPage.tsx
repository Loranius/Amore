// ============================================================
// «Заміри» — окремий модуль.
// ------------------------------------------------------------
// Був вкладкою в налаштуваннях, і це було не те місце. Налаштування
// відкривають, щоб ЩОСЬ ЗМІНИТИ; заміри відкривають, щоб ПОДИВИТИСЬ — і
// здебільшого стоячи в магазині з телефоном в одній руці.
//
// Уся композиція складена під цю сцену, і кожне рішення тут має її за
// причину:
//
//   • ЧУЖІ ЗАМІРИ ПЕРШІ. Свій розмір знають; відкривають, щоб подивитись
//     розмір другого. Тому активний профіль за замовчуванням — партнер,
//     а не «я», і перемикач стоїть першим рядком.
//   • НЕЗАПОВНЕНЕ НЕ МАЛЮЄТЬСЯ. Доти таблиця показувала всі чотирнадцять
//     рядків, і на знімку власника сім із них були прочерками. Тепер
//     видно тільки те, що є, а чого немає — сказано одним рядком унизу.
//   • ЗНАЧЕННЯ КОПІЮЄТЬСЯ ТАПОМ. У поле пошуку магазину треба «38», тож
//     копіюється саме число, без «см».
//
// Режим — Operate (`amore-visual-direction`): успіх тут це «знайшов і
// прочитав», а не «помилувався».
// ============================================================
import { useMemo, useState } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { ListIcon, PencilIcon, UserIcon } from '@/components/icons/UiIcon';
import { useCurrentUser } from '@/providers/AuthProvider';
import { useToast } from '@/providers/ToastProvider';
import { useUsers } from '@/features/_shared/useUsers';
import { SizesForm } from './SizesForm';
import {
  FEMALE_NAME,
  missingSizeLabels,
  readSize,
  sizeGroupsFor,
  sizesFilled,
  type SizeField,
} from './sizesModel';
import { useUserSizes } from './useSizes';
import type { UserSizesRow } from '@/types';
import './sizes.css';

export function SizesPage() {
  const { data: users = [] } = useUsers();
  const me = useCurrentUser();
  const [chosenId, setChosenId] = useState<number | null>(null);
  const [editing, setEditing] = useState(false);

  /*
   * Партнер за замовчуванням — і це не здогад про смак, а про сцену.
   * Свій розмір людина знає; сюди заходять за чужим. Поки список людей
   * не приїхав, стоїть «я»: показати порожнє гірше, ніж показати себе.
   */
  const partnerId = useMemo(
    () => users.find((one) => one.id !== me.id)?.id ?? me.id,
    [users, me.id],
  );
  const activeId = chosenId ?? partnerId;
  const activeUser = users.find((one) => one.id === activeId);
  const isFemale = activeUser?.name === FEMALE_NAME;
  const { data: sizes = null, isPending } = useUserSizes(activeId);

  const { filled, total } = sizesFilled(sizes, isFemale);

  return (
    <section className="sizes-page">
      <PageHeader
        title="Заміри"
        meta={
          isPending
            ? 'Дивлюсь…'
            : <>Заповнено <b className="sizes-count">{filled}</b> із {total}</>
        }
        action={filled > 0 && !editing ? (
          <button type="button" className="btn btn-ghost sizes-edit-open" onClick={() => setEditing(true)}>
            <PencilIcon size={15} />
            <span>Редагувати</span>
          </button>
        ) : undefined}
      />

      {users.length > 1 && (
        <div className="chips sizes-people" role="group" aria-label="Чиї заміри">
          {users.map((one) => (
            <button
              key={one.id}
              type="button"
              className={`chip${one.id === activeId ? ' active' : ''}`}
              aria-pressed={one.id === activeId}
              onClick={() => {
                setChosenId(one.id);
                setEditing(false);
              }}
            >
              <UserIcon size={14} />
              <span>{one.name}</span>
            </button>
          ))}
        </div>
      )}

      {editing ? (
        <SizesForm
          key={activeId}
          userId={activeId}
          isFemale={isFemale}
          sizes={sizes}
          onDone={() => setEditing(false)}
        />
      ) : (
        <SizesView
          key={activeId}
          sizes={sizes}
          isFemale={isFemale}
          loading={isPending}
          onEdit={() => setEditing(true)}
        />
      )}
    </section>
  );
}

function SizesView({
  sizes,
  isFemale,
  loading,
  onEdit,
}: {
  sizes: UserSizesRow | null;
  isFemale: boolean;
  loading: boolean;
  onEdit: () => void;
}) {
  const groups = sizeGroupsFor(isFemale);
  const missing = missingSizeLabels(sizes, isFemale);
  const { filled } = sizesFilled(sizes, isFemale);

  if (loading) return <div className="sizes-loading" aria-hidden="true" />;

  if (filled === 0) {
    return (
      <EmptyState
        icon={<ListIcon size={26} />}
        title="Заміри ще не записані"
        hint="Зріст, одяг, взуття й каблучки — щоб перед подарунком не питати одне в одного."
        action={(
          <button type="button" className="btn" onClick={onEdit}>
            Записати заміри
          </button>
        )}
      />
    );
  }

  return (
    <div className="sizes-sheet">
      {groups.map((group) => {
        const rows = group.fields.filter((field) => readSize(sizes, field.key) !== null);
        if (rows.length === 0) return null;
        return (
          <section className="sizes-block" key={group.title}>
            <h2 className="sizes-block-title">{group.title}</h2>
            <ul className="sizes-list">
              {rows.map((field) => (
                <SizeRow key={field.key} field={field} value={readSize(sizes, field.key)!} />
              ))}
            </ul>
          </section>
        );
      })}

      {missing.length > 0 && (
        <p className="sizes-missing">
          Ще не заповнено: {missing.join(', ').toLowerCase()}.{' '}
          <button type="button" className="sizes-missing-link" onClick={onEdit}>
            Заповнити
          </button>
        </p>
      )}
    </div>
  );
}

/**
 * Рядок заміру — кнопка, бо його головна дія це «скопіювати».
 *
 * Копіюється ЗНАЧЕННЯ БЕЗ ОДИНИЦІ: у поле пошуку магазину треба «38», а
 * «38 см» там нічого не знайде.
 */
function SizeRow({ field, value }: { field: SizeField; value: string }) {
  const toast = useToast();

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      toast.show(`Скопійовано: ${value}`);
    } catch {
      // Буфер може бути закритий (не той контекст, відмова в дозволі).
      // Тоді значення однаково треба показати — вголос, а не мовчки.
      toast.show(`Не вдалося скопіювати. ${field.label}: ${value}`);
    }
  };

  return (
    <li className="sizes-item">
      <button
        type="button"
        className="sizes-row"
        onClick={() => void copy()}
        aria-label={`Скопіювати ${field.label.toLowerCase()}: ${value}`}
      >
        <span className="sizes-label">{field.label}</span>
        <span className="sizes-value">
          {value}
          {field.unit && <span className="sizes-unit"> {field.unit}</span>}
        </span>
      </button>
    </li>
  );
}
