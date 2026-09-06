// ============================================================
// Зерно каменю печери — процедурне, сіре, з кварцовими блискітками.
// ------------------------------------------------------------
// НАВІЩО ТЕКСТУРА ТУТ І ЧОМУ ЇЇ НЕМА НА КРИСТАЛІ. `amore-crystal-look`
// проводить цю межу прямо: карта поверхні на ВИРОЩЕНІЙ грані читається
// шкірою й перебігає через ребро, кажучи оку, що дві площини — одна
// поверхня; тому з кристала карти зняли, і знімати їх назад не можна.
// Битий камінь — випадок протилежний: у нього вирощених граней немає, і
// «зерно — це більша частина того, що відрізняє камінь від пластику».
//
// ЩО ЦЕ МАЄ ПОЛАГОДИТИ, І ЦЕ ВИМІРЯНО. Знімок одинадцятирічної пари,
// середня яскравість по десяти горизонтальних смугах:
//
//   стіна   смуги 0–2: 44–50, увесь діапазон 39–61 з 255
//   підлога смуги 8–9: 32 і 19,  діапазон 18–28
//
// Тобто стіна вкладалась у дев'ять відсотків шкали, а підлога — у
// чотири. Розкид граней там БУВ (вершинний колір його кладе), але на
// рівні 18 дев'ять відсотків це півтора рівня — нижче за поріг
// видимості. Камінь читався аркушем не тому, що йому бракувало граней, а
// тому, що на ньому не було ЖОДНОЇ деталі дрібнішої за грань.
//
// СІРА НАВМИСНО. Карта множить колір матеріалу, тож кольорова карта
// пофарбувала б печеру своїм тоном і стерла палітру теми — та сама
// причина, з якої знебарвлено альбедо кристала.
//
// ОДНА НА ОБИДВІ ТЕМИ. Вона несе лише яскравість; тон дає палітра.
// ============================================================
import * as THREE from 'three';

/** Сторона полотна. 256 вистачає: візерунок безмасштабний і плитковий. */
const SIZE = 256;

/**
 * Найтемніша й найсвітліша точки зерна.
 *
 * Карта може лише ЗАТЕМНЮВАТИ (текстура не буває яскравіша за одиницю),
 * тож світлий кінець стоїть на одиниці, а середина падає на 0.86 — і
 * рівно на стільки ж підняті самі відтінки в `portalCave.ts`. Інакше
 * зерно не додало б деталі, а просто пригасило б печеру.
 */
const GRAIN_LOW = 0.62;
const GRAIN_HIGH = 1;

/** Скільки кварцових блискіток на полотно. */
const FLECKS = 150;

/** Детермінований хеш ґратки. Той самий прийом, що в текстурах дерева. */
function hash2(x: number, y: number, salt: number): number {
  const n = Math.sin(x * 127.1 + y * 311.7 + salt * 74.7) * 43758.5453123;
  return n - Math.floor(n);
}

/**
 * Плиткований шум значень.
 *
 * Ґратка береться ПО МОДУЛЮ `cells`, тож правий край дорівнює лівому й
 * шва на стику плиток немає. Без цього стіна дістала б вертикальну
 * смугу на кожному повороті розгортки.
 */
function tileNoise(u: number, v: number, cells: number, salt: number): number {
  const x = u * cells;
  const y = v * cells;
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const at = (ix: number, iy: number): number => hash2(
    ((ix % cells) + cells) % cells,
    ((iy % cells) + cells) % cells,
    salt,
  );
  const top = at(x0, y0) + (at(x0 + 1, y0) - at(x0, y0)) * sx;
  const bottom = at(x0, y0 + 1) + (at(x0 + 1, y0 + 1) - at(x0, y0 + 1)) * sx;
  return top + (bottom - top) * sy;
}

let cached: THREE.CanvasTexture | null = null;

/**
 * Зерно каменю. Одне полотно на весь застосунок.
 *
 * Повертає null там, де немає DOM: полотно — ресурс браузера, і чесніше
 * віддати нічого, ніж підсунути заглушку. Тести перевіряють саму функцію
 * зерна, а не її завантаження.
 */
export function caveRockTexture(): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  if (cached !== null) return cached;

  const el = document.createElement('canvas');
  el.width = SIZE;
  el.height = SIZE;
  const context = el.getContext('2d');
  if (context === null) return null;

  const image = context.createImageData(SIZE, SIZE);
  for (let y = 0; y < SIZE; y += 1) {
    for (let x = 0; x < SIZE; x += 1) {
      const u = x / SIZE;
      const v = y / SIZE;
      /*
       * Три октави, і кожна робить своє. Велика — плями породи впоперек
       * кількох граней: саме її бракувало, бо вершинний колір не може
       * бути більшим за грань. Середня — тріщинуватість. Дрібна — зерно,
       * яке й відрізняє камінь від пластику.
       */
      const value = caveGrainAt(u, v);
      const level = Math.round(value * 255);
      const index = (y * SIZE + x) * 4;
      image.data[index] = level;
      image.data[index + 1] = level;
      image.data[index + 2] = level;
      image.data[index + 3] = 255;
    }
  }
  context.putImageData(image, 0, 0);

  /*
   * Блискітки кладуться ПІСЛЯ зерна й поверх нього: це вкраплення кварцу
   * в породі, тобто те, що робить печеру кристальною, а не просто
   * кам'яною. Вони не світяться — вони світліші за камінь навколо, а
   * карта може лише затемнювати, тож «яскраво» тут означає «одиниця».
   */
  for (let index = 0; index < FLECKS; index += 1) {
    const x = Math.floor(hash2(index, 1, 17) * SIZE);
    const y = Math.floor(hash2(index, 2, 23) * SIZE);
    const size = 1 + Math.floor(hash2(index, 3, 31) * 2);
    context.fillStyle = `rgba(255,255,255,${0.55 + hash2(index, 4, 37) * 0.45})`;
    context.fillRect(x, y, size, size);
  }

  const texture = new THREE.CanvasTexture(el);
  /*
   * ЛІНІЙНИЙ ПРОСТІР, БО ЦЕ МНОЖНИК, А НЕ КОЛІР.
   *
   * Карта не каже, якого камінь тону, — вона каже, наскільки він темніший
   * у цій точці. Так само позначають карти шорсткості й затінення.
   *
   * Чесно про вимір: проти `SRGBColorSpace` кадр не змінився ані на
   * рівень на жодній із десяти смуг. Тобто вибір тут стоїть на ЗНАЧЕННІ,
   * а не на виміряній різниці, і писати сюди пояснення про подвійне
   * перетворення я не став — воно не підтвердилось.
   *
   * Що виміряно насправді: зерно коштує стіні ×0.687 яскравості (40.2 з
   * пласко-білою картою проти 27.6 із зерном). Палітра каменю піднята
   * рівно на цю ціну.
   */
  texture.colorSpace = THREE.NoColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  cached = texture;
  return texture;
}

/**
 * Саме зерно, у частках яскравості — окремо від полотна, щоб його можна
 * було перевірити там, де браузера немає.
 */
export function caveGrainAt(u: number, v: number): number {
  const blotch = tileNoise(u, v, 4, 3);
  const crack = tileNoise(u, v, 13, 11);
  const grit = tileNoise(u, v, 37, 19);
  const mixed = blotch * 0.52 + crack * 0.31 + grit * 0.17;
  return GRAIN_LOW + (GRAIN_HIGH - GRAIN_LOW) * Math.min(1, Math.max(0, mixed));
}

/** Тестовий шов: скидає полотно, щоб набір починав із нуля. */
export function disposeCaveRockTexture(): void {
  cached?.dispose();
  cached = null;
}
