// ============================================================
// Форма замірів — та сама сітка, що й перегляд, тільки з полями.
// ------------------------------------------------------------
// Поля будуються з каталогу (`sizesModel.ts`), а не переписані руками:
// доти той самий замір існував у трьох місцях, і додати новий означало
// не забути про жодне з трьох.
// ============================================================
import { useState, type ChangeEvent, type FormEvent } from 'react';
import { sizeGroupsFor, toSizesForm, toSizesPatch, type SizeKey, type SizesFormState } from './sizesModel';
import { useSaveSizes } from './useSizes';
import type { UserSizesRow } from '@/types';

export interface SizesFormProps {
  userId: number;
  isFemale: boolean;
  sizes: UserSizesRow | null;
  onDone: () => void;
}

export function SizesForm({ userId, isFemale, sizes, onDone }: SizesFormProps) {
  const [form, setForm] = useState<SizesFormState>(() => toSizesForm(sizes));
  const save = useSaveSizes();
  const groups = sizeGroupsFor(isFemale);

  const set = (key: SizeKey) => (event: ChangeEvent<HTMLInputElement>) =>
    setForm((previous) => ({ ...previous, [key]: event.target.value }));

  const submit = (event: FormEvent) => {
    event.preventDefault();
    save.mutate(toSizesPatch(form, userId, isFemale), { onSuccess: onDone });
  };

  return (
    /*
     * Справжня `<form>`, а не набір полів із кнопкою: на телефоні це
     * вмикає «Готово» на клавіатурі, і заміри зберігаються, не ховаючи
     * її вручну.
     */
    <form className="sizes-sheet sizes-sheet--edit" onSubmit={submit}>
      {groups.map((group) => (
        <section className="sizes-block" key={group.title}>
          <h2 className="sizes-block-title">{group.title}</h2>
          <div className="sizes-fields">
            {group.fields.map((field) => (
              <label className="sizes-field" key={field.key}>
                <span className="sizes-field-label">
                  {field.label}
                  {field.unit && <span className="sizes-unit">, {field.unit}</span>}
                </span>
                <input
                  className="sizes-input"
                  value={form[field.key] ?? ''}
                  onChange={set(field.key)}
                  /*
                   * `inputMode`, а не лише `type`: цифрова клавіатура на
                   * телефоні потрібна й там, де поле текстове (розмір
                   * взуття буває «42.5», але набирають його цифрами).
                   */
                  inputMode={field.numeric ? (field.step ? 'decimal' : 'numeric') : 'text'}
                  {...(field.numeric ? { type: 'number', step: field.step ?? 1 } : { type: 'text' })}
                  autoComplete="off"
                />
              </label>
            ))}
          </div>
        </section>
      ))}

      <div className="sizes-actions">
        <button type="button" className="btn btn-ghost" onClick={onDone}>
          Скасувати
        </button>
        <button type="submit" className="btn" disabled={save.isPending}>
          {save.isPending ? 'Зберігаю…' : 'Зберегти'}
        </button>
      </div>
    </form>
  );
}
