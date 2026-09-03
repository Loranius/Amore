// ============================================================
// Силует кристала числами — одна мірка на еталон і на генератор.
// ------------------------------------------------------------
// НАВІЩО. Запит власника — «щоб виглядав як справжній кристал, що росте
// з жеоди в кристальній печері» — доти не мав із чим звірятись: еталоном
// була ПРОЗА (`amore-crystal-look` розібрав сім присланих моделей на
// слова). Проза не каже, скільки кристала стоїть НАД породою, і саме це
// число вирішує, читається він таким, що виліз, чи таким, що поставлений.
//
// Тепер еталон — геометрія (`scripts/models/reference-crystal.py`), і ця
// функція міряє ОБИДВА боки. «Обидва» тут головне: дві різні мірки дали б
// числа, які не можна класти поруч, а ця помилка в проєкті вже коштувала
// хибних висновків двічі.
//
// ЧОМУ ЧАСТКАМИ, А НЕ В ОДИНИЦЯХ. Еталон живе в сантиметрах (24 см),
// кристал пари — в одиницях сцени, і росте з роками. Безрозмірний профіль
// відповідає на питання «якої кристал ФОРМИ», відокремлене від «якого він
// розміру», — а формою власник і незадоволений.
//
// ЩО ЦЕ НЕ МІРЯЄ. Розділення сусідніх граней (30% і 10% з
// `amore-crystal-look`) знімається пікселями з живої сцени, а не з
// вершин: воно про світло, а не про форму. Ці дві мірки доповнюють одна
// одну й жодного разу не заміняють.
// ============================================================

export interface CrystalProfile {
  /** Повна висота в тих одиницях, у яких прийшли вершини. */
  height: number;
  /** Найнижча точка — щоб знати, звідки рахувались частки. */
  minY: number;
  /** Вісь тіла в площині XZ: центр ваги вершин по горизонталі. */
  axis: { x: number; z: number };
  /**
   * Радіус силуету по смугах висоти, знизу вгору, ЧАСТКАМИ ВИСОТИ.
   *
   * Максимум, а не середнє: силует — це те, що видно збоку.
   */
  bands: number[];
  /** Найбільший радіус, часткою висоти. */
  radius: number;
  /** На якій частці висоти стоїть найширше місце. */
  widestAt: number;
  /**
   * Стрункість: висота, поділена на ширину.
   *
   * Ширина — діаметр описаного кола, тобто те, що займає кристал у кадрі.
   * Кварц у друзі дає 2.5–5; нижче двох виходить кабанчик, вище шести —
   * голка, яка на екрані читається шпилем.
   */
  aspect: number;
  /**
   * Частка висоти, на якій призма переходить у головку («плече»).
   *
   * Верхня межа найвищої смуги, що ще тримає майже повну ширину. Це і є
   * межа між боковими гранями й ромбоедричними: у кварцу вона стоїть
   * високо (0.83 в еталона), бо головка коротка. Низьке плече означає
   * довгий конус — тобто шпиль, а не кристал.
   */
  shoulderAt: number;
  /**
   * Нерівність граней призми: найбільший радіус кута, поділений на
   * найменший, у найгустішому кільці вершин нижче плеча.
   *
   * Вирослий кристал має грані РІЗНОЇ ширини, виточений — однакової.
   * Кільце шукається кластеруванням вершин по висоті, а не «смуга номер
   * стільки-то»: у призми вершини стоять лише на кількох рівнях, і смуга,
   * обрана наперед, здебільшого порожня — перша редакція саме через це
   * друкувала рівно 1.000 на всіх тілах і на еталоні теж.
   */
  cornerSpread: number;
}

/** Скільки смуг ділять висоту. Двадцять — крок у 5% висоти. */
export const CRYSTAL_PROFILE_BANDS = 20;

/**
 * Частка найбільшої ширини, нижче якої смуга вже не вважається призмою.
 *
 * 0.92, а не 1.0: грані призми нерівні, тож навіть у чистій призмі
 * сусідні смуги різняться на кілька відсотків.
 */
const SHOULDER_SHARE = 0.92;

interface Bounds {
  minY: number;
  maxY: number;
  axisX: number;
  axisZ: number;
  count: number;
}

function boundsOf(positions: ArrayLike<number>): Bounds {
  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  let sumX = 0;
  let sumZ = 0;
  let count = 0;
  for (let offset = 0; offset + 2 < positions.length; offset += 3) {
    const y = positions[offset + 1] ?? 0;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
    sumX += positions[offset] ?? 0;
    sumZ += positions[offset + 2] ?? 0;
    count += 1;
  }
  return {
    minY, maxY, count,
    axisX: count > 0 ? sumX / count : 0,
    axisZ: count > 0 ? sumZ / count : 0,
  };
}

const EMPTY: CrystalProfile = {
  height: 0,
  minY: 0,
  axis: { x: 0, z: 0 },
  bands: [],
  radius: 0,
  widestAt: 0,
  aspect: 0,
  shoulderAt: 0,
  cornerSpread: 1,
};

/**
 * Профіль силуету з голого масиву позицій `[x, y, z, x, y, z, …]`.
 *
 * Вісь Y — угору, радіус — відстань від власної осі тіла. Та сама угода,
 * що в експорті glTF (`export_yup`) і в `treeSilhouetteProfile`, тож
 * еталон і кристал пари читаються без жодного повороту.
 *
 * ВІСЬ — ЦЕНТР ВАГИ ПО ГОРИЗОНТАЛІ, а не нуль сцени. Кристал пари живе в
 * спільному кадрі композиції й стоїть не в нулі; брати нуль означало б
 * приписати монархові радіус, який насправді є його зсувом.
 */
export function crystalSilhouetteProfile(
  positions: ArrayLike<number>,
  bandCount: number = CRYSTAL_PROFILE_BANDS,
): CrystalProfile {
  if (positions.length % 9 !== 0) {
    throw new Error('Мірка кристала ходить по трикутниках — дев\'ять чисел на трикутник.');
  }
  const bands = Math.max(1, Math.floor(bandCount));
  const box = boundsOf(positions);
  if (!Number.isFinite(box.minY) || box.maxY <= box.minY) {
    return { ...EMPTY, bands: new Array<number>(bands).fill(0) };
  }

  const height = box.maxY - box.minY;
  const radii = new Array<number>(bands).fill(0);
  const put = (x: number, y: number, z: number): void => {
    const share = (y - box.minY) / height;
    const band = Math.min(bands - 1, Math.max(0, Math.floor(share * bands)));
    const radial = Math.hypot(x - box.axisX, z - box.axisZ);
    if (radial > radii[band]!) radii[band] = radial;
  };
  /*
   * По РЕБРАХ, а не по вершинах. У призми вершини стоять на трьох рівнях
   * — підошва, плече, вістря, — і смуга між ними виміряла б нуль, хоч там
   * суцільна грань. Перший прогін дав еталонові дві заповнені смуги з
   * двадцяти, і всі висновки з такого профілю були б про порожнечу.
   *
   * Ребер досить: тіло опукле, тож найширша точка смуги завжди лежить на
   * ребрі, а не всередині грані.
   */
  const step = height / bands;
  for (let triangle = 0; triangle + 8 < positions.length; triangle += 9) {
    for (let corner = 0; corner < 3; corner += 1) {
      const from = triangle + corner * 3;
      const to = triangle + ((corner + 1) % 3) * 3;
      const ax = positions[from] ?? 0;
      const ay = positions[from + 1] ?? 0;
      const az = positions[from + 2] ?? 0;
      const bx = positions[to] ?? 0;
      const by = positions[to + 1] ?? 0;
      const bz = positions[to + 2] ?? 0;
      const steps = Math.max(1, Math.ceil((Math.abs(by - ay) / step) * 3));
      for (let index = 0; index <= steps; index += 1) {
        const t = index / steps;
        put(ax + (bx - ax) * t, ay + (by - ay) * t, az + (bz - az) * t);
      }
    }
  }

  const normalised = radii.map((radius) => radius / height);
  let radius = 0;
  let widestBand = 0;
  for (let band = 0; band < bands; band += 1) {
    if (normalised[band]! > radius) { radius = normalised[band]!; widestBand = band; }
  }

  let shoulderBand = 0;
  for (let band = 0; band < bands; band += 1) {
    if (normalised[band]! >= radius * SHOULDER_SHARE) shoulderBand = band;
  }

  return {
    height,
    minY: box.minY,
    axis: { x: box.axisX, z: box.axisZ },
    bands: normalised,
    radius,
    widestAt: (widestBand + 0.5) / bands,
    aspect: radius > 0 ? 1 / (2 * radius) : 0,
    shoulderAt: (shoulderBand + 1) / bands,
    cornerSpread: cornerSpreadAt(positions, box, height, (shoulderBand + 1) / bands),
  };
}

/**
 * Нерівність граней у найгустішому кільці вершин нижче плеча.
 *
 * Вершини збираються в кільця за висотою (допуск — тисячна висоти тіла),
 * береться найлюдніше кільце в нижніх двох третинах призми: біля підошви
 * тіло буває стиснене похованням, біля плеча вже звужується в головку.
 */
function cornerSpreadAt(
  positions: ArrayLike<number>,
  box: Bounds,
  height: number,
  shoulderShare: number,
): number {
  const tolerance = height * 1e-3;
  const rings = new Map<number, { min: number; max: number; count: number }>();
  const ceiling = box.minY + height * shoulderShare * (2 / 3);
  for (let offset = 0; offset + 2 < positions.length; offset += 3) {
    const y = positions[offset + 1] ?? 0;
    if (y > ceiling) continue;
    const radial = Math.hypot(
      (positions[offset] ?? 0) - box.axisX,
      (positions[offset + 2] ?? 0) - box.axisZ,
    );
    // Вершини на самій осі — це кришка підошви, а не кут грані.
    if (radial < height * 1e-3) continue;
    const key = Math.round((y - box.minY) / Math.max(tolerance, 1e-9));
    const ring = rings.get(key);
    if (ring === undefined) rings.set(key, { min: radial, max: radial, count: 1 });
    else {
      ring.count += 1;
      if (radial < ring.min) ring.min = radial;
      if (radial > ring.max) ring.max = radial;
    }
  }

  let best: { min: number; max: number; count: number } | null = null;
  // Ключі впорядковано, щоб рівні за людністю кільця не залежали від
  // порядку обходу Map — канонічний вивід не терпить «як склалось».
  for (const key of [...rings.keys()].sort((left, right) => left - right)) {
    const ring = rings.get(key)!;
    if (best === null || ring.count > best.count) best = ring;
  }
  return best !== null && best.min > 0 ? best.max / best.min : 1;
}

export interface CrystalSettingProfile {
  /**
   * Наскільки високо стоїть порода над підошвою кристала, часткою його
   * висоти.
   *
   * ЦЕ ГОЛОВНЕ ЧИСЛО ФАЙЛА. «Кристал росте з жеоди» означає рівно те, що
   * порода підіймається йому до третини; тарілка під ним дає нуль, і
   * п'єдестал теж дає нуль — бо п'єдестал не порода, а підставка.
   */
  rockRise: number;
  /** Скільки кристала видно над породою. Доповнення до `rockRise`. */
  emergentShare: number;
  /** Радіус породи, поділений на радіус кристала. */
  rockSpread: number;
  /**
   * Рваність вінця: розкид висоти породи по колу, часткою висоти кристала.
   *
   * Рівний верх читається ЧАШЕЮ — посудиною, у яку кристал поставили, — і
   * жоден інший розмір цього не рятує. Нуль означає пласку плиту.
   */
  rimRoughness: number;
}

/** На скільки секторів ділиться коло, коли міряють рваність вінця. */
export const CRYSTAL_RIM_SECTORS = 24;

/**
 * Як кристал СИДИТЬ у породі — четверо чисел про пару мешів.
 *
 * Обидва масиви мусять бути в одному кадрі; вісь береться з кристала, бо
 * саме навколо нього стоїть порода.
 */
export function crystalSettingProfile(
  crystal: ArrayLike<number>,
  rock: ArrayLike<number>,
  sectors: number = CRYSTAL_RIM_SECTORS,
): CrystalSettingProfile {
  const body = boundsOf(crystal);
  const height = body.maxY - body.minY;
  if (!(height > 0) || rock.length < 3) {
    return { rockRise: 0, emergentShare: 1, rockSpread: 0, rimRoughness: 0 };
  }

  const count = Math.max(1, Math.floor(sectors));
  const tops = new Array<number>(count).fill(Number.NEGATIVE_INFINITY);
  let rockTop = Number.NEGATIVE_INFINITY;
  let rockRadius = 0;
  for (let offset = 0; offset + 2 < rock.length; offset += 3) {
    const x = (rock[offset] ?? 0) - body.axisX;
    const y = rock[offset + 1] ?? 0;
    const z = (rock[offset + 2] ?? 0) - body.axisZ;
    if (y > rockTop) rockTop = y;
    const radial = Math.hypot(x, z);
    if (radial > rockRadius) rockRadius = radial;
    const azimuth = Math.atan2(z, x);
    const sector = Math.min(
      count - 1,
      Math.floor(((azimuth + Math.PI) / (2 * Math.PI)) * count),
    );
    if (y > tops[sector]!) tops[sector] = y;
  }

  let rimHigh = Number.NEGATIVE_INFINITY;
  let rimLow = Number.POSITIVE_INFINITY;
  for (const top of tops) {
    if (!Number.isFinite(top)) continue;
    if (top > rimHigh) rimHigh = top;
    if (top < rimLow) rimLow = top;
  }

  const rise = (rockTop - body.minY) / height;
  let crystalRadius = 0;
  for (let offset = 0; offset + 2 < crystal.length; offset += 3) {
    const radial = Math.hypot(
      (crystal[offset] ?? 0) - body.axisX,
      (crystal[offset + 2] ?? 0) - body.axisZ,
    );
    if (radial > crystalRadius) crystalRadius = radial;
  }

  return {
    rockRise: rise,
    emergentShare: 1 - rise,
    rockSpread: crystalRadius > 0 ? rockRadius / crystalRadius : 0,
    rimRoughness: Number.isFinite(rimHigh) && Number.isFinite(rimLow)
      ? (rimHigh - rimLow) / height
      : 0,
  };
}

/**
 * Наскільки два силуети різні — одне число.
 *
 * Середня різниця нормованих радіусів по смугах, поділена на радіус
 * еталона. Нуль — форми збігаються. Та сама арифметика, що в
 * `treeProfileDistance`, і навмисно та сама: два види міряються однаково,
 * інакше їхні числа не можна класти поруч.
 */
export function crystalProfileDistance(
  reference: CrystalProfile,
  actual: CrystalProfile,
): number {
  const bands = Math.min(reference.bands.length, actual.bands.length);
  if (bands === 0 || reference.radius <= 0) return 0;
  let total = 0;
  for (let band = 0; band < bands; band += 1) {
    total += Math.abs(reference.bands[band]! - actual.bands[band]!);
  }
  return total / bands / reference.radius;
}
