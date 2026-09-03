// ============================================================
// Сцена кристала: кадр камери й вартість оточення.
// ------------------------------------------------------------
// ЩО ЗВІДСИ ПІШЛО. Вісімсот рядків перевірок храму: підлога, подіум,
// ритуальна плита з тріщинами, руни, інкрустація, вісімнадцять колон,
// арки, чаші вогню й зоряне небо. Разом із самим храмом (ADR-0117).
//
// Тести мертвого коду не нейтральні: вони зелені, вони довгі, і вони
// переконують читача, що описана в них форма існує. Форма кристала тепер
// звіряється з еталоном (`crystalReference.test.ts`), а сцена — з
// `portalCave.test.ts`.
//
// Лишилось те, що пережило заміну світу: кадр камери — арифметика, яка
// вміщає артефакт будь-якого віку в будь-який екран, — і стеля вартості
// оточення, яку віднімає приймальний тест.
// ============================================================
import { describe, expect, it } from 'vitest';
import { CRYSTAL_GROUND_BASELINE } from '@/engine/renderer/three';
import {
  PORTAL_ENVIRONMENT_DRAW_CALLS,
  PORTAL_ENVIRONMENT_TRIANGLES,
  PORTAL_GROUND_Y,
  measurePortalEnvironmentTriangles,
  portalCameraFrame,
  portalHalfWidthAt,
} from './portalScene';

/** Аспекти реальних кадрів: вузький телефон, Pixel 8 Pro, планшет, ноутбук. */
const ASPECTS = [0.42, 0.46, 0.62, 0.75, 1.33, 1.9];

/**
 * Виміряно на справжньому пайплайні через `crystalSceneRadius` — в
 * одиницях сцени, тобто вже після fit-масштабу рендерера:
 *
 * | вік | кристали | камінь | висота |
 * |---|---:|---:|---:|
 * | 1 рік | 0.88 | 1.26 | 1.91 |
 * | 4 роки | 1.00 | 1.49 | 2.50 |
 * | 10 років | 1.42 | 2.39 | 3.19 |
 * | 20 років | 1.50 | 2.50 | 2.71 |
 *
 * Попередні константи (радіус 0.68) були зняті ще до ADR-0004 і
 * занижували ширину друзи більш ніж удвічі, тож перевірка «артефакт
 * влазить у кадр» проходила на числі, якого артефакт ніколи не мав.
 *
 * Кадр мусить вміщати кристали. Камінь і подіум — підлога: їм дозволено
 * виходити за край, і саме тому в таблиці два різні радіуси.
 */
const WIDEST_CRYSTAL_RADIUS = 1.5;
const TALLEST_ARTIFACT_HEIGHT = 3.19;

/**
 * Пари з таблиці вище як (радіус, висота).
 *
 * Кадр більше не сталий: із ADR-0018 він виводиться з висоти артефакта, тож
 * питання «чи вміщається артефакт» має сенс лише для кадру, побудованого під
 * **цей самий** артефакт. Тест, що будував кадр без висоти й перевіряв ним
 * найвищий кристал, питав про два різні об'єкти.
 */
const AGES: readonly (readonly [number, number])[] = [
  [0.88, 1.91],
  [1.00, 2.50],
  [1.42, 3.19],
  [WIDEST_CRYSTAL_RADIUS, 2.71],
];

describe('portal camera frame', () => {
  it('stands on the same plane the renderer puts the artifact on', () => {
    // Подіум узгоджений із fit-трансформом рендерера через один експорт.
    // Розійдуться — і кристал або зависне над каменем, або втопиться в ньому.
    expect(PORTAL_GROUND_Y).toBe(CRYSTAL_GROUND_BASELINE);
  });

  it('keeps every crystal inside the frame at every real aspect and age', () => {
    for (const aspect of ASPECTS) {
      for (const [radius, height] of AGES) {
        const frame = portalCameraFrame(aspect, radius, height);
        expect(portalHalfWidthAt(frame.distance, aspect)).toBeGreaterThan(radius);
      }
    }
  });

  it('only ever backs the camera off as the artifact grows', () => {
    // Якби більший артефакт міг *наблизити* камеру, зростання читалось би
    // задом наперед. Перевіряється і по ширині, і по висоті, бо з ADR-0018
    // кадр веде висота, а ширина рятує вузькі екрани.
    for (const aspect of ASPECTS) {
      let previous = 0;
      for (const radius of [0, 0.5, 0.88, 1.0, 1.42, 1.5, 3]) {
        const distance = portalCameraFrame(aspect, radius, 1.2).distance;
        expect(distance).toBeGreaterThanOrEqual(previous - 1e-9);
        previous = distance;
      }
      previous = 0;
      for (const height of [0.6, 1.2, 1.9, 2.5, 3.19, 4]) {
        const distance = portalCameraFrame(aspect, 0.9, height).distance;
        expect(distance).toBeGreaterThanOrEqual(previous - 1e-9);
        previous = distance;
      }
    }
  });

  it('zooms in on a young crystal and pulls back from a grown one (ADR-0018)', () => {
    // Нова система відображення, яку попросив власник. Дві вимоги одночасно, і
    // вони тягнуть у різні боки: молодий кристал має заповнювати екран як
    // головний артефакт, а дорослий — показувати залу за собою й **усе одно**
    // бути більшим на екрані.
    // Виміряно на справжньому пайплайні (радіус, висота) в одиницях сцени.
    const MEASURED: readonly (readonly [number, number])[] = [
      [0.36, 0.82], [0.52, 0.97], [0.58, 1.21],
      [0.91, 1.77], [1.30, 2.54], [1.46, 2.79],
    ];
    const seen = (aspect: number, radius: number, height: number) => {
      const frame = portalCameraFrame(aspect, radius, height);
      const visible = frame.distance * Math.tan((frame.fov / 2) * (Math.PI / 180)) * 2;
      return { visible, share: height / visible };
    };

    for (const aspect of [0.46, 1.6]) {
      const young = seen(aspect, ...MEASURED[0]!);
      const grown = seen(aspect, ...MEASURED[MEASURED.length - 1]!);

      /*
       * Видимої сцени стає більше — це і є «відзумовується назад».
       *
       * **2.8× → 1.9×, і це навмисне послаблення (ADR-0064).** Дві
       * вимоги ADR-0018 тягнули в різні боки, і перша перемагала
       * настільки, що друга зникала: коли видима сцена росте так само
       * швидко, як кристал, його частка екрана лишається сталою. Це й
       * виміряли — за десять років вона мінялась на ОДИН пункт, тобто
       * трирічний кристал виглядав як десятирічний.
       *
       * Тепер висота кадру афінна, зала все одно відкривається (1.95×),
       * але повільніше за кристал — і саме тому вік видно.
       */
      expect(grown.visible, `${aspect}`).toBeGreaterThan(young.visible * 1.9);
      // А кристал при цьому не губиться — і тепер РОСТЕ, а не просто
      // тримається: частку за віком стереже `portalCameraAge.test.ts`.
      expect(grown.share, `${aspect}`).toBeGreaterThan(young.share);
      // І в будь-якому віці він лишається головним об'єктом кадру. До
      // ADR-0018 трирічна пара займала 23% висоти вертикального екрана.
      for (const [radius, height] of MEASURED) {
        expect(seen(aspect, radius, height).share, `${aspect} ${height}`)
          .toBeGreaterThan(0.38);
      }
    }
  });

  it('centres the artifact instead of aiming above its tip', () => {
    // Ціль була сталою 1.25 світової одиниці — вище за верхівку трирічного
    // кристала (1.18), тобто камера цілилась у порожнечу над ним.
    for (const height of [0.6, 1.18, 2.5, 3.25]) {
      const frame = portalCameraFrame(0.46, 0.9, height);
      const above = frame.target[1] - PORTAL_GROUND_Y;
      expect(above, `${height}`).toBeGreaterThan(height * 0.3);
      expect(above, `${height}`).toBeLessThan(height * 0.7);
    }
  });

  it('survives a degenerate artifact radius or height', () => {
    for (const radius of [Number.NaN, Number.POSITIVE_INFINITY, -5]) {
      const frame = portalCameraFrame(0.46, radius);
      expect(frame.position.every(Number.isFinite)).toBe(true);
      expect(frame.distance).toBe(portalCameraFrame(0.46).distance);
    }
    for (const height of [Number.NaN, Number.POSITIVE_INFINITY, -5, 0]) {
      const frame = portalCameraFrame(0.46, 0.9, height);
      expect(frame.position.every(Number.isFinite)).toBe(true);
      expect(frame.distance).toBe(portalCameraFrame(0.46, 0.9).distance);
    }
  });

  it('keeps the whole artifact inside the frame at every real aspect', () => {
    for (const aspect of ASPECTS) {
      const frame = portalCameraFrame(aspect, WIDEST_CRYSTAL_RADIUS, TALLEST_ARTIFACT_HEIGHT);
      const halfHeight = frame.distance * Math.tan((frame.fov / 2) * (Math.PI / 180));
      const halfWidth = portalHalfWidthAt(frame.distance, aspect);

      expect(halfWidth).toBeGreaterThan(WIDEST_CRYSTAL_RADIUS);
      // Артефакт стоїть на землі, тож по висоті його тримає не половина
      // кадру, а відрізок від нижнього краю до верхівки.
      const frameTop = frame.target[1] + halfHeight;
      expect(frameTop).toBeGreaterThan(PORTAL_GROUND_Y + TALLEST_ARTIFACT_HEIGHT);
      const frameBottom = frame.target[1] - halfHeight;
      expect(frameBottom).toBeLessThan(PORTAL_GROUND_Y);
    }
  });

  it('sizes the frame at the artifact’s near side, not at its axis', () => {
    // Виміряно проєкцією справжніх вершин через справжній кадр: до цієї
    // поправки двадцятирічна друза на широкому екрані виходила на 1% за
    // нижній край, а з пропорціями самоцвіта (видовженість 2.2 замість 4.8)
    // — **на 14%**, разом із юбкою й жилою. Причина ортографічна: передній
    // край друзи стоїть на `radius` ближче до камери, ніж вісь, на якій
    // сидить точка прицілу, тож проєктується більшим і нижчим.
    for (const height of [1.2, 2.5, 3.19]) {
      let previous = 0;
      for (const radius of [0, 0.5, 1, 1.6]) {
        const distance = portalCameraFrame(1.6, radius, height).distance;
        // Ширший артефакт відсуває камеру навіть тоді, коли кадр тримає
        // висота — саме цього й бракувало.
        expect(distance, `${height} / ${radius}`).toBeGreaterThan(previous);
        previous = distance;
      }
      // І рівно на радіус, коли ширина не є обмеженням.
      const slim = portalCameraFrame(1.6, 0, height).distance;
      const wide = portalCameraFrame(1.6, 0.5, height).distance;
      expect(wide - slim, `${height}`).toBeCloseTo(0.5, 6);
    }

    // Ширина такої поправки не отримує: тіла, що задають горизонтальний
    // розмір, стоять збоку від осі, на майже тій самій глибині.
    const narrowScreen = portalCameraFrame(0.42, 1.5, 1.2);
    expect(narrowScreen.distance).toBeCloseTo(
      (1.5 * 2 * 1.08) / (2 * Math.tan((42 / 2) * (Math.PI / 180)) * 0.42),
      6,
    );
  });

  it('backs off on narrow screens instead of cropping the scene', () => {
    // Кадр по висоті задає артефакт; ширину рятує тільки відхід камери.
    const narrow = portalCameraFrame(0.4, 1.2, 2.5);
    const wide = portalCameraFrame(1.6, 1.2, 2.5);
    expect(narrow.distance).toBeGreaterThan(wide.distance);
  });

  it('looks down at the platform rather than along it', () => {
    const frame = portalCameraFrame(0.46);
    const elevation = frame.position[1] - PORTAL_GROUND_Y;
    expect(elevation).toBeGreaterThan(0);
    const grazing = Math.atan(elevation / frame.position[2]) * (180 / Math.PI);
    // Надто полого — підлога вироджується в лінію; надто згори — сцена
    // перетворюється на макет, у якому не видно ні неба, ні колон.
    expect(grazing).toBeGreaterThan(10);
    expect(grazing).toBeLessThan(28);
  });

  it('survives a degenerate aspect without producing a broken camera', () => {
    for (const aspect of [0, Number.NaN, Number.POSITIVE_INFINITY, -3]) {
      const frame = portalCameraFrame(aspect);
      expect(frame.position.every(Number.isFinite)).toBe(true);
      expect(Number.isFinite(frame.distance)).toBe(true);
      expect(frame.distance).toBeGreaterThan(0);
    }
  });

  it('starts fog behind the artifact, not on it', () => {
    for (const aspect of ASPECTS) {
      const frame = portalCameraFrame(aspect);
      expect(frame.fogNear).toBeGreaterThan(frame.distance - WIDEST_CRYSTAL_RADIUS * 2);
      expect(frame.fogFar).toBeGreaterThan(frame.fogNear);
    }
  });
});

describe('portal environment cost', () => {
  it('accounts for every object the environment draws', () => {
    // Печера малює рівно чотири: камінь стін, підлогу, диск розлому й
    // друзу. Було тринадцять — храм, колонада, декор і небо.
    expect(PORTAL_ENVIRONMENT_DRAW_CALLS).toBe(4);
  });

  it('лишається під стелею для КОЖНОЇ пари й на кожному профілі', () => {
    /*
     * Тут стояло «коштує однаково для кожної пари», і для храму це була
     * правда: насіння зсувало вершини, але не додавало трикутників.
     *
     * Печера (ADR-0117) так не влаштована: у кущі друзи від трьох до
     * шести кристалів, і скільки саме — вирішує насіння пари. Тобто
     * рівності більше не існує, і вдавати її означало б або прибити
     * випадкове число однієї пари, або відмовитись від друзи.
     *
     * Стереже те саме: сцена не має права тихо роздутись понад стелю,
     * яку віднімає приймальний тест.
     */
    const qualities = ['high', 'balanced', 'low', 'fallback'] as const;
    for (const seed of [1, 77, 4242, 999_999]) {
      for (const quality of qualities) {
        const cost = measurePortalEnvironmentTriangles(seed, quality);
        expect(cost, `${seed}/${quality}`).toBeLessThanOrEqual(PORTAL_ENVIRONMENT_TRIANGLES);
        expect(cost).toBeGreaterThan(0);
      }
    }
  });

  it('стеля не задерта: реальна вартість близька до неї, а не вдесятеро менша', () => {
    /*
     * Стеля, яку ніхто не дістає, — не межа, а дозвіл. Виміряно 5 308
     * трикутників на найдорожчому профілі при стелі 6 000, тобто запас
     * 12%. Якщо колись стане вдвічі менше — стеля мусить опуститись
     * разом із вартістю, інакше вона перестане щось стерегти.
     */
    const cost = measurePortalEnvironmentTriangles(1, 'high');
    expect(cost).toBeLessThanOrEqual(PORTAL_ENVIRONMENT_TRIANGLES);
    expect(cost).toBeGreaterThan(PORTAL_ENVIRONMENT_TRIANGLES * 0.7);
  });
});
