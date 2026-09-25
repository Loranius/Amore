// ============================================================
// Правило реєстрації пари — чиста частина (ADR-0209).
// ------------------------------------------------------------
// Живе окремо від екрана, бо в нього три різні споживачі: сам екран
// (показати, чого бракує), тест (перевірити правило без браузера) і
// сторож, який звіряє його з серверною копією в
// `supabase/functions/couple-register/index.ts`.
//
// ЧОМУ СЕРВЕРНА КОПІЯ ІСНУЄ Й ЧОМУ ЦЕ НЕ ТА САМА ДУБЛЬ-ВАДА, ЩО
// `partnerGenitive`. Edge-функція працює в Deno й не може імпортувати з
// `src/` — між ними немає збірки. А відмовитись від однієї з перевірок
// не можна: екран існує, щоб пара не помилилась, сервер — щоб функцію не
// можна було покликати мимо екрана. Різниця з тією вадою в тому, що там
// були дві копії з РІЗНОЮ поведінкою й без жодного сторожа, а тут
// розбіжність ловить `coupleRegistration.test.ts`, читаючи обидва файли.
// ============================================================

/** Рівно вісім цифр — та сама умова, що в `auth-pin` (`PIN_RE`). */
export const REGISTER_PIN_LENGTH = 8;

/**
 * Найдовше ім'я. Те саме число, що `USER_NAME_MAX` у `lib/guards.ts`:
 * реєстрація не має права впустити ім'я, яке межа з базою потім відкине.
 */
export const REGISTER_NAME_MAX = 32;

/** Чого бракує — рівно одна причина за раз, у порядку читання екрана. */
export type RegisterProblem =
  | 'no-first-name'
  | 'no-second-name'
  | 'name-too-long'
  | 'same-name'
  | 'no-first-pin'
  | 'no-second-pin'
  | 'same-pin'
  | 'no-start-date'
  | 'start-date-in-future';

export interface RegisterMemberDraft {
  name: string;
  pin: string;
}

export interface RegisterDraft {
  members: readonly [RegisterMemberDraft, RegisterMemberDraft];
  /** `YYYY-MM-DD`, як його дає `input[type=date]`. */
  startedAt: string;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Що не так із чернеткою, або `null`, якщо все на місці.
 *
 * `today` приходить аргументом, а не з годинника: інакше тест «дата в
 * майбутньому» залежав би від дня, коли його запускають, — і зелений у
 * вересні він міг би впасти у січні.
 */
export function registrationProblem(
  draft: RegisterDraft,
  today: string,
): RegisterProblem | null {
  const [first, second] = draft.members;
  const firstName = first.name.trim();
  const secondName = second.name.trim();

  if (firstName.length === 0) return 'no-first-name';
  if (secondName.length === 0) return 'no-second-name';
  if (firstName.length > REGISTER_NAME_MAX || secondName.length > REGISTER_NAME_MAX) {
    return 'name-too-long';
  }
  /*
   * Однакові імена заборонені не з естетики: екран входу показує саме
   * імена, і двоє «Саш» зробили б вибір користувача вгадуванням.
   */
  if (firstName === secondName) return 'same-name';

  if (!isPin(first.pin)) return 'no-first-pin';
  if (!isPin(second.pin)) return 'no-second-pin';
  /*
   * Однаковий PIN на двох — це не «зручно», це один вхід на двох: PIN
   * тут і є пароль до Supabase Auth (`auth-pin` віддає його хеш як
   * пароль). Портал, у якому обоє входять однаково, не може показати
   * «від кого» жодного бажання.
   */
  if (first.pin === second.pin) return 'same-pin';

  if (!DATE_RE.test(draft.startedAt)) return 'no-start-date';
  if (draft.startedAt > today) return 'start-date-in-future';

  return null;
}

function isPin(value: string): boolean {
  return value.length === REGISTER_PIN_LENGTH && /^\d+$/.test(value);
}

/** Що показати парі замість коду. */
export const REGISTER_PROBLEM_TEXT: Readonly<Record<RegisterProblem, string>> = {
  'no-first-name': 'Напишіть перше імʼя.',
  'no-second-name': 'Напишіть друге імʼя.',
  'name-too-long': `Імʼя довше за ${REGISTER_NAME_MAX} символів не вмістилось би на екрані.`,
  'same-name': 'Імена мусять різнитись — саме за ними ви обираєте себе на вході.',
  'no-first-pin': `Перший PIN — рівно ${REGISTER_PIN_LENGTH} цифр.`,
  'no-second-pin': `Другий PIN — рівно ${REGISTER_PIN_LENGTH} цифр.`,
  'same-pin': 'Різні PIN: інакше портал не розрізнить, хто з вас зайшов.',
  'no-start-date': 'Оберіть день, з якого ви разом.',
  'start-date-in-future': 'Цей день ще не настав.',
};

/**
 * Що сказати на кроці імен — або нічого.
 *
 * ВАДА, ЗА ФАКТОМ ЯКОЇ НАПИСАНО, І ЇЇ ПОКАЗАВ ЗНІМОК, А НЕ ТИПІЗАЦІЯ.
 * Перша редакція екрана питала `registrationProblem` одразу й друкувала
 * «Напишіть перше імʼя.» над ПОРОЖНЬОЮ, ще не займаною формою. Тобто
 * портал сварився на пару перш ніж вона встигла набрати перший символ.
 *
 * Поки обидва поля порожні, сказати нема чого: вимкнена кнопка «Далі»
 * уже несе це повідомлення й несе його тихо. Щойно почали — підказка
 * стає доречною, бо тепер вона про НЕДОРОБЛЕНЕ, а не про ненароблене.
 */
export function nameStepProblem(first: string, second: string): RegisterProblem | null {
  if (first.trim() === '' && second.trim() === '') return null;
  const problem = registrationProblem(
    {
      members: [
        { name: first, pin: '0'.repeat(REGISTER_PIN_LENGTH) },
        { name: second, pin: '1'.repeat(REGISTER_PIN_LENGTH) },
      ],
      // Кроку імен належать лише проблеми імен, тож PIN і дата тут
      // свідомо валідні: вони мають свої кроки й свої повідомлення.
      startedAt: '1970-01-01',
    },
    '1970-01-01',
  );
  if (problem === null) return null;
  return problem.includes('name') ? problem : null;
}
