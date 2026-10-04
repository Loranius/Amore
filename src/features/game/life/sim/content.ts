// ============================================================
// Зміст світу «Дєвочка в городі» (ADR-0239): міста, дороги, крамниці, речі,
// роботи, пам'ятки. Лише дані — правила в `life.ts`.
//
// Міста — ті, що були в справжній історії (Жилинці, Правдівка,
// Хмельницький, Вінниця, Одеса), і два, куди Лєна може поїхати сама:
// Київ і Львів. Ціни — гривні, як у житті, але м'якші.
// ============================================================

export type CityId = 'zhylyntsi' | 'pravdivka' | 'khmelnytskyi' | 'vinnytsia' | 'kyiv' | 'lviv' | 'odesa';

export interface City {
  id: CityId;
  name: string;
  /** Підпис у дорозі: «до Вінниці». */
  toName: string;
  kind: 'village' | 'city';
  /** Положення на мапі України, частки 0..1 (захід → схід, північ → південь). */
  pos: [number, number];
  /**
   * Положення на детальній мапі Поділля (частки 0..1). На мапі країни
   * Жилинці, Правдівка й Хмельницький лягали в одну точку й Жилинці не
   * можна було обрати (власник, 2026-10-04) — тут між ними видно дорогу.
   */
  local?: [number, number];
  blurb: string;
}

export const CITIES: Record<CityId, City> = {
  zhylyntsi: { id: 'zhylyntsi', name: 'Жилинці', toName: 'до Жилинців', kind: 'village', pos: [0.285, 0.4], local: [0.26, 0.62], blurb: 'Рідне село на Хмельниччині: хата, садочок, школа, ставок.' },
  pravdivka: { id: 'pravdivka', name: 'Правдівка', toName: 'до Правдівки', kind: 'village', pos: [0.302, 0.425], local: [0.42, 0.8], blurb: 'Сусіднє село за стежкою: тут школа для 10–11 класів.' },
  khmelnytskyi: { id: 'khmelnytskyi', name: 'Хмельницький', toName: 'до Хмельницького', kind: 'city', pos: [0.28, 0.35], local: [0.34, 0.24], blurb: 'Обласний центр: ліцей, ринок, Проскурівська.' },
  vinnytsia: { id: 'vinnytsia', name: 'Вінниця', toName: 'до Вінниці', kind: 'city', pos: [0.36, 0.4], local: [0.82, 0.45], blurb: 'ВДПУ, Вишенька, фонтан на Південному Бузі.' },
  kyiv: { id: 'kyiv', name: 'Київ', toName: 'до Києва', kind: 'city', pos: [0.47, 0.25], blurb: 'Столиця: Хрещатик, Лавра, кар\'єра й метро.' },
  lviv: { id: 'lviv', name: 'Львів', toName: 'до Львова', kind: 'city', pos: [0.115, 0.32], blurb: 'Бруківка, ратуша, кава й шоколад.' },
  odesa: { id: 'odesa', name: 'Одеса', toName: 'до Одеси', kind: 'city', pos: [0.485, 0.74], blurb: 'Море, Отрада, Жовтий камінь.' },
};

export const CITY_IDS = Object.keys(CITIES) as CityId[];

/** Міста детальної мапи Поділля. */
export const REGION_CITY_IDS = CITY_IDS.filter((id) => CITIES[id].local);

export type RouteMode = 'walk' | 'bus' | 'train';

export interface Route {
  a: CityId;
  b: CityId;
  mode: RouteMode;
  price: number;
  minutes: number;
}

export const ROUTES: readonly Route[] = [
  { a: 'zhylyntsi', b: 'pravdivka', mode: 'walk', price: 0, minutes: 50 },
  { a: 'zhylyntsi', b: 'khmelnytskyi', mode: 'bus', price: 60, minutes: 90 },
  { a: 'khmelnytskyi', b: 'vinnytsia', mode: 'train', price: 140, minutes: 120 },
  { a: 'khmelnytskyi', b: 'lviv', mode: 'train', price: 260, minutes: 210 },
  { a: 'vinnytsia', b: 'kyiv', mode: 'train', price: 290, minutes: 180 },
  { a: 'vinnytsia', b: 'odesa', mode: 'train', price: 380, minutes: 330 },
  { a: 'kyiv', b: 'lviv', mode: 'train', price: 420, minutes: 300 },
  { a: 'kyiv', b: 'odesa', mode: 'train', price: 440, minutes: 360 },
];

export const MODE_NAME: Record<RouteMode, string> = { walk: 'пішки', bus: 'автобусом', train: 'потягом' };

// ------------------------------------------------------------
// Пам'ятки: кожна — фото до альбому й настрій.
// ------------------------------------------------------------
export interface Sight {
  id: string;
  city: CityId;
  name: string;
  mood: number;
}

export const SIGHTS: readonly Sight[] = [
  { id: 'pond', city: 'zhylyntsi', name: 'Ставок за хатою', mood: 8 },
  { id: 'sunflowers', city: 'pravdivka', name: 'Соняшникове поле', mood: 10 },
  { id: 'proskurivska', city: 'khmelnytskyi', name: 'Проскурівська вулиця', mood: 10 },
  { id: 'fountain', city: 'vinnytsia', name: 'Фонтан на Бузі', mood: 14 },
  { id: 'vtei', city: 'vinnytsia', name: 'ВДПУ', mood: 6 },
  { id: 'khreshchatyk', city: 'kyiv', name: 'Хрещатик', mood: 14 },
  { id: 'lavra', city: 'kyiv', name: 'Лавра', mood: 16 },
  { id: 'ratusha', city: 'lviv', name: 'Ратуша', mood: 16 },
  { id: 'chocolate', city: 'lviv', name: 'Шоколадна майстерня', mood: 14 },
  { id: 'otrada', city: 'odesa', name: 'Пляж Отрада', mood: 18 },
  { id: 'yellowStone', city: 'odesa', name: 'Жовтий камінь', mood: 20 },
];

// ------------------------------------------------------------
// Крамниці й речі.
// ------------------------------------------------------------
export type ShopId = 'grocery' | 'clothes' | 'home' | 'books' | 'tech' | 'flowers' | 'souvenirs' | 'cafe';

export const SHOP_NAME: Record<ShopId, string> = {
  grocery: 'Продукти',
  clothes: 'Одяг',
  home: 'Дім і затишок',
  books: 'Книгарня',
  tech: 'Техніка',
  flowers: 'Квіти й подарунки',
  souvenirs: 'Сувеніри',
  cafe: 'Кав\'ярня',
};

/** Які крамниці стоять у якому місті. */
export const CITY_SHOPS: Record<CityId, readonly ShopId[]> = {
  zhylyntsi: ['grocery'],
  pravdivka: ['grocery'],
  khmelnytskyi: ['grocery', 'clothes', 'books', 'flowers'],
  vinnytsia: ['grocery', 'clothes', 'home', 'books', 'tech', 'flowers', 'cafe'],
  kyiv: ['grocery', 'clothes', 'home', 'tech', 'books', 'souvenirs', 'cafe'],
  lviv: ['grocery', 'clothes', 'books', 'souvenirs', 'cafe'],
  odesa: ['grocery', 'clothes', 'souvenirs', 'flowers', 'cafe'],
};

export type ItemKind = 'food' | 'outfit' | 'decor' | 'book' | 'gift' | 'gadget' | 'souvenir';
export type SkillId = 'knowledge' | 'creativity' | 'sport' | 'charm';

export const SKILL_NAME: Record<SkillId, string> = {
  knowledge: 'Знання',
  creativity: 'Творчість',
  sport: 'Спорт',
  charm: 'Чарівність',
};

export interface Outfit {
  top: string;
  bottom: string;
  /** Сукня малюється суцільно від плечей. */
  dress?: boolean;
  accent?: string;
}

export type DecorSlot = 'bed' | 'rug' | 'plant' | 'lamp' | 'poster' | 'shelf' | 'tv' | 'pet' | 'table' | 'desk' | 'sofa';

export interface Item {
  id: string;
  name: string;
  kind: ItemKind;
  shop: ShopId;
  price: number;
  /** Лише в цих містах (сувеніри, місцеві смаколики). */
  cities?: readonly CityId[];
  energy?: number;
  mood?: number;
  skills?: Partial<Record<SkillId, number>>;
  outfit?: Outfit;
  decor?: DecorSlot;
  /** Колір предмета в кімнаті. */
  tint?: string;
  /** Подарунок: скільки сердець додає. */
  hearts?: number;
  /** Від якого тижня продається (телефон не продають садочківцям). */
  minWeek?: number;
  blurb: string;
}

export const ITEMS: readonly Item[] = [
  // Їжа — енергія зараз, з'їдається одразу.
  { id: 'bun', name: 'Булочка з маком', kind: 'food', shop: 'grocery', price: 12, energy: 14, mood: 2, blurb: '+14 енергії' },
  { id: 'apple', name: 'Яблука', kind: 'food', shop: 'grocery', price: 8, energy: 8, blurb: '+8 енергії' },
  { id: 'varenyky', name: 'Вареники з вишнею', kind: 'food', shop: 'grocery', price: 35, energy: 30, mood: 4, blurb: '+30 енергії' },
  { id: 'icecream', name: 'Морозиво', kind: 'food', shop: 'grocery', price: 20, energy: 6, mood: 8, blurb: '+8 настрою' },
  { id: 'coffee', name: 'Капучино', kind: 'food', shop: 'cafe', price: 45, energy: 24, mood: 5, minWeek: 9, blurb: '+24 енергії' },
  { id: 'cake', name: 'Чізкейк', kind: 'food', shop: 'cafe', price: 70, energy: 18, mood: 12, blurb: '+12 настрою' },
  { id: 'lvivChoco', name: 'Львівський шоколад', kind: 'food', shop: 'souvenirs', price: 60, cities: ['lviv'], energy: 12, mood: 14, blurb: '+14 настрою' },
  { id: 'odesaFish', name: 'Бички з Привозу', kind: 'food', shop: 'souvenirs', price: 50, cities: ['odesa'], energy: 26, mood: 6, blurb: '+26 енергії' },

  // Одяг — змінює вигляд Лєни.
  { id: 'dressBlue', name: 'Блакитна сукня', kind: 'outfit', shop: 'clothes', price: 380, outfit: { top: '#5aa7e0', bottom: '#f4f4f7', dress: true }, blurb: 'Улюблена: блакитне й біле' },
  { id: 'hoodie', name: 'Худі й джинси', kind: 'outfit', shop: 'clothes', price: 420, outfit: { top: '#c46b8f', bottom: '#3d5a8c' }, blurb: 'Тепло й зручно' },
  { id: 'sundress', name: 'Літній сарафан', kind: 'outfit', shop: 'clothes', price: 340, outfit: { top: '#f7d36a', bottom: '#f39c6b', dress: true }, blurb: 'Для моря' },
  { id: 'officeSuit', name: 'Діловий костюм', kind: 'outfit', shop: 'clothes', price: 900, outfit: { top: '#3b3f58', bottom: '#2c2f45', accent: '#f4f4f7' }, minWeek: 12, skills: { charm: 4 }, blurb: '+4 чарівності на співбесідах' },
  { id: 'vyshyvanka', name: 'Вишиванка', kind: 'outfit', shop: 'souvenirs', price: 650, cities: ['lviv', 'kyiv'], outfit: { top: '#f6f1e6', bottom: '#b8323a', accent: '#b8323a' }, skills: { charm: 3 }, blurb: 'Червоне й біле, ручна вишивка' },
  { id: 'raincoat', name: 'Жовтий дощовик', kind: 'outfit', shop: 'clothes', price: 300, outfit: { top: '#f2c14e', bottom: '#3d5a8c' }, blurb: 'Як у мультику' },

  // Затишок — стоїть у кімнаті вдома.
  { id: 'plant', name: 'Монстера', kind: 'decor', shop: 'home', price: 220, decor: 'plant', tint: '#3f8a43', mood: 6, blurb: 'Кімната дихає' },
  { id: 'rugPink', name: 'Рожевий килимок', kind: 'decor', shop: 'home', price: 260, decor: 'rug', tint: '#e98fb0', mood: 5, blurb: 'М\'яко під ногами' },
  { id: 'rugBlue', name: 'Синій килим', kind: 'decor', shop: 'home', price: 300, decor: 'rug', tint: '#5b7fc4', mood: 5, blurb: 'Як море вдома' },
  { id: 'lamp', name: 'Гірлянда-ліхтарик', kind: 'decor', shop: 'home', price: 180, decor: 'lamp', tint: '#ffd27a', mood: 6, blurb: 'Тепле світло вночі' },
  { id: 'poster', name: 'Постер з Одесою', kind: 'decor', shop: 'souvenirs', price: 150, cities: ['odesa', 'kyiv'], decor: 'poster', tint: '#3f7fc1', mood: 4, blurb: 'Море на стіні' },
  { id: 'shelf', name: 'Книжкова полиця', kind: 'decor', shop: 'home', price: 450, decor: 'shelf', tint: '#8a5a34', skills: { knowledge: 3 }, blurb: '+3 знань' },
  { id: 'bedQueen', name: 'Велике ліжко', kind: 'decor', shop: 'home', price: 1600, decor: 'bed', tint: '#f2a5c0', energy: 10, minWeek: 12, blurb: 'Сон відновлює більше енергії' },
  { id: 'desk', name: 'Письмовий стіл', kind: 'decor', shop: 'home', price: 900, decor: 'desk', tint: '#a8784a', skills: { knowledge: 2 }, minWeek: 9, blurb: 'Місце для ноутбука й навчання' },
  { id: 'sofa', name: 'М\'який диван', kind: 'decor', shop: 'home', price: 2200, decor: 'sofa', tint: '#c46b8f', mood: 8, minWeek: 12, blurb: 'Вечори з серіалами вдвох' },
  { id: 'tv', name: 'Телевізор', kind: 'decor', shop: 'tech', price: 2400, decor: 'tv', tint: '#23232c', mood: 8, minWeek: 12, blurb: 'Серіали вечорами' },
  { id: 'kitten', name: 'Кошеня Пиріжок', kind: 'decor', shop: 'home', price: 0, decor: 'pet', tint: '#e8a25a', mood: 12, minWeek: 16, blurb: 'Безкоштовно, з притулку. Мур!' },
  { id: 'table', name: 'Столик на двох', kind: 'decor', shop: 'home', price: 700, decor: 'table', tint: '#c49a6c', mood: 4, blurb: 'Вечері вдвох' },

  // Книжки — навички назавжди.
  { id: 'fairyTales', name: 'Українські казки', kind: 'book', shop: 'books', price: 90, skills: { knowledge: 3, creativity: 2 }, blurb: '+3 знань, +2 творчості' },
  { id: 'mathBook', name: 'Цікава математика', kind: 'book', shop: 'books', price: 140, skills: { knowledge: 6 }, minWeek: 3, blurb: '+6 знань' },
  { id: 'artBook', name: 'Альбом для малювання', kind: 'book', shop: 'books', price: 110, skills: { creativity: 6 }, blurb: '+6 творчості' },
  { id: 'english', name: 'English for Everyone', kind: 'book', shop: 'books', price: 260, skills: { knowledge: 8, charm: 2 }, minWeek: 5, blurb: '+8 знань, +2 чарівності' },
  { id: 'econ', name: 'Економіка для людей', kind: 'book', shop: 'books', price: 320, skills: { knowledge: 10 }, minWeek: 11, blurb: '+10 знань' },
  { id: 'design', name: 'Основи дизайну', kind: 'book', shop: 'books', price: 380, skills: { creativity: 10 }, minWeek: 11, blurb: '+10 творчості' },

  // Техніка.
  { id: 'phone', name: 'Смартфон', kind: 'gadget', shop: 'tech', price: 3200, mood: 10, skills: { charm: 3 }, minWeek: 7, blurb: 'Дзвінки, фото, і дайвінчик…' },
  { id: 'laptop', name: 'Ноутбук', kind: 'gadget', shop: 'tech', price: 9000, skills: { knowledge: 8, creativity: 6 }, minWeek: 11, blurb: '+8 знань, +6 творчості' },
  { id: 'bike', name: 'Велосипед', kind: 'gadget', shop: 'tech', price: 2600, skills: { sport: 8 }, mood: 6, minWeek: 4, blurb: '+8 спорту, ходиш швидше' },
  { id: 'sneakers', name: 'Кросівки для бігу', kind: 'gadget', shop: 'clothes', price: 1100, skills: { sport: 5 }, minWeek: 3, blurb: '+5 спорту' },

  // Подарунки — серця близьким.
  { id: 'tulips', name: 'Тюльпани', kind: 'gift', shop: 'flowers', price: 120, hearts: 1, blurb: '+1 серце тому, кому подаруєш' },
  { id: 'roses', name: 'Троянди', kind: 'gift', shop: 'flowers', price: 350, hearts: 2, minWeek: 12, blurb: '+2 серця' },
  { id: 'teddy', name: 'Плюшевий ведмедик', kind: 'gift', shop: 'flowers', price: 260, hearts: 2, blurb: '+2 серця' },
  { id: 'watch', name: 'Годинник', kind: 'gift', shop: 'tech', price: 1800, hearts: 3, minWeek: 12, blurb: '+3 серця' },

  // Сувеніри — у колекцію.
  { id: 'magnetKyiv', name: 'Магнітик «Київ»', kind: 'souvenir', shop: 'souvenirs', price: 40, cities: ['kyiv'], mood: 4, blurb: 'У колекцію на холодильник' },
  { id: 'magnetLviv', name: 'Магнітик «Львів»', kind: 'souvenir', shop: 'souvenirs', price: 40, cities: ['lviv'], mood: 4, blurb: 'У колекцію на холодильник' },
  { id: 'magnetOdesa', name: 'Магнітик «Одеса»', kind: 'souvenir', shop: 'souvenirs', price: 40, cities: ['odesa'], mood: 4, blurb: 'У колекцію на холодильник' },
  { id: 'shell', name: 'Мушля з Отради', kind: 'souvenir', shop: 'souvenirs', price: 25, cities: ['odesa'], mood: 6, blurb: 'Шумить морем' },
];

export const ITEM_BY_ID: ReadonlyMap<string, Item> = new Map(ITEMS.map((item) => [item.id, item]));

export function itemById(id: string): Item {
  const item = ITEM_BY_ID.get(id);
  if (!item) throw new Error(`Невідома річ: ${id}`);
  return item;
}

/** Що продається в цій крамниці цього міста на цьому тижні. */
export function shopStock(shop: ShopId, city: CityId, week: number): Item[] {
  if (!CITY_SHOPS[city].includes(shop)) return [];
  return ITEMS.filter((item) => item.shop === shop
    && (item.cities === undefined || item.cities.includes(city))
    && (item.minWeek === undefined || week >= item.minWeek));
}

// ------------------------------------------------------------
// Роботи.
// ------------------------------------------------------------
export type Education = 'none' | 'school' | 'diploma';
export const EDUCATION_NAME: Record<Education, string> = {
  none: 'без атестата',
  school: 'атестат',
  diploma: 'диплом ВДПУ',
};

export type ShiftGame = 'barista' | 'cashier' | 'accountant' | 'florist' | 'teacher' | 'designer' | 'baker' | 'guide' | 'post';

export interface Job {
  id: string;
  title: string;
  place: string;
  city: CityId;
  education: Education;
  skills?: Partial<Record<SkillId, number>>;
  /** Гривень за зміну на першому рівні; кожен рівень +25%. */
  pay: number;
  minutes: number;
  game: ShiftGame;
  /** Чи можна працювати ще школяркою/студенткою (лише вихідними). */
  partTime: boolean;
  /** Яку навичку зміна розвиває. */
  grows: SkillId;
  ranks: readonly string[];
  blurb: string;
}

export const JOBS: readonly Job[] = [
  { id: 'post', title: 'Помічниця на пошті', place: 'Пошта', city: 'zhylyntsi', education: 'none', pay: 120, minutes: 240, game: 'post', partTime: true, grows: 'charm', ranks: ['Помічниця', 'Листоноша'], blurb: 'Розкласти листи по скриньках. Вихідними, з 8 класу.' },
  { id: 'market', title: 'Продавчиня на ринку', place: 'Ринок', city: 'khmelnytskyi', education: 'none', pay: 220, minutes: 360, game: 'cashier', partTime: true, grows: 'charm', ranks: ['Продавчиня', 'Старша продавчиня'], blurb: 'Порахувати решту швидко й чесно.' },
  { id: 'barista', title: 'Бариста', place: 'Кав\'ярня', city: 'vinnytsia', education: 'none', pay: 320, minutes: 360, game: 'barista', partTime: true, grows: 'charm', ranks: ['Бариста', 'Старша бариста', 'Керівниця кав\'ярні'], blurb: 'Каву за рецептом — і з усмішкою.' },
  { id: 'florist', title: 'Флористка', place: 'Квіти', city: 'vinnytsia', education: 'school', skills: { creativity: 20 }, pay: 420, minutes: 420, game: 'florist', partTime: false, grows: 'creativity', ranks: ['Флористка', 'Старша флористка', 'Власниця салону'], blurb: 'Букет за замовленням: кольори й настрій.' },
  { id: 'accountant', title: 'Бухгалтерка', place: 'Офіс', city: 'vinnytsia', education: 'diploma', skills: { knowledge: 45 }, pay: 780, minutes: 480, game: 'accountant', partTime: false, grows: 'knowledge', ranks: ['Бухгалтерка', 'Головна бухгалтерка', 'Фінансова директорка'], blurb: 'Дебет, кредит і ні копійки мимо.' },
  { id: 'teacher', title: 'Вчителька економіки', place: 'Школа', city: 'khmelnytskyi', education: 'diploma', skills: { knowledge: 40, charm: 25 }, pay: 650, minutes: 420, game: 'teacher', partTime: false, grows: 'charm', ranks: ['Вчителька', 'Класна керівниця', 'Директорка'], blurb: 'Перевірити зошити й не загубити жодного учня.' },
  { id: 'baker', title: 'Кондитерка', place: 'Пекарня', city: 'lviv', education: 'school', skills: { creativity: 30 }, pay: 560, minutes: 420, game: 'baker', partTime: false, grows: 'creativity', ranks: ['Кондитерка', 'Шеф-кондитерка'], blurb: 'Торт за ескізом — шар за шаром.' },
  { id: 'designer', title: 'Дизайнерка', place: 'Студія', city: 'kyiv', education: 'diploma', skills: { creativity: 50, knowledge: 35 }, pay: 1100, minutes: 480, game: 'designer', partTime: false, grows: 'creativity', ranks: ['Дизайнерка', 'Арт-директорка'], blurb: 'Перемалювати макет піксель у піксель.' },
  { id: 'guide', title: 'Гідеса по Одесі', place: 'Екскурсії', city: 'odesa', education: 'school', skills: { charm: 40 }, pay: 700, minutes: 360, game: 'guide', partTime: false, grows: 'charm', ranks: ['Гідеса', 'Головна гідеса'], blurb: 'Провести групу маршрутом і нікого не загубити.' },
];

export const JOB_BY_ID: ReadonlyMap<string, Job> = new Map(JOBS.map((job) => [job.id, job]));

// ------------------------------------------------------------
// Люди.
// ------------------------------------------------------------
export type PersonId = 'mom' | 'dima' | 'friend';
export const PERSON_NAME: Record<PersonId, string> = { mom: 'Мама', dima: 'Діма', friend: 'Подруга Оля' };
export const MAX_HEARTS = 10;
