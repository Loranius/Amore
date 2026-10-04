// ============================================================
// Міста «Дєвочка в городі» (ADR-0239). Кожне має своє обличчя:
//   Жилинці — хата з криницею, садочок, школа, ставок із качками;
//   Правдівка — школа старших класів і соняшникове поле;
//   Хмельницький — автовокзал, ліцей, ринок, Проскурівська;
//   Вінниця — вокзал, ВДПУ, фонтан над Бугом, кав'ярня, офіс;
//   Київ — Хрещатик із каштанами, Лавра, студія дизайну, трамвай;
//   Львів — бруківка, ратуша, шоколадна майстерня, пекарня;
//   Одеса — вокзал, місто й пляж Отрада з Жовтим каменем.
// ============================================================
import type { CityId } from '../sim/content';
import { MapBuilder } from './build';
import type { GameMap } from './types';

const homeZone = { type: 'home' } as const;

function zhylyntsi(): GameMap {
  const m = new MapBuilder('zhylyntsi', 'zhylyntsi', 'с. Жилинці', 42, 30);
  m.folk = 4;
  m.pondFreezes = true;
  m.fill(0, 14, 42, 2, 'd').fill(20, 0, 2, 30, 'd').fill(0, 24, 42, 2, 'd');
  // Город за хатою.
  m.fill(1, 1, 11, 4, 'G');
  m.building({ id: 'home', x: 4, y: 7, w: 6, h: 4, style: 'cottage', label: 'Рідна хата', doorX: 7, action: homeZone, zoneLabel: 'Додому' });
  m.fill(7, 11, 1, 3, 'd');
  for (let x = 2; x <= 12; x += 1) if (x !== 7) m.fill(x, 13, 1, 1, 'F');
  m.fill(2, 6, 1, 7, 'F').fill(12, 6, 1, 7, 'F');
  m.prop('well', 10, 9).prop('chicken', 3.2, 11.2).prop('chicken', 9.5, 11.6, { solid: false }).prop('cat', 4.6, 10.6);
  m.prop('sunflowers', 2, 3).prop('sunflowers', 4, 3).prop('sunflowers', 6, 2).prop('haystack', 9, 2);
  m.zone('mom', 8, 11, 3, 2, { type: 'mom' }, 'Поговорити з мамою');
  m.spawn('home', 7, 12).spawn('default', 7, 12);

  m.building({ id: 'neighbour', x: 14, y: 7, w: 5, h: 4, style: 'house', label: 'Сусіди' });
  m.fill(16, 11, 1, 3, 'd');
  m.building({ id: 'nhouse', x: 30, y: 1, w: 5, h: 4, style: 'cottage', label: 'Бабуся з котом', roof: '#b8943a' });
  m.fill(32, 5, 1, 9, 'd');

  m.building({ id: 'sadok', x: 24, y: 5, w: 7, h: 4, style: 'sadok', label: 'Садочок «Сонечко»', doorX: 27, action: { type: 'duty', building: 'sadok' } });
  m.fill(27, 9, 1, 5, 'd');
  m.fill(33, 7, 8, 6, 'd');
  m.prop('swing', 33.5, 8.5).prop('slide', 37, 8).prop('sandbox', 34, 11).prop('bench', 39, 11);
  m.zone('play', 33, 7, 8, 6, { type: 'friends' }, 'Погратися з друзями');

  m.building({ id: 'school', x: 23, y: 19, w: 10, h: 5, style: 'school', label: 'Жилинецька школа', doorX: 28, action: { type: 'duty', building: 'school' } });
  m.fill(34, 17, 7, 6, 'd');
  m.prop('goal', 35, 18.5).prop('flagpole', 22, 21);

  m.building({ id: 'shop', x: 8, y: 20, w: 5, h: 4, style: 'shop', label: 'Сільмаг', sign: 'bread', doorX: 10, action: { type: 'shop', shop: 'grocery' } });
  m.building({ id: 'post', x: 14, y: 20, w: 4, h: 4, style: 'post', label: 'Пошта', sign: 'letter', doorX: 16, action: { type: 'workplace', job: 'post' } });
  m.prop('mailbox', 18.2, 22.6);

  m.fill(1, 26, 8, 4, 'w');
  m.prop('duck', 3, 27).prop('duck', 5.5, 28.2).prop('bench', 9.3, 26.4);
  m.zone('pond', 9, 26, 3, 2, { type: 'sight', sight: 'pond' }, 'Ставок за хатою');
  m.tree(11, 28, 'willow');

  m.prop('busStop', 37, 11, { solid: false });
  m.zone('bus', 36, 12, 4, 2, { type: 'station' }, 'Зупинка · автобус');
  m.spawn('station', 37, 13);
  m.zone('toPravdivka', 20, 28, 2, 2, { type: 'walk', to: 'pravdivka' }, 'Стежка до Правдівки');
  m.spawn('walk', 21, 27);

  m.building({ id: 'hata2', x: 26, y: 26, w: 5, h: 3, style: 'cottage', label: 'Хата' });
  m.building({ id: 'hata3', x: 34, y: 26, w: 5, h: 3, style: 'house', label: 'Хата', roof: '#8a6f52' });

  for (const x of [1, 5, 9, 13, 17]) m.tree(x, 17, 'poplar');
  m.tree(23, 12, 'apple').tree(14, 4, 'cherry').tree(19, 4, 'apple').tree(39, 3, 'oak').tree(40, 21, 'oak');
  m.scatterTrees(0, 0, 42, 6, ['oak', 'apple', 'cherry', 'birch'], 0.35, 1);
  m.scatterTrees(0, 16, 20, 8, ['oak', 'birch', 'cherry'], 0.25, 2);
  m.prop('bush', 18, 18).prop('flowerBed', 22, 17).prop('rock', 13, 28);
  return m.build();
}

function pravdivka(): GameMap {
  const m = new MapBuilder('pravdivka', 'pravdivka', 'с. Правдівка', 32, 24);
  m.folk = 3;
  m.fill(14, 0, 2, 24, 'd').fill(0, 11, 32, 2, 'd');
  m.zone('toZhyl', 14, 0, 2, 2, { type: 'walk', to: 'zhylyntsi' }, 'Стежка до Жилинців');
  m.spawn('walk', 14, 2).spawn('default', 14, 2);
  m.building({ id: 'school', x: 3, y: 3, w: 9, h: 5, style: 'school', label: 'Правдівська школа', doorX: 7, wall: '#e3c08a', action: { type: 'duty', building: 'school' } });
  m.fill(7, 8, 1, 3, 'd');
  m.prop('flagpole', 1.5, 5).prop('goal', 3, 14.5);
  m.building({ id: 'shop', x: 18, y: 6, w: 5, h: 4, style: 'shop', label: 'Магазин', sign: 'bread', doorX: 20, action: { type: 'shop', shop: 'grocery' } });
  m.fill(20, 10, 1, 1, 'd');
  m.building({ id: 'hata1', x: 24, y: 3, w: 5, h: 4, style: 'cottage', label: 'Хата' });
  m.fill(26, 7, 1, 4, 'd');
  m.building({ id: 'hata2', x: 18, y: 15, w: 5, h: 4, style: 'house', label: 'Хата' });
  m.fill(20, 19, 1, 5, 'd');
  // Соняшникове поле.
  m.fill(1, 15, 11, 8, 'G');
  for (let x = 1.5; x < 11; x += 2.2) for (let y = 15.5; y < 22; y += 2.4) m.prop('sunflowers', x, y);
  m.zone('field', 12, 16, 2, 4, { type: 'sight', sight: 'sunflowers' }, 'Соняшникове поле');
  m.prop('haystack', 25, 17).prop('well', 27, 13.6).prop('chicken', 24, 9).prop('chicken', 29, 9.4);
  m.scatterTrees(0, 0, 32, 3, ['oak', 'birch', 'poplar'], 0.4, 3);
  m.scatterTrees(16, 13, 16, 11, ['apple', 'cherry', 'oak'], 0.25, 4);
  return m.build();
}

function khmelnytskyi(): GameMap {
  const m = new MapBuilder('khmelnytskyi', 'khmelnytskyi', 'м. Хмельницький', 42, 30, 'g');
  m.folk = 8;
  m.fill(0, 12, 42, 3, 'm').fill(0, 15, 42, 1, 'p').fill(0, 11, 42, 1, 'p');
  m.fill(19, 0, 3, 30, 'a').fill(18, 0, 1, 30, 'p').fill(22, 0, 1, 30, 'p');
  m.fill(19, 12, 3, 3, 'z');
  m.building({ id: 'busStation', x: 2, y: 4, w: 8, h: 4, style: 'busStation', label: 'Автовокзал', action: { type: 'station' }, zoneLabel: 'Автовокзал · квитки' });
  m.fill(6, 8, 1, 3, 'p');
  m.spawn('station', 6, 9).spawn('default', 6, 9);
  m.prop('busStop', 10, 9.5, { solid: false }).prop('bench', 12, 9.5);
  m.building({ id: 'lyceum', x: 24, y: 3, w: 9, h: 5, style: 'lyceum', label: 'Ліцей', action: { type: 'lyceum' } });
  m.fill(28, 8, 1, 3, 'p');
  m.building({ id: 'teacherSchool', x: 34, y: 3, w: 7, h: 5, style: 'school', label: 'Школа №1', wall: '#d8c09a', action: { type: 'workplace', job: 'teacher' } });
  m.fill(37, 8, 1, 3, 'p');
  // Проскурівська — пішохідна, з ліхтарями.
  m.fill(23, 16, 19, 4, 'c');
  for (let x = 24; x < 42; x += 4) m.prop('lamp', x, 15.2, { solid: false });
  m.zone('prosk', 30, 17, 4, 2, { type: 'sight', sight: 'proskurivska' }, 'Проскурівська вулиця');
  m.prop('fountain', 34.5, 20.5);
  m.building({ id: 'clothes', x: 24, y: 21, w: 5, h: 4, style: 'shop', label: 'Одяг', sign: 'shirt', roof: '#5a5aa8', action: { type: 'shop', shop: 'clothes' } });
  m.building({ id: 'books', x: 30, y: 21, w: 4, h: 4, style: 'shop', label: 'Книгарня', sign: 'book', wall: '#b8a07a', action: { type: 'shop', shop: 'books' } });
  m.building({ id: 'flowers', x: 37, y: 21, w: 4, h: 4, style: 'kiosk', label: 'Квіти', sign: 'flower', action: { type: 'shop', shop: 'flowers' } });
  m.fill(23, 25, 19, 2, 'p');
  // Ринок.
  m.fill(1, 17, 16, 10, 'c');
  for (const [x, y, c] of [[2, 18, '#d9534f'], [7, 18, '#3a6fd8'], [12, 18, '#f6c14e'], [2, 23, '#2f8a5a'], [7, 23, '#d9534f']] as const) m.prop('stall', x, y, { tint: c });
  m.zone('market', 12, 22, 4, 3, { type: 'workplace', job: 'market' }, 'Ринок · продавчиня');
  m.building({ id: 'grocery', x: 11, y: 3, w: 5, h: 4, style: 'shop', label: 'Продукти', sign: 'bread', action: { type: 'shop', shop: 'grocery' } });
  m.fill(13, 7, 1, 4, 'p');
  m.prop('board', 16, 9).zone('jobs', 15, 10, 3, 1, { type: 'jobs' }, 'Дошка вакансій');
  m.prop('car', 26, 12.2).prop('car', 4, 12.6, { tint: '#f4f4f7' });
  for (const y of [1, 5, 9, 18, 23, 27]) m.tree(17, y, 'chestnut');
  m.scatterTrees(0, 0, 18, 3, ['chestnut', 'oak'], 0.5, 5);
  m.scatterTrees(23, 26, 19, 4, ['chestnut', 'birch'], 0.5, 6);
  return m.build();
}

function vinnytsia(): GameMap {
  const m = new MapBuilder('vinnytsia', 'vinnytsia', 'м. Вінниця', 46, 34, 'g');
  m.folk = 10;
  m.fill(0, 0, 46, 2, 'r').fill(0, 2, 46, 2, 'p');
  m.building({ id: 'station', x: 16, y: 4, w: 12, h: 5, style: 'station', label: 'Залізничний вокзал', action: { type: 'station' }, zoneLabel: 'Вокзал · квитки' });
  m.fill(0, 10, 46, 3, 'm').fill(0, 9, 46, 1, 'p').fill(0, 13, 46, 1, 'p');
  m.fill(21, 9, 3, 1, 'p');
  m.spawn('station', 22, 10).spawn('default', 22, 10);
  m.fill(21, 14, 3, 20, 'a').fill(20, 14, 1, 20, 'p').fill(24, 14, 1, 20, 'p');
  m.fill(21, 10, 3, 3, 'z');
  // ВДПУ і гуртожиток ліворуч.
  m.building({ id: 'vtei', x: 2, y: 14, w: 12, h: 6, style: 'uni', label: 'ВДПУ', doorX: 8, action: { type: 'duty', building: 'vtei' } });
  m.fill(8, 20, 1, 1, 'p');
  m.zone('vteiPhoto', 10, 20, 3, 1, { type: 'sight', sight: 'vtei' }, 'Сфотографувати ВДПУ');
  m.fill(1, 20, 19, 2, 'p');
  m.building({ id: 'home', x: 2, y: 23, w: 7, h: 6, style: 'block', label: 'Житло', action: homeZone, zoneLabel: 'Додому' });
  m.fill(5, 29, 1, 1, 'p');
  m.spawn('home', 5, 30);
  m.fill(1, 29, 19, 2, 'p');
  m.building({ id: 'office', x: 11, y: 23, w: 7, h: 6, style: 'office', label: 'Бізнес-центр', sign: 'briefcase', action: { type: 'workplace', job: 'accountant' } });
  // Магазини вздовж проспекту, праворуч.
  m.fill(25, 20, 21, 2, 'p');
  m.building({ id: 'cafe', x: 26, y: 15, w: 5, h: 5, style: 'cafe', label: 'Кав\'ярня «Вишенька»', sign: 'cup', action: { type: 'workplace', job: 'barista' }, zoneLabel: 'Кав\'ярня' });
  m.prop('cafeTable', 31.2, 20.3, { solid: false }).prop('cafeTable', 25, 21.6, { solid: false });
  m.zone('date', 31, 20, 2, 2, { type: 'date' }, 'Побачення в кав\'ярні');
  m.zone('coffee', 29, 20, 2, 1, { type: 'shop', shop: 'cafe' }, 'Купити каву');
  m.building({ id: 'clothes', x: 33, y: 15, w: 5, h: 5, style: 'shop', label: 'Одяг', sign: 'shirt', roof: '#8a5ab5', action: { type: 'shop', shop: 'clothes' } });
  m.building({ id: 'flowers', x: 39, y: 15, w: 5, h: 5, style: 'shop', label: 'Квіти', sign: 'flower', wall: '#e8c4d0', action: { type: 'workplace', job: 'florist' }, zoneLabel: 'Квіти · флористка' });
  m.zone('flowerShop', 41, 20, 2, 1, { type: 'shop', shop: 'flowers' }, 'Купити квіти');
  m.building({ id: 'home2', x: 26, y: 23, w: 5, h: 4, style: 'shop', label: 'Дім і затишок', sign: 'sofa', wall: '#c9b08a', action: { type: 'shop', shop: 'home' } });
  m.building({ id: 'tech', x: 32, y: 23, w: 5, h: 4, style: 'shop', label: 'Техніка', sign: 'tv', wall: '#9aa4b0', action: { type: 'shop', shop: 'tech' } });
  m.building({ id: 'books', x: 38, y: 23, w: 3, h: 4, style: 'kiosk', label: 'Книгарня', sign: 'book', action: { type: 'shop', shop: 'books' } });
  m.building({ id: 'grocery', x: 42, y: 23, w: 3, h: 4, style: 'kiosk', label: 'Продукти', sign: 'bread', action: { type: 'shop', shop: 'grocery' } });
  m.fill(25, 27, 21, 1, 'p');
  m.prop('board', 29, 8).zone('jobs', 28, 9, 3, 1, { type: 'jobs' }, 'Дошка вакансій');
  m.building({ id: 'realtor', x: 35, y: 4, w: 5, h: 5, style: 'shop', label: 'Ріелтор', sign: 'key', wall: '#d8d2c6', action: { type: 'realtor' } });
  m.building({ id: 'block2', x: 40, y: 3, w: 5, h: 6, style: 'block', label: 'Вишенька', wall: '#e3d8c6' });
  // Набережна Бугу з фонтаном.
  m.fill(25, 28, 21, 2, 'c');
  m.fill(0, 31, 46, 3, 'w');
  m.fill(0, 30, 46, 1, 'p');
  m.prop('bigFountain', 32, 28.2);
  m.zone('fountain', 30, 28, 6, 2, { type: 'sight', sight: 'fountain' }, 'Фонтан на Бузі');
  m.zone('walkDate', 38, 28, 4, 2, { type: 'date' }, 'Прогулянка набережною');
  for (let x = 26; x < 46; x += 5) m.prop('lamp', x, 28.6, { solid: false });
  m.prop('bench', 27, 29).prop('bench', 42, 29).prop('boat', 8, 31.4).prop('duck', 14, 31.2);
  m.prop('car', 6, 10.2, { tint: '#3a6fd8' }).prop('car', 34, 10.8).prop('tram', 2, 33);
  for (const y of [15, 18, 22, 26]) m.tree(19, y, 'chestnut');
  m.tree(1, 2, 'poplar').tree(44, 13, 'chestnut').tree(15, 21, 'chestnut').tree(0, 28, 'oak');
  m.scatterTrees(0, 4, 15, 5, ['chestnut', 'oak', 'birch'], 0.45, 7);
  return m.build();
}

function kyiv(): GameMap {
  const m = new MapBuilder('kyiv', 'kyiv', 'м. Київ', 46, 32, 'g');
  m.folk = 14;
  m.fill(0, 0, 46, 2, 'r').fill(0, 2, 46, 2, 'p');
  m.building({ id: 'station', x: 2, y: 4, w: 12, h: 5, style: 'station', label: 'Київ-Пасажирський', wall: '#f2e8d0', action: { type: 'station' }, zoneLabel: 'Вокзал · квитки' });
  m.fill(0, 10, 46, 1, 'p').fill(0, 11, 46, 3, 'm').fill(0, 14, 46, 1, 'p');
  m.fill(7, 9, 2, 1, 'p');
  m.spawn('station', 8, 10).spawn('default', 8, 10);
  // Хрещатик: широкий тротуар, каштани.
  m.fill(0, 15, 46, 5, 'p');
  for (let x = 2; x < 46; x += 5) m.tree(x, 15, 'chestnut');
  for (let x = 4; x < 46; x += 5) m.prop('lamp', x, 19, { solid: false });
  m.zone('khreshchatyk', 18, 16, 6, 3, { type: 'sight', sight: 'khreshchatyk' }, 'Хрещатик');
  m.building({ id: 'studio', x: 16, y: 3, w: 8, h: 6, style: 'office', label: 'Студія дизайну', sign: 'pencil', action: { type: 'workplace', job: 'designer' } });
  m.building({ id: 'realtor', x: 26, y: 4, w: 5, h: 5, style: 'shop', label: 'Ріелтор', sign: 'key', action: { type: 'realtor' } });
  m.building({ id: 'tech', x: 32, y: 4, w: 6, h: 5, style: 'shop', label: 'Техніка', sign: 'tv', wall: '#9aa4b0', action: { type: 'shop', shop: 'tech' } });
  m.building({ id: 'home', x: 39, y: 2, w: 6, h: 7, style: 'block', label: 'Житло', action: homeZone, zoneLabel: 'Додому' });
  m.spawn('home', 42, 10);
  m.fill(0, 20, 46, 1, 'p');
  m.building({ id: 'clothes', x: 1, y: 21, w: 5, h: 4, style: 'shop', label: 'Одяг', sign: 'shirt', roof: '#3a3f58', action: { type: 'shop', shop: 'clothes' } });
  m.building({ id: 'home2', x: 7, y: 21, w: 5, h: 4, style: 'shop', label: 'Дім і затишок', sign: 'sofa', action: { type: 'shop', shop: 'home' } });
  m.building({ id: 'books', x: 13, y: 21, w: 4, h: 4, style: 'shop', label: 'Книгарня', sign: 'book', action: { type: 'shop', shop: 'books' } });
  m.building({ id: 'souv', x: 18, y: 21, w: 4, h: 4, style: 'kiosk', label: 'Сувеніри', sign: 'gift', action: { type: 'shop', shop: 'souvenirs' } });
  m.building({ id: 'cafe', x: 23, y: 21, w: 5, h: 4, style: 'cafe', label: 'Кав\'ярня', sign: 'cup', action: { type: 'shop', shop: 'cafe' } });
  m.building({ id: 'grocery', x: 29, y: 21, w: 4, h: 4, style: 'kiosk', label: 'Продукти', sign: 'bread', action: { type: 'shop', shop: 'grocery' } });
  m.fill(0, 25, 34, 2, 'p');
  m.prop('cafeTable', 24, 25.4, { solid: false }).zone('date', 26, 25, 3, 2, { type: 'date' }, 'Побачення в кав\'ярні');
  m.prop('board', 1, 26).zone('jobs', 2, 26, 2, 1, { type: 'jobs' }, 'Дошка вакансій');
  // Лавра на пагорбі.
  m.fill(34, 21, 12, 11, 'G');
  m.building({ id: 'lavra', x: 35, y: 23, w: 10, h: 5, style: 'lavra', label: 'Києво-Печерська лавра', action: { type: 'sight', sight: 'lavra' } });
  m.fill(40, 28, 1, 4, 'd');
  m.prop('tram', 10, 11.5).prop('car', 30, 12.5).prop('car', 38, 11.2, { tint: '#f6c14e' });
  m.scatterTrees(0, 27, 34, 5, ['chestnut', 'oak', 'birch'], 0.4, 8);
  m.scatterTrees(34, 28, 12, 4, ['pine', 'chestnut'], 0.4, 9);
  return m.build();
}

function lviv(): GameMap {
  const m = new MapBuilder('lviv', 'lviv', 'м. Львів', 40, 30, 'c');
  m.folk = 11;
  m.fill(0, 0, 40, 2, 'r').fill(0, 2, 40, 2, 'p');
  m.building({ id: 'station', x: 14, y: 4, w: 12, h: 5, style: 'station', label: 'Львівський вокзал', wall: '#f2dcc0', roof: '#5a6f8f', action: { type: 'station' }, zoneLabel: 'Вокзал · квитки' });
  m.spawn('station', 20, 10).spawn('default', 20, 10);
  // Площа Ринок і ратуша.
  m.building({ id: 'ratusha', x: 15, y: 13, w: 10, h: 5, style: 'ratusha', label: 'Ратуша', action: { type: 'sight', sight: 'ratusha' } });
  m.prop('fountain', 9, 15).prop('fountain', 27, 15);
  for (const x of [3, 9, 31, 36]) m.prop('lamp', x, 11, { solid: false });
  m.building({ id: 'choco', x: 1, y: 4, w: 6, h: 5, style: 'shop', label: 'Шоколадна майстерня', sign: 'cake', wall: '#8a5a34', roof: '#5a3a24', action: { type: 'sight', sight: 'chocolate' } });
  m.building({ id: 'bakery', x: 8, y: 4, w: 5, h: 5, style: 'shop', label: 'Пекарня', sign: 'bread', wall: '#e8c49a', action: { type: 'workplace', job: 'baker' } });
  m.building({ id: 'cafe', x: 27, y: 4, w: 5, h: 5, style: 'cafe', label: 'Кав\'ярня', sign: 'cup', action: { type: 'shop', shop: 'cafe' } });
  m.building({ id: 'souv', x: 33, y: 4, w: 6, h: 5, style: 'shop', label: 'Сувеніри', sign: 'gift', wall: '#d8b06a', action: { type: 'shop', shop: 'souvenirs' } });
  m.prop('cafeTable', 28, 9.6, { solid: false }).zone('date', 30, 9, 2, 2, { type: 'date' }, 'Побачення в кав\'ярні');
  m.building({ id: 'clothes', x: 1, y: 21, w: 5, h: 5, style: 'shop', label: 'Одяг', sign: 'shirt', wall: '#c4a0b8', action: { type: 'shop', shop: 'clothes' } });
  m.building({ id: 'books', x: 7, y: 21, w: 5, h: 5, style: 'shop', label: 'Книгарня', sign: 'book', wall: '#9ab0a0', action: { type: 'shop', shop: 'books' } });
  m.building({ id: 'grocery', x: 13, y: 21, w: 4, h: 5, style: 'shop', label: 'Продукти', sign: 'bread', wall: '#e3d8a8', action: { type: 'shop', shop: 'grocery' } });
  m.building({ id: 'realtor', x: 25, y: 21, w: 5, h: 5, style: 'shop', label: 'Ріелтор', sign: 'key', wall: '#b8c4d0', action: { type: 'realtor' } });
  m.building({ id: 'home', x: 31, y: 20, w: 8, h: 6, style: 'house', label: 'Житло', wall: '#e8d0b0', roof: '#a8483a', action: homeZone, zoneLabel: 'Додому' });
  m.spawn('home', 35, 27);
  m.prop('board', 19, 21).zone('jobs', 18, 22, 3, 1, { type: 'jobs' }, 'Дошка вакансій');
  m.fill(0, 27, 40, 3, 'g');
  m.scatterTrees(0, 27, 40, 3, ['chestnut', 'oak', 'birch'], 0.5, 10);
  m.prop('planter', 13, 11).prop('planter', 26, 11).prop('bench', 5, 18).prop('bench', 33, 18).prop('cat', 22, 19.4, { tint: '#3a3a40' });
  return m.build();
}

function odesa(): GameMap {
  const m = new MapBuilder('odesa', 'odesa', 'м. Одеса · Отрада', 46, 36, 'g');
  m.folk = 12;
  m.fill(0, 0, 46, 2, 'r').fill(0, 2, 46, 2, 'p');
  m.building({ id: 'station', x: 17, y: 4, w: 12, h: 5, style: 'station', label: 'Одеса-Головна', wall: '#f4ecd8', roof: '#3f8a6a', action: { type: 'station' }, zoneLabel: 'Вокзал · квитки' });
  m.spawn('station', 23, 10).spawn('default', 23, 10);
  m.fill(0, 10, 46, 1, 'p').fill(0, 11, 46, 3, 'm').fill(0, 14, 46, 1, 'p');
  m.building({ id: 'souv', x: 2, y: 4, w: 5, h: 5, style: 'shop', label: 'Сувеніри', sign: 'gift', wall: '#e8d8a8', action: { type: 'shop', shop: 'souvenirs' } });
  m.building({ id: 'clothes', x: 8, y: 4, w: 5, h: 5, style: 'shop', label: 'Одяг', sign: 'shirt', wall: '#a8d0e0', action: { type: 'shop', shop: 'clothes' } });
  m.building({ id: 'grocery', x: 31, y: 5, w: 4, h: 4, style: 'kiosk', label: 'Продукти', sign: 'bread', action: { type: 'shop', shop: 'grocery' } });
  m.building({ id: 'flowers', x: 36, y: 5, w: 4, h: 4, style: 'kiosk', label: 'Квіти', sign: 'flower', action: { type: 'shop', shop: 'flowers' } });
  m.building({ id: 'realtor', x: 41, y: 4, w: 4, h: 5, style: 'shop', label: 'Ріелтор', sign: 'key', action: { type: 'realtor' } });
  m.fill(0, 15, 46, 4, 'g');
  m.building({ id: 'home', x: 1, y: 15, w: 7, h: 4, style: 'house', label: 'Житло', wall: '#f4e8c8', roof: '#c96a4c', action: homeZone, zoneLabel: 'Додому' });
  m.spawn('home', 4, 20);
  m.building({ id: 'cafe', x: 30, y: 15, w: 6, h: 4, style: 'cafe', label: 'Кафе біля моря', sign: 'cup', wall: '#f4f4f7', action: { type: 'shop', shop: 'cafe' } });
  m.building({ id: 'tour', x: 38, y: 15, w: 5, h: 4, style: 'kiosk', label: 'Екскурсії', sign: 'star', action: { type: 'workplace', job: 'guide' } });
  m.prop('board', 12, 16.5).zone('jobs', 13, 17, 2, 1, { type: 'jobs' }, 'Дошка вакансій');
  m.prop('cafeTable', 28, 19.2, { solid: false }).zone('date', 27, 19, 3, 2, { type: 'date' }, 'Вечеря біля моря');
  // Сходи вниз на пляж Отрада.
  m.fill(0, 19, 46, 1, 'p');
  m.prop('stairs', 20, 19.3);
  m.fill(0, 20, 46, 7, 's').fill(0, 27, 46, 2, 'b').fill(0, 29, 46, 7, 'w');
  m.zone('otrada', 16, 23, 6, 3, { type: 'sight', sight: 'otrada' }, 'Пляж Отрада');
  m.prop('yellowStone', 34, 23.4);
  m.zone('stone', 33, 25, 4, 2, { type: 'stone' }, 'Жовтий камінь');
  for (const [x, y, c] of [[6, 22, '#ff5d8f'], [11, 24, '#5aa7e0'], [26, 22, '#f6c14e'], [40, 24, '#7ed957']] as const) {
    m.prop('umbrella', x, y, { tint: c }).prop('lounger', x + 1, y + 1, { tint: c });
  }
  m.prop('pier', 2, 28.6).prop('boat', 9, 30.5).prop('boat', 28, 32).prop('lighthouse', 43, 26.5);
  m.prop('gull', 10, 24).prop('gull', 30, 21).prop('gull', 20, 28);
  for (let x = 1; x < 46; x += 6) m.prop('lamp', x, 18.6, { solid: false });
  m.tree(15, 16, 'poplar').tree(24, 16, 'chestnut').tree(44, 16, 'poplar');
  return m.build();
}

const BUILDERS: Record<CityId, () => GameMap> = { zhylyntsi, pravdivka, khmelnytskyi, vinnytsia, kyiv, lviv, odesa };
const built = new Map<CityId, GameMap>();

export function cityMap(city: CityId): GameMap {
  const hit = built.get(city);
  if (hit) return hit;
  const map = BUILDERS[city]();
  built.set(city, map);
  return map;
}

export const ALL_CITY_IDS = Object.keys(BUILDERS) as CityId[];
