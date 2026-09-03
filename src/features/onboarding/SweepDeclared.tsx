// ============================================================
// «Скажіть числом» — другий шлях крізь рік, для тих, хто не пригадує.
// ------------------------------------------------------------
// ЗАПИТ ВЛАСНИКА: «потрібно дати лінивим людям вибір або додавати самі
// світлини, або вказати приблизну кількість», і те саме для фільмів,
// серіалів та місць.
//
// ЧОМУ ЦЕ ОДИН БЛОК, А НЕ ЧОТИРИ ПОЛЯ ПІД ЧОТИРМА ПИТАННЯМИ. Спокуса
// поставити лічильник поруч із кожним питанням велика: пара вже думає про
// фільми — ось їй і поле. Але це рівно та вада, з якої почалась
// попередня переробка екрана («візуально важко зрозуміти що де»): чотири
// однакові поля, розкидані між чотирма різними питаннями, читаються як
// частина кожного з них, а не як ОДИН вибір «я не пригадую деталей».
//
// Тому шлях названий один раз і стоїть цілим: спершу екран питає, ЩО
// саме було, а наприкінці — «а якщо не пригадуєте, скажіть скільки».
//
// ЩО ПАРА БАЧИТЬ ПІД ПОЛЕМ. Не «збережено», а різницю: «7 без назви».
// Це і є той пробіл, який власник назвав, і він же — запрошення в
// модуль: заводиш справжній фільм, число під полем меншає само.
// ============================================================
import { useEffect, useState } from 'react';
import { plural } from '@/lib/plural';
import { DECLARED_MAX, type DeclaredKind } from './declaredCounts';
import type { RelationshipYearFill } from './yearFills';

interface SweepDeclaredProps {
  year: RelationshipYearFill;
  /** Що вже сказано про цей рік. */
  counts: Partial<Record<DeclaredKind, number>>;
  /** Скільки зі сказаного ще не має справжнього рядка. */
  gaps: Record<DeclaredKind, number>;
  isSaving: boolean;
  onSet: (kind: DeclaredKind, count: number) => Promise<void>;
}

interface Field {
  kind: DeclaredKind;
  label: string;
  /** Чим воно стане в модулі, якщо пара потім захоче заповнити. */
  gapWord: (count: number) => string;
}

const FIELDS: readonly Field[] = [
  {
    kind: 'photos',
    label: 'Памʼятних знімків',
    gapWord: (count) => plural(count, 'знімок', 'знімки', 'знімків'),
  },
  {
    kind: 'movies',
    label: 'Фільмів',
    gapWord: (count) => plural(count, 'фільм', 'фільми', 'фільмів'),
  },
  {
    kind: 'series',
    label: 'Серіалів',
    gapWord: (count) => plural(count, 'серіал', 'серіали', 'серіалів'),
  },
  {
    kind: 'places',
    label: 'Місць, де були',
    gapWord: (count) => plural(count, 'місце', 'місця', 'місць'),
  },
];

/**
 * Одне поле.
 *
 * Чернетка тримається окремо від збереженого числа навмисно: поле, яке
 * пишеться просто в базу на кожен натиск клавіші, не дає стерти «12» і
 * набрати «7» — на порожньому полі воно записало б нуль і перемалювало
 * все під ним. Тут запис іде на `blur` і на Enter, тобто тоді, коли пара
 * СКАЗАЛА число, а не поки набирає.
 */
function DeclaredField({
  field, saved, gap, isSaving, onSet,
}: {
  field: Field;
  saved: number;
  gap: number;
  isSaving: boolean;
  onSet: (count: number) => Promise<void>;
}) {
  const [draft, setDraft] = useState(saved === 0 ? '' : String(saved));

  // Чуже збереження (інший рік, оновлення сторінки) мусить бути видно.
  useEffect(() => { setDraft(saved === 0 ? '' : String(saved)); }, [saved]);

  const commit = () => {
    const parsed = draft.trim() === '' ? 0 : Number.parseInt(draft, 10);
    const safe = Number.isFinite(parsed) ? Math.min(DECLARED_MAX, Math.max(0, parsed)) : 0;
    setDraft(safe === 0 ? '' : String(safe));
    if (safe !== saved) void onSet(safe);
  };

  return (
    <label className="sweep-count">
      <span className="sweep-count-label">{field.label}</span>
      <input
        type="number"
        inputMode="numeric"
        className="input sweep-count-input"
        min={0}
        max={DECLARED_MAX}
        step={1}
        value={draft}
        placeholder="—"
        disabled={isSaving}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); }}
      />
      {gap > 0 && (
        <small className="sweep-count-gap">{gap} без назви</small>
      )}
      {saved > 0 && gap === 0 && (
        <small className="sweep-count-gap">
          усі {saved} {field.gapWord(saved)} вже названі
        </small>
      )}
    </label>
  );
}

export function SweepDeclared({ year, counts, gaps, isSaving, onSet }: SweepDeclaredProps) {
  return (
    <div className="sweep-part">
      <h2 className="sweep-sub">Не пригадуєте деталей? Скажіть числом</h2>
      <p className="sweep-hint">
        {/*
          * Обіцянка сказана рівно та, яку код виконує: число ПІДНІМАЄ рік
          * зараз і меншає само, коли з'являється справжній рядок. Обіцяти
          * тут «ми створимо вам порожні картки» було б неправдою — жодного
          * рядка в модулях від цього не з'являється.
          */}
        Приблизно — цього досить: {year.label} рік підніметься одразу. Назви
        можна дописати колись потім у самих модулях, і тоді це число
        зменшиться само, щоб не порахувати те саме двічі.
      </p>

      <div className="sweep-counts">
        {FIELDS.map((field) => (
          <DeclaredField
            key={field.kind}
            field={field}
            saved={counts[field.kind] ?? 0}
            gap={gaps[field.kind]}
            isSaving={isSaving}
            onSet={(count) => onSet(field.kind, count)}
          />
        ))}
      </div>
    </div>
  );
}
