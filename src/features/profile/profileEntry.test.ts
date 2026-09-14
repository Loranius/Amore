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

describe('менеджер фото полароїда прибраний', () => {
  it('модалка налаштувань про нього не знає', () => {
    expect(settings).not.toContain('PhotosSection');
    expect(settings).not.toContain('usePhotoManager');
    expect(settings).not.toContain('usePhotoMutations');
  });

  it('хуків більше немає у дереві', () => {
    // `useSettings.ts` після виносу «Замірів» і фото не тримав нічого,
    // крім цього менеджера. Файл, у якому лишились самі експорти, яких
    // ніхто не імпортує, — це запрошення повернути екран випадково.
    expect(existsSync(join(SRC, 'features', 'settings', 'useSettings.ts'))).toBe(false);
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

  it('графік розрізняє людей за ім’ям-ключем', () => {
    const schedule = read('features', 'schedule', 'SchedulePage.tsx');
    expect(schedule).toContain("users.find((user) => user.name === 'Лєна')");
    expect(schedule).toContain("users.find((user) => user.name === 'Діма')");
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
