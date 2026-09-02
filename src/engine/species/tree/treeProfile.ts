// ============================================================
// Силует дерева числами — одна мірка на еталон і на генератор.
// ------------------------------------------------------------
// НАВІЩО. Кожна скарга власника на дерево — «замале», «більше на кущ
// схоже», «ширина крони гуляє» — упиралась у те, що порівнювати не було з
// чим: еталоном були КАРТИНКИ (п'ять моделей, розібраних у
// `amore-tree-look` на прозу). З прози не дістати ні висоти, на якій
// крона найширша, ні того, скільки стовбура видно до першої гілки.
//
// Тепер еталон — геометрія (`scripts/models/reference-tree.py`), і ця
// функція міряє ОБИДВА боки. Саме «обидва» тут головне: дві різні мірки
// дали б числа, які не можна класти поруч, а це той рід помилки, який у
// цьому проєкті вже коштував хибних висновків двічі.
//
// ЧОМУ ЧАСТКАМИ ВИСОТИ, А НЕ В ОДИНИЦЯХ. Еталон живе в метрах (12 м),
// дерево пари — в одиницях сцени (2.7). Безрозмірний профіль дозволяє
// порівнювати їх без жодного переведення, і саме він відповідає на
// питання «якої дерево ФОРМИ», відокремлене від «якого воно розміру».
// ============================================================

export interface TreeProfile {
  /** Повна висота в тих одиницях, у яких прийшли вершини. */
  height: number;
  /** Найнижча точка — щоб знати, звідки рахувались частки. */
  minY: number;
  /**
   * Радіус силуету по смугах висоти, знизу вгору, ЧАСТКАМИ ВИСОТИ.
   *
   * Максимум, а не середнє: силует — це те, що видно з боку, і одна гілка,
   * яка вилетіла вбік, у ньому є, хоч би скільки порожнечі було поруч.
   */
  bands: number[];
  /** Найбільший радіус, часткою висоти. */
  spread: number;
  /** На якій частці висоти стоїть найширше місце. */
  widestAt: number;
  /**
   * Частка висоти, на якій силует уперше стає ВТРИЧІ ширшим за комель.
   *
   * Це і є «скільки стовбура видно» — межа між чистим стовбуром і кроною.
   * Утричі, а не вдвічі: комель сам по собі товщий за стовбур
   * (`ROOT_FLARE`), і вдвічі спрацьовувало б на самому потовщенні.
   */
  clearBole: number;
  /** Радіус у найнижчій смузі, часткою висоти. */
  baseRadius: number;
  /**
   * Висота центру маси крони, часткою висоти.
   *
   * Зважено за КВАДРАТОМ радіуса смуги, а не за кількістю вершин: у
   * нашому меші стовбур має щільні кільця, а листя — розріджені картки,
   * тож вершинна вага сказала б більше про спосіб побудови, ніж про
   * форму. Квадрат радіуса — це переріз смуги, тобто її внесок в об'єм.
   */
  centroidAt: number;
}

/** Скільки смуг ділять висоту. Двадцять — крок у 5% зросту. */
export const TREE_PROFILE_BANDS = 20;

const CLEAR_BOLE_FACTOR = 3;

/**
 * Профіль силуету з голого масиву позицій `[x, y, z, x, y, z, …]`.
 *
 * Вісь Y — угору, радіус — відстань від осі стовбура. Та сама угода, що в
 * `measureThreeTreeReach` і в експорті glTF (`export_yup`), тож еталон і
 * дерево пари читаються без жодного повороту.
 */
export function treeSilhouetteProfile(
  positions: ArrayLike<number>,
  bandCount: number = TREE_PROFILE_BANDS,
): TreeProfile {
  const bands = Math.max(1, Math.floor(bandCount));
  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (let offset = 0; offset + 2 < positions.length; offset += 3) {
    const y = positions[offset + 1] ?? 0;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  if (!Number.isFinite(minY) || !Number.isFinite(maxY) || maxY <= minY) {
    return {
      height: 0,
      minY: Number.isFinite(minY) ? minY : 0,
      bands: new Array<number>(bands).fill(0),
      spread: 0,
      widestAt: 0,
      clearBole: 0,
      baseRadius: 0,
      centroidAt: 0,
    };
  }

  const height = maxY - minY;
  const radii = new Array<number>(bands).fill(0);
  for (let offset = 0; offset + 2 < positions.length; offset += 3) {
    const x = positions[offset] ?? 0;
    const y = positions[offset + 1] ?? 0;
    const z = positions[offset + 2] ?? 0;
    const share = (y - minY) / height;
    // Верхня вершина належить останній смузі, а не вигаданій наступній.
    const band = Math.min(bands - 1, Math.floor(share * bands));
    const radial = Math.hypot(x, z);
    if (radial > radii[band]!) radii[band] = radial;
  }

  const normalised = radii.map((radius) => radius / height);
  let spread = 0;
  let widestBand = 0;
  for (let band = 0; band < bands; band += 1) {
    if (normalised[band]! > spread) { spread = normalised[band]!; widestBand = band; }
  }
  const baseRadius = normalised[0]!;

  let clearBoleBand = bands - 1;
  for (let band = 0; band < bands; band += 1) {
    if (normalised[band]! > baseRadius * CLEAR_BOLE_FACTOR) { clearBoleBand = band; break; }
  }

  let weighted = 0;
  let weight = 0;
  for (let band = 0; band < bands; band += 1) {
    const area = normalised[band]! * normalised[band]!;
    weighted += area * ((band + 0.5) / bands);
    weight += area;
  }

  return {
    height,
    minY,
    bands: normalised,
    spread,
    widestAt: (widestBand + 0.5) / bands,
    clearBole: (clearBoleBand + 0.5) / bands,
    baseRadius,
    centroidAt: weight > 0 ? weighted / weight : 0,
  };
}

/**
 * Наскільки два силуети різні — одне число.
 *
 * Середня різниця нормованих радіусів по смугах, поділена на ширину
 * еталона. Нуль — форми збігаються; 0.2 означає, що в середньому наш
 * радіус розходиться з еталонним на п'яту частину його ширини.
 *
 * Середня, а не найбільша: одна смуга біля самої землі, де в еталона
 * комель, а в нас коріння, інакше вирішувала б усе число.
 */
export function treeProfileDistance(reference: TreeProfile, actual: TreeProfile): number {
  const bands = Math.min(reference.bands.length, actual.bands.length);
  if (bands === 0 || reference.spread <= 0) return 0;
  let total = 0;
  for (let band = 0; band < bands; band += 1) {
    total += Math.abs(reference.bands[band]! - actual.bands[band]!);
  }
  return total / bands / reference.spread;
}
