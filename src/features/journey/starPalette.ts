import { stableHash32 } from '@/engine/evolution/seed';
import type { ConstellationLevel } from './constellationRules';
import { hslToRgb } from './journeyPalette';

// ============================================================
// Барва зірок «Нашого шляху».
// ------------------------------------------------------------
// Три родини кольорів, по одній на рівень події. Це рішення власника, і воно
// змінило те, що було: раніше рівень мав РІВНО ОДИН колір (звичайна бірюзова,
// важлива жовта, ключова — неон із ДНК пари), і сузір'я з двадцяти подій
// виглядало як три кольорові групи. Тепер у кожного рівня родина з шести
// відтінків, і всередині неї кожна подія бере свій — стабільно, за власним
// `id`.
//
// **Родини не перетинаються за тоном.** Це не смак: рівень мусить читатись
// кольором навіть тоді, коли пара обрала відтінок сама. Звичайна подія —
// холодний бік кола (блакить, бірюза, перлина), важлива — фіолетовий,
// ключова — тепле золото. Смуги тонів не перетинаються взагалі, а найвужчий
// розрив між сусідніми родинами — 38° (кобальт 212 і слива 250). Це стереже
// тест: варто комусь підсунути в родину відтінок із чужої смуги, і рівень
// перестане читатись кольором.
//
// **У базі зберігається ТОКЕН, а не колір.** `events.star_color` приймає лише
// назву з цього переліку — це стереже `CHECK` у самій базі, а не форма. Сирий
// hex туди потрапити не може, отже в шейдер не потрапить довільне значення, а
// зміна палітри лишається зміною одного файлу.
// ============================================================

export interface StarShade {
  /** Що лежить у `events.star_color`. */
  token: string;
  /** Як цей колір зветься для пари. */
  label: string;
  /** HSL сучасним синтаксисом — той самий рядок їде і в CSS, і в `hslToRgb`. */
  colour: string;
}

/**
 * Родини за рівнем події.
 *
 * Перший відтінок у кожній родині — той, що був до появи родин: бірюза
 * `hsl(184 76% 58%)` і золото `hsl(44 92% 62%)` обрані власником ще раніше, і
 * втратити їх було б втратою впізнаваності.
 *
 * **Стеля світлості тут не смак, а вимір.** Перша редакція родин мала перлину
 * на 84% і кригу на 74%; на живому екрані з восьми зірок пари шість вийшли
 * білими. Причина — `HALO_TINT_GAIN` нижче: ореол малюється додатковим
 * змішуванням поверх туманності, яка вже світиться, і колір, у якого НАЙТЕМНІШИЙ
 * канал після множника переходить одиницю, втрачає тон повністю. Це та сама
 * вада, що вже одного разу зробила всі зірки нейтральними, лише інша її
 * причина. Тепер її стереже тест.
 */
export const STAR_FAMILIES: Record<ConstellationLevel, readonly StarShade[]> = {
  regular: [
    { token: 'cyan', label: 'Бірюза', colour: 'hsl(184 76% 58%)' },
    { token: 'azure', label: 'Блакить', colour: 'hsl(202 82% 62%)' },
    { token: 'turquoise', label: 'Смарагд', colour: 'hsl(166 62% 56%)' },
    { token: 'ice', label: 'Крига', colour: 'hsl(194 70% 64%)' },
    { token: 'cobalt', label: 'Кобальт', colour: 'hsl(212 78% 62%)' },
    { token: 'pearl', label: 'Перлина', colour: 'hsl(200 56% 66%)' },
  ],
  important: [
    { token: 'violet', label: 'Фіалка', colour: 'hsl(268 80% 66%)' },
    { token: 'amethyst', label: 'Аметист', colour: 'hsl(286 70% 66%)' },
    { token: 'lilac', label: 'Бузок', colour: 'hsl(256 66% 68%)' },
    { token: 'magenta', label: 'Фуксія', colour: 'hsl(312 76% 66%)' },
    { token: 'orchid', label: 'Орхідея', colour: 'hsl(298 62% 68%)' },
    { token: 'plum', label: 'Слива', colour: 'hsl(250 68% 66%)' },
  ],
  key: [
    { token: 'gold', label: 'Золото', colour: 'hsl(44 92% 62%)' },
    { token: 'amber', label: 'Бурштин', colour: 'hsl(36 92% 62%)' },
    { token: 'sun', label: 'Сонце', colour: 'hsl(52 94% 66%)' },
    { token: 'copper', label: 'Мідь', colour: 'hsl(24 84% 64%)' },
    { token: 'honey', label: 'Мед', colour: 'hsl(40 80% 68%)' },
    { token: 'ember', label: 'Жар', colour: 'hsl(14 82% 66%)' },
  ],
};

/** Усі токени палітри. Саме цей перелік повторює `CHECK` у базі. */
export const STAR_COLOR_TOKENS: readonly string[] = Object.values(STAR_FAMILIES)
  .flat()
  .map((shade) => shade.token);

/**
 * На скільки ореол підсилює відтінок перед додатковим змішуванням.
 *
 * Живе тут, а не в шейдері, бо це обмеження НА ПАЛІТРУ, а не на малювання:
 * будь-який відтінок, у якого найтемніший канал після цього множника
 * переходить одиницю, на екрані стає білим. Шейдер ореолу читає це число
 * звідси, тож розійтись вони не можуть.
 */
export const HALO_TINT_GAIN = 1.35;

const BY_TOKEN = new Map<string, StarShade>(
  Object.values(STAR_FAMILIES).flat().map((shade) => [shade.token, shade]),
);

/** Відтінок за токеном. `null` — токена немає в палітрі, і це не помилка. */
export function starShade(token: string | null | undefined): StarShade | null {
  if (!token) return null;
  return BY_TOKEN.get(token) ?? null;
}

/**
 * Стабільне число 0…1 з `id` події — джерело ВСІЄЇ варіації зірки.
 *
 * Окремої колонки під насіння не треба й не буде: `id` уже стабільний,
 * унікальний і незмінний, а `stableHash32` уже вживається в цьому модулі для
 * координат. Одна колонка менше — один спосіб розійтися менше.
 *
 * Фіналізатор обов'язковий: FNV-1a слабко розмиває останній байт, а сусідні
 * `id` різняться саме ним. Без нього подія 12 і подія 13 діставали б сусідні
 * відтінки родини, і пара бачила б градієнт замість розмаїття.
 */
export function starSeed(id: number): number {
  let value = stableHash32(`star:${id}`);
  value ^= value >>> 16;
  value = Math.imul(value, 0x21f0aaad) >>> 0;
  value ^= value >>> 15;
  value = Math.imul(value, 0x735a2d97) >>> 0;
  value ^= value >>> 15;
  return (value >>> 0) / 4294967296;
}

export interface StarColourSource {
  id: number;
  level: ConstellationLevel;
  /** Токен, який обрала пара. `null` — беремо рекомендований за рівнем. */
  starColor?: string | null;
}

/**
 * Колір зірки: вибір пари, а якщо його немає — відтінок родини за насінням.
 *
 * Пара може обрати відтінок і з чужої родини — і це навмисно дозволено.
 * Ієрархія від цього не зникає: після партії 1 рівень видно ще розміром тіла,
 * розміром ореолу, силою сяйва й характером дихання. Колір — останнє, що ми
 * готові забрати в пари заради стрункості схеми.
 */
export function starShadeOf(star: StarColourSource): StarShade {
  const chosen = starShade(star.starColor);
  if (chosen) return chosen;
  const family = STAR_FAMILIES[star.level];
  return family[Math.min(family.length - 1, Math.floor(starSeed(star.id) * family.length))]!;
}

export function starColour(star: StarColourSource): string {
  return starShadeOf(star).colour;
}

/**
 * Які відтінки показати парі у виборі кольору.
 *
 * Родина рівня — і рівно вона: рівень мусить лишатись читаним, а вісімнадцять
 * кружечків в одному рядку перетворюють вибір кольору на вибір із каталогу.
 *
 * Один виняток, і він важливий. Якщо пара вже обрала відтінок ІНШОЇ родини
 * (база це приймає) і потім змінила рівень події, цей відтінок додається до
 * ряду замість того, щоб зникнути. Інакше вибір пари тихо пропав би з очей —
 * а мовчки забирати вибір не можна навіть тоді, коли він не за схемою.
 */
export function offeredShades(
  level: ConstellationLevel,
  chosen: string | null | undefined,
): StarShade[] {
  const family = [...STAR_FAMILIES[level]];
  const picked = starShade(chosen);
  if (picked && !family.some((shade) => shade.token === picked.token)) family.push(picked);
  return family;
}

/**
 * Ядро світліше за свій відтінок — воно тримає сузір'я на собі.
 *
 * Робиться підняттям світлості, а не підмішуванням білого: біле забрало б
 * тон, і ядро вийшло б безбарвним — рівно те, що вже одного разу сталося з
 * усіма зірками, коли біле підмішувалось по всьому силуету.
 */
export function coreColour(colour: string): string {
  const parsed = parseHsl(colour);
  const lightness = Math.min(92, parsed.lightness + 16);
  const saturation = Math.min(100, parsed.saturation + 6);
  return `hsl(${parsed.hue} ${saturation}% ${lightness}%)`;
}

interface ParsedHsl {
  hue: number;
  saturation: number;
  lightness: number;
}

function parseHsl(colour: string): ParsedHsl {
  const match = /^hsl\(\s*([\d.]+)\s+([\d.]+)%\s+([\d.]+)%\s*\)$/.exec(colour);
  if (!match) throw new Error(`не HSL: ${colour}`);
  return {
    hue: Number(match[1]),
    saturation: Number(match[2]),
    lightness: Number(match[3]),
  };
}

/** Тон відтінку в градусах — потрібен тесту, який стереже розрив між родинами. */
export function shadeHue(shade: StarShade): number {
  return parseHsl(shade.colour).hue;
}

/**
 * Колір зірки як три числа 0…1 для `three`.
 *
 * Ядро дістає світлішу версію ВЛАСНОГО відтінку, а не окремий колір: воно
 * головне не барвою, а розміром, сяйвом і місцем у нулі осі.
 */
export function starRgb(star: StarColourSource & { core: boolean }): [number, number, number] {
  const colour = starColour(star);
  return hslToRgb(star.core ? coreColour(colour) : colour);
}

/**
 * Колір РОЗКРИТОЇ події — без підняття світлості для ядра.
 *
 * Оглядове ядро світлішає навмисно: воно мусить читатись найяскравішою
 * крапкою серед десятка інших. Розкрита подія в кадрі одна, змагатись їй ні з
 * ким, а підняте на 16% світлості золото після ACES-тонмапінгу виходить
 * вершковим. Тому сонце бере ВЛАСНИЙ відтінок події.
 */
export function focusRgb(star: StarColourSource): [number, number, number] {
  return hslToRgb(starColour(star));
}

/**
 * Кольори зірок як плаский масив RGB для інстансованого атрибута.
 *
 * Живе тут, а не в компоненті сцени, з однієї причини: у vitest сцена не
 * рендериться взагалі, тож помилка в кольорі в компоненті ловилась би лише
 * знімком. Вада, через яку це винесли — `THREE.Color.set()`, що мовчки лишає
 * білий на сучасному синтаксисі HSL, — саме так і жила: усі вісім зірок вийшли
 * однаковим нейтральним світінням.
 */
export function starTints(
  stars: readonly (StarColourSource & { core: boolean })[],
): Float32Array {
  const array = new Float32Array(stars.length * 3);
  stars.forEach((star, index) => {
    const [r, g, b] = starRgb(star);
    array[index * 3] = r;
    array[index * 3 + 1] = g;
    array[index * 3 + 2] = b;
  });
  return array;
}

/**
 * Насіння зірок як плаский масив для інстансованого атрибута.
 *
 * Оглядова зірка не має процедурної поверхні — вона плаский силует на двадцять
 * пікселів, і чотири октави шуму там були б платою ні за що. Але вона має
 * ВЛАСНИЙ ритм мерехтіння, і саме це число його задає. Це і є дешевий бік LOD.
 */
export function starSeeds(stars: readonly { id: number }[]): Float32Array {
  const array = new Float32Array(stars.length);
  stars.forEach((star, index) => {
    array[index] = starSeed(star.id);
  });
  return array;
}
