import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/*
 * ВИМОГА (ADR-0180), словами власника: «в налаштування прибери фото
 * полароїда, додай можливість редагування профіля користувача, який
 * впливає на ВЕСЬ ПОРТАЛ — де як і хто називається, ім'я, фото, дата
 * народження, яка прив'язується в події».
 *
 * Дві половини, і кожна тиха, якщо зламається:
 *
 *   1. Менеджер фото пішов НАСПРАВДІ — разом із хуками, стилями й
 *      розміткою. Мертвий CSS не валить складання; він просто лежить,
 *      доки хтось не назве новий клас так само.
 *   2. Підпис із профілю дійшов ДО ЕКРАНІВ. Портал, у якому профіль
 *      зберігається, але жоден екран його не читає, виглядає працюючим:
 *      форма приймає ім'я, тост каже «Збережено», і ніде нічого не
 *      змінюється.
 *
 * Тому тут читається сам вихідний код: обидві помилки інакше видно лише
 * очима, на працюючому порталі, з уже перейменованою людиною.
 */

const SRC = join(__dirname, '..', '..');
const read = (...parts: string[]) => readFileSync(join(SRC, ...parts), 'utf8');

const settings = read('features', 'settings', 'SettingsModal.tsx');
const index = read('index.css');
const shared = read('features', '_shared', 'useUsers.ts');

describe('менеджер фото полароїда пішов із НАЛАШТУВАНЬ', () => {
  /*
   * Назву цього блоку виправлено разом з ADR-0181: менеджер не
   * «прибраний», а ПЕРЕЇХАВ у «Спогади». Перевірки лишились ті самі —
   * вони й тоді стерегли не зникнення, а відсутність саме в
   * налаштуваннях, — але назва казала більше, ніж вони перевіряють, і за
   * місяць читалась би як «фото завантажити нíяк».
   *
   * Що полароїд має вхід, стереже `polaroid/polaroidEntry.test.ts`.
   */
  it('модалка налаштувань про нього не знає', () => {
    expect(settings).not.toContain('PhotosSection');
    expect(settings).not.toContain('usePhotoManager');
    expect(settings).not.toContain('usePhotoMutations');
  });

  it('хуків у модулі налаштувань більше немає', () => {
    // `useSettings.ts` після виносу «Замірів» і фото не тримав нічого,
    // крім цього менеджера. Файл, у якому лишились самі експорти, яких
    // ніхто не імпортує, — це запрошення повернути екран випадково.
    // Самі хуки живі й переїхали в `features/polaroid/usePolaroid.ts`.
    expect(existsSync(join(SRC, 'features', 'settings', 'useSettings.ts'))).toBe(false);
    expect(existsSync(join(SRC, 'features', 'polaroid', 'usePolaroid.ts'))).toBe(true);
  });

  it('стилі пішли разом із розміткою', () => {
    /*
     * Перевіряються ОГОЛОШЕННЯ правил (`.photo-upload-zone {`), а не
     * будь-яка згадка: у файлі лишився коментар, який пояснює, куди
     * поділась єдина дорога в бакет `family_photos`, і він мусить
     * лишитись.
     */
    expect(index).not.toContain('.photo-upload-zone {');
    expect(index).not.toContain('.photo-manager-grid {');
    expect(index).not.toContain('.photo-manager-thumb {');
    /*
     * І не повернулись у спільний файл разом із переїздом (ADR-0181):
     * новий екран тримає свої стилі поруч із собою, тож вони зникнуть
     * разом із ним, а не залишаться лежати тут удруге.
     */
    expect(index).not.toContain('.pl-drop {');
    expect(index).not.toContain('.pl-grid {');
  });
});

describe('профіль стоїть у налаштуваннях', () => {
  it('модалка показує саме його', () => {
    expect(settings).toContain('ProfileSection');
  });

  it('рядка «Профіль: <ключ>» більше немає', () => {
    // Він брав ім'я-КЛЮЧ і після перейменування суперечив би полю вводу,
    // що стоїть на пів екрана нижче.
    expect(settings).not.toContain('Профіль: {user.name}');
  });
});

describe('підпис доходить до екранів', () => {
  /*
   * Кожен пункт нижче — місце, де портал НАЗИВАЄ людину. Для кожного
   * перевіряється, що воно читає `displayName`, а не ім'я-ключ.
   */
  const displaySites: ReadonlyArray<readonly [string, string[], string]> = [
    ['вкладки графіка', ['features', 'schedule', 'SchedulePage.tsx'], 'user.displayName'],
    ['картки заповнення графіка', ['features', 'schedule', 'ScheduleCompletionStatus.tsx'], 'user.displayName'],
    ['заголовок редактора графіка', ['features', 'schedule', 'ScheduleEditorCalendar.tsx'], 'user.displayName'],
    ['перемикач людей у «Замірах»', ['features', 'sizes', 'SizesPage.tsx'], 'one.displayName'],
    ['чий день народження в календарі', ['features', 'calendar', 'AddEventModal.tsx'], 'user.displayName'],
    ['вкладки бажань', ['features', 'wishlist', 'WishlistPageBase.tsx'], 'partner.displayName'],
    ['перенос бажання', ['features', 'wishlist', 'MoveWishModal.tsx'], 'partner?.displayName'],
  ];

  for (const [what, parts, needle] of displaySites) {
    it(`${what} — підпис, а не ключ`, () => {
      expect(read(...parts)).toContain(needle);
    });
  }

  it('мапа авторів віддає підпис', () => {
    // `useUsersMap()` підписує покупки, бажання й архів. Це найширший
    // споживач імені в порталі.
    expect(shared).toContain('map[one.id] = one.displayName;');
  });
});

describe('розвилки коду лишились на ключі', () => {
  /*
   * ЗВОРОТНИЙ БІК ТОГО САМОГО ІНВАРІАНТА. Якщо підпис підмінить ключ,
   * зламається не показ, а ПОВЕДІНКА: зникне жіноча група замірів,
   * розійдуться стовпці графіка, і кристал перестане знаходити джерела.
   * Усе це — тихо, і жодне не видно в тому екрані, де перейменували.
   */
  it('жіноча група в «Замірах» дивиться на ім’я-ключ', () => {
    expect(read('features', 'sizes', 'SizesPage.tsx')).toContain('activeUser?.name === FEMALE_NAME');
  });

  it('вибірка джерел кристала дивиться на ім’я-ключ', () => {
    expect(read('features', 'home', 'crystal3d', 'evolution', 'sourceSnapshot.ts'))
      .toContain('user.name === name');
  });

  it('графік розрізняє людей НЕ підписом — тепер порядком (ADR-0180 → ADR-0209)', () => {
    /*
     * ЗМІНЕНО СВІДОМО, І ОСЬ ЩО САМЕ ЗМІНИЛОСЬ У ЗМІСТІ.
     *
     * Було: `users.find((user) => user.name === 'Лєна')`. Перевірка
     * вимагала саме цього рядка, і вимагала правильно — інваріант
     * ADR-0180 полягає в тому, що розвилку коду НЕ СМІЄ рухати підпис
     * (`displayName`), бо перейменування тихо переставило б стовпці.
     *
     * Стало: `users[0]` / `users[1]` за порядком id. Інваріант ADR-0180
     * від цього не слабшає, а міцніє — розвилка більше не залежить від
     * імені ЗОВСІМ, тож ні підпис, ні `users.name` не можуть її зрушити.
     *
     * Причина зміни — ADR-0209: пошук за літералом `'Лєна'` для будь-якої
     * іншої пари повертав `undefined`, і сітка втрачала доріжку без
     * жодної помилки. Тобто старий механізм тримав інваріант ціною того,
     * що модуль працював рівно для однієї пари.
     *
     * Тому перевіряється тепер сам ІНВАРІАНТ, а не механізм: підпис у
     * розвилку не заходить, і літерального імені в ній немає. Обидві
     * сусідні розвилки («Заміри», джерела кристала) лишаються на
     * ім'ї-ключі — вони не переписувались, і їхні перевірки вище не
     * змінені ні на символ.
     */
    const schedule = read('features', 'schedule', 'SchedulePage.tsx')
      // Коментарі знімаються: вони цитують старий рядок дослівно.
      .replace(/\/\*[\s\S]*?\*\//g, (match) => match.replace(/[^\n]/g, ' '))
      .replace(/(^|[^:])\/\/[^\n]*/g, (_match, lead: string) => lead);

    expect(schedule).toContain('const [firstMember, secondMember] = users;');
    expect(schedule).not.toMatch(/name === '(Лєна|Діма)'/);

    /*
     * `displayName` перевіряється НЕ по всьому файлу, і перша редакція
     * цієї перевірки саме так і зробила — та впала. У `SchedulePage` він
     * є рівно один раз, у підписі вкладки, і там він ПРАВИЛЬНИЙ: ADR-0180
     * забороняє підпис у розвилці, а не на екрані. Тому дивимось у самі
     * рядки розвилки.
     */
    const forkLines = schedule
      .split('\n')
      .filter((line) => /firstMember|secondMember/.test(line));
    expect(forkLines.length).toBeGreaterThanOrEqual(3);
    for (const line of forkLines) expect(line).not.toContain('displayName');
  });
});

describe('дата народження прив’язана до подій, а не скопійована в профіль', () => {
  const write = read('features', 'profile', 'useProfile.ts');

  it('шукає подію за парою type+person_user_id', () => {
    // Не за збереженим ідентифікатором: посилання протухло б того дня,
    // коли подію видалять із календаря вручну.
    expect(write).toContain(".eq('type', 'birthday')");
    expect(write).toContain(".eq('person_user_id', userId)");
  });

  it('порожня дата прибирає подію', () => {
    // Інакше в календарі лишилась би дата, якої в профілі вже немає.
    expect(write).toContain(".from('events').delete()");
  });

  it('профіль не тримає власної копії дати', () => {
    // Два джерела однієї дати розійшлися б того дня, коли хтось поправить
    // одне. Тому в `UserProfile` дати немає ЗА ТИПОМ, а не за домовленістю.
    const model = read('features', 'profile', 'profileModel.ts');
    const start = model.indexOf('export interface UserProfile {');
    const shape = model.slice(start, model.indexOf('\n}', start));
    expect(start).toBeGreaterThan(-1);
    expect(shape.toLowerCase()).not.toContain('birthday');
    expect(shape.toLowerCase()).not.toContain('дата');
  });
});

describe('портрет просить у сховища свій розмір', () => {
  it('число ширини в коді збігається з кружечком у CSS', () => {
    /*
     * `<Photo cssWidth={…}>` просить у Supabase рівно стільки пікселів,
     * скільки малює. Якщо число розійдеться з `.profile-avatar`, портал
     * далі виглядатиме правильно — просто тягтиме не той розмір, і
     * помітити це можна буде лише в мережевій панелі.
     */
    const section = read('features', 'profile', 'ProfileSection.tsx');
    const css = read('features', 'profile', 'profile.css');
    const inCode = /AVATAR_CSS_PX = (\d+)/.exec(section)?.[1];
    const inCss = /\.profile-avatar \{[^}]*?width: (\d+)px/s.exec(css)?.[1];
    expect(inCode).toBeDefined();
    expect(inCss).toBe(inCode);
  });
});

describe('портрет не потрапляє в пул фото кристала', () => {
  it('лежить у вкладеній папці, а пул читає корінь бакета', () => {
    /*
     * `usePhotoPool` викликає `list('')` і бере лише файли з розширенням
     * картинки. Вкладена папка приходить туди одним записом БЕЗ
     * розширення й відсіюється. Якби портрет ліг у корінь, обличчя
     * почали б з'являтися на полароїдах кристала.
     */
    expect(read('features', 'profile', 'useProfile.ts')).toContain("PROFILE_FOLDER = 'profile'");
    const home = read('features', 'home', 'useHome.ts');
    expect(home).toContain(".list(''");
  });
});
