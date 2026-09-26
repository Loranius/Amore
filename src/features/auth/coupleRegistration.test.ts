import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  REGISTER_NAME_MAX,
  REGISTER_PIN_LENGTH,
  REGISTER_PROBLEM_TEXT,
  nameStepProblem,
  registrationProblem,
  type RegisterDraft,
  type RegisterProblem,
} from './coupleRegistration';
import { USER_NAME_MAX } from '@/lib/guards';

// ============================================================
// Реєстрація пари: правило й звірка з сервером (ADR-0209).
// ------------------------------------------------------------
// «Сьогодні» тут заморожене рядком, а не взяте з годинника: інакше
// перевірка «дата в майбутньому» залежала б від дня запуску, і зелений у
// вересні міг би впасти в січні (.claude/rules/tests.md — сталі вхідні).
// ============================================================

const TODAY = '2026-09-25';

function draft(over: Partial<{
  first: Partial<{ name: string; pin: string }>;
  second: Partial<{ name: string; pin: string }>;
  startedAt: string;
}> = {}): RegisterDraft {
  return {
    members: [
      { name: 'Олексій', pin: '12345678', ...over.first },
      { name: 'Марія', pin: '87654321', ...over.second },
    ],
    startedAt: over.startedAt ?? '2015-06-14',
  };
}

describe('registrationProblem — що саме бракує', () => {
  it('повна чернетка проблем не має', () => {
    expect(registrationProblem(draft(), TODAY)).toBeNull();
  });

  it('імена цієї пари теж проходять', () => {
    // Інваріант: зняття унії `'Діма' | 'Лєна'` не зробило їх чимось особливим.
    const own = draft({ first: { name: 'Діма' }, second: { name: 'Лєна' } });
    expect(registrationProblem(own, TODAY)).toBeNull();
  });

  it('порожнє імʼя називається по своєму полю', () => {
    expect(registrationProblem(draft({ first: { name: '   ' } }), TODAY)).toBe('no-first-name');
    expect(registrationProblem(draft({ second: { name: '' } }), TODAY)).toBe('no-second-name');
  });

  it('межа довжини імені — та сама, що на межі з базою', () => {
    // Якби реєстрація впускала довше, `toAppUser` відкинув би такого
    // користувача ПІСЛЯ створення — і пара не змогла б увійти.
    expect(REGISTER_NAME_MAX).toBe(USER_NAME_MAX);
    const long = 'я'.repeat(REGISTER_NAME_MAX + 1);
    expect(registrationProblem(draft({ first: { name: long } }), TODAY)).toBe('name-too-long');
  });

  it('однакові імена заборонені: за ними обирають себе на вході', () => {
    const same = draft({ first: { name: 'Саша' }, second: { name: ' Саша ' } });
    expect(registrationProblem(same, TODAY)).toBe('same-name');
  });

  it('PIN — рівно вісім цифр, і не літери', () => {
    expect(registrationProblem(draft({ first: { pin: '1234567' } }), TODAY)).toBe('no-first-pin');
    expect(registrationProblem(draft({ first: { pin: '123456789' } }), TODAY)).toBe('no-first-pin');
    expect(registrationProblem(draft({ first: { pin: '1234567a' } }), TODAY)).toBe('no-first-pin');
    expect(registrationProblem(draft({ second: { pin: '' } }), TODAY)).toBe('no-second-pin');
  });

  it('однаковий PIN на двох — це один вхід на двох', () => {
    const same = draft({ first: { pin: '11112222' }, second: { pin: '11112222' } });
    expect(registrationProblem(same, TODAY)).toBe('same-pin');
  });

  it('дата мусить бути датою і мусить настати', () => {
    expect(registrationProblem(draft({ startedAt: '' }), TODAY)).toBe('no-start-date');
    expect(registrationProblem(draft({ startedAt: '14.06.2015' }), TODAY)).toBe('no-start-date');
    expect(registrationProblem(draft({ startedAt: '2026-09-26' }), TODAY)).toBe('start-date-in-future');
    // Сьогодні — можна: пара, яка разом перший день, теж пара.
    expect(registrationProblem(draft({ startedAt: TODAY }), TODAY)).toBeNull();
  });

  it('у кожної причини є текст для пари', () => {
    // Інакше екран показав би код замість речення.
    const problems: RegisterProblem[] = [
      'no-first-name', 'no-second-name', 'name-too-long', 'same-name',
      'no-first-pin', 'no-second-pin', 'same-pin',
      'no-start-date', 'start-date-in-future',
    ];
    for (const problem of problems) {
      expect(REGISTER_PROBLEM_TEXT[problem]).toBeTruthy();
    }
    expect(Object.keys(REGISTER_PROBLEM_TEXT).sort()).toEqual([...problems].sort());
  });
});

describe('nameStepProblem — не сварити на незаймане (ADR-0209)', () => {
  /*
   * ВАДА, ЗА ФАКТОМ ЯКОЇ НАПИСАНО, І ЗНАЙШОВ ЇЇ ЗНІМОК. Екран питав
   * `registrationProblem` одразу й друкував «Напишіть перше імʼя.» над
   * порожньою формою — тобто сварився перш ніж пара набрала символ.
   * Ні типізація, ні решта тестів цього не бачили: правило поверталось
   * правильно, неправильним був момент, коли його показували.
   */
  it('порожня форма мовчить', () => {
    expect(nameStepProblem('', '')).toBeNull();
    expect(nameStepProblem('   ', '  ')).toBeNull();
  });

  it('щойно почали — підказка стає доречною', () => {
    expect(nameStepProblem('Олексій', '')).toBe('no-second-name');
    expect(nameStepProblem('', 'Марія')).toBe('no-first-name');
  });

  it('решту правил крок імен теж бачить', () => {
    expect(nameStepProblem('Саша', ' Саша ')).toBe('same-name');
    expect(nameStepProblem('я'.repeat(REGISTER_NAME_MAX + 1), 'Марія')).toBe('name-too-long');
  });

  it('повна пара імен проблем не має', () => {
    expect(nameStepProblem('Олексій', 'Марія')).toBeNull();
    expect(nameStepProblem('Діма', 'Лєна')).toBeNull();
  });
});

describe('серверна копія правила не розійшлась із цією (ADR-0209)', () => {
  /*
   * ЧОМУ СТОРОЖ, А НЕ ОДНЕ МІСЦЕ. Edge-функція працює в Deno й не може
   * імпортувати з `src/` — між ними немає збірки. Відмовитись від
   * серверної перевірки теж не можна: без неї функцію можна покликати
   * мимо екрана.
   *
   * Тому копія свідома, а розбіжність ловиться тут. Це прямий висновок із
   * двох випадків у цьому проєкті: `partnerGenitive` мав дві копії з
   * різними запасними шляхами (прибрано цією ж зміною), а тест
   * `supabase/functions/event-reminders/index.test.ts` написаний на
   * `deno test`, якого **не ганяє ні CI, ні `package.json`** — тобто
   * другий такий тест стеріг би нуль. Цей ганяється разом з усіма.
   */
  const server = readFileSync(
    join(__dirname, '../../../supabase/functions/couple-register/index.ts'),
    'utf8',
  );

  it('сторож справді читає ту функцію', () => {
    expect(server).toContain('couple-register');
    expect(server).toContain('parseInput');
    expect(server.length).toBeGreaterThan(3000);
  });

  it('довжина PIN однакова', () => {
    expect(server).toContain(`/^\\d{${REGISTER_PIN_LENGTH}}$/`);
  });

  it('межа імені однакова', () => {
    expect(server).toMatch(new RegExp(`NAME_MAX = ${REGISTER_NAME_MAX}\\b`));
  });

  it('сервер перевіряє все, що й екран', () => {
    // Кожна умова названа своїм кодом відмови — і жодної з них не можна
    // прибрати, лишивши екранну перевірку «достатньою».
    for (const code of ['need_two_members', 'bad_name', 'same_name', 'bad_pin',
      'bad_started_at', 'started_at_in_future']) {
      expect(server).toContain(`"${code}"`);
    }
  });

  it('порожність порталу перевіряється, і відмова названа', () => {
    // Рішення власника: реєстрація працює лише там, де пари ще немає.
    expect(server).toContain('portal_taken');
    expect(server).toMatch(/count[\s\S]{0,400}portal_taken/);
  });

  it('паролем в Auth стає хеш PIN, а не сам PIN', () => {
    // Інакше реєстрація пройшла б, а вхід — ні: `auth-pin` віддає
    // `password: user.pin_hash`, і клієнт передає його як пароль.
    expect(server).toMatch(/createUser\(\{\s*\n?\s*email,\s*\n?\s*password: pinHash/);
  });

  it('половина створеної пари відкочується', () => {
    // Без відкату портал перестав би бути порожнім, і друга спроба впала
    // б на `portal_taken` — реєстрація заблокувала б себе назавжди.
    expect(server).toContain('rollback');
    expect(server).toContain('auth.admin.deleteUser');
  });
});

describe('екран питає про порожність на вході, а не в кінці (ADR-0209 §12)', () => {
  /*
   * ВАДА, ЗА ФАКТОМ ЯКОЇ НАПИСАНО. Першу редакцію екрана власний зонд
   * пройшов НАСКРІЗЬ на справжньому порталі, де пара вже є: усі три
   * кроки й чотири набори PIN, — і лише тоді сервер сказав
   * `portal_taken`. Людину вели через найдовшу частину шляху заради
   * відмови, відомої з першої секунди.
   *
   * Перевірка статична: у наборі немає DOM. Саму поведінку стереже
   * `e2e/visual/register.visual.spec.ts`, який ходить на обидва стани.
   */
  const page = readFileSync(join(__dirname, 'RegisterPage.tsx'), 'utf8')
    // Коментарі знімаються: вони описують правило дослівно.
    .replace(/\/\*[\s\S]*?\*\//g, (match) => match.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:])\/\/[^\n]*/g, (_match, lead: string) => lead);

  it('екран справді питає список користувачів', () => {
    expect(page).toContain('useUsers()');
    expect(page).toMatch(/existingUsers\?\.length \?\? 0\) > 0/);
  });

  it('незнання не видається за порожнечу', () => {
    // `isError` мусить мати ВЛАСНУ гілку: «не вдалося перевірити» — це не
    // «вільно». Інакше збій мережі провів би пару через увесь шлях.
    expect(page).toContain('usersFailed');
    expect(page).toMatch(/if \(usersFailed\)/);
  });

  it('після створення екран не показує відмову власному порталу', () => {
    // Створена пара робить портал непорожнім. Без цього прапорця гілка
    // відмови встигла б блимнути між відповіддю функції й переходом.
    expect(page).toMatch(/if \(!submitted && \(existingUsers/);
  });

  it('прапорець ставиться ДО входу, бо саме вхід оновлює список', () => {
    const submit = page.indexOf('setSubmitted(true)');
    const loginCall = page.indexOf('await login(');
    expect(submit).toBeGreaterThan(0);
    expect(loginCall).toBeGreaterThan(0);
    expect(submit).toBeLessThan(loginCall);
  });

  it('сторож справді дивиться в потрібний файл', () => {
    expect(page).toContain('couple-register');
    expect(page.length).toBeGreaterThan(4000);
  });
});
