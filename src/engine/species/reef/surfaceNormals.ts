// ============================================================
// Нормалі поверхні з кутом зламу — одне місце на всі тіла рифа.
// ------------------------------------------------------------
// НАВІЩО. Досі твердість ребра задавав `flatShading` на МАТЕРІАЛІ: прапорець
// наказував рендереру викинути нормалі вершин і перерахувати одну пласку
// нормаль на трикутник. Тобто кожен трикутник ставав окремою плямою з твердим
// краєм — хай яку гладку сітку йому дали. Власник назвав це «аплікацією
// дитини з гострими кутками» (ADR-0195), і назвав точно: пласкі фігури з
// твердим краєм, наклеєні на тло.
//
// Прапорець при цьому ще й ХОВАВ ВАДУ ДАНИХ. Нормалі кульки й камінця
// рахувались як `position / |position|`, а денце й маківка стоять у самому
// нулі — там ця формула вироджується. Поки затінення пласке, нормаль вершини
// просто не використовувалась; щойно її ввімкнули, обидва тіла почорніли
// знизу. Виміряно знімком, не виведено з коду.
//
// ЩО ТУТ ЗАМІСТЬ ПРАПОРЦЯ. Твердість — властивість ФОРМИ, а не матеріалу, і
// живе вона там, де форму будують. Ребро твердне, лише коли кут між гранями
// більший за поріг тіла:
//
//   купол, корал, водорість → гладкі, бо це живі тіла;
//   камінь і камінець       → грановані, бо камінь ламається по площинах
//                             (те саме правило, що в `amore-crystal-look`).
//
// ЧОМУ НЕ «ПРОСТО УСЕРЕДНИТИ ВСЕ». Усереднення без порога згладило б і
// справжній злам: у гальки зникли б боки, і вона стала б грудкою. Поріг —
// це і є різниця між «гладке тіло» й «гладка каша».
//
// ДЕТЕРМІНІЗМ. Жодного `Math.random`, жодної залежності від порядку обходу
// хеш-таблиці: вершини виходять у порядку першої зустрічі під час обходу
// трикутників, а він заданий масивом індексів.
// ============================================================
import { round6 } from './math';

export interface CreasedMesh {
  positions: number[];
  normals: number[];
  indices: number[];
  /** Перенесені значення для кожної ВИХІДНОЇ вершини, якщо їх давали. */
  tint?: number[];
  /**
   * Куди поділась кожна ВХІДНА вершина: індекс першої вихідної.
   *
   * НАВІЩО. Зварювання лишає вершину на місці, доки вона нікуди не
   * розщепилась, — але щойно ребро лишається твердим, одна вхідна
   * вершина дає кілька вихідних, і вони стають ПОРУЧ, зсуваючи все
   * наступне. Тобто крок «тридцять шість вершин на кільце» після першого
   * ж розщеплення перестає бути правдою.
   *
   * Це вже коштувало мовчазно неправильного виміру: перевірки купола
   * ходили кільцями за кроком і після ADR-0195 почали брати шматки РІЗНИХ
   * кілець. Вони при цьому проходили — число просто означало не те.
   *
   * Тому меш каже, де його ґратка, замість того щоб її вгадували. Та сама
   * відповідь, що в ADR-0193 §4, тільки на рівень глибше: там довжину
   * кільця експортували числом, тут — саму розкладку.
   */
  firstOf: number[];
}

/** Ключ зварювання: позиції вже округлені `round6`, тож рядок точний. */
function positionKey(positions: readonly number[], vertex: number): string {
  return `${positions[vertex * 3]},${positions[vertex * 3 + 1]},${positions[vertex * 3 + 2]}`;
}

/** Знайти корінь у системі неперетинних множин. */
function findRoot(parent: number[], at: number): number {
  let node = at;
  while (parent[node] !== node) {
    parent[node] = parent[parent[node]!]!;
    node = parent[node]!;
  }
  return node;
}

/**
 * Нормалі граней, НЕ нормовані.
 *
 * Довжина векторного добутку — подвоєна площа трикутника, і лишити її
 * означає зважити внесок грані її площею. Без цього десяток дрібних
 * трикутників на маківці перетягував би одну велику грань боку, і вершина
 * дивилась би не туди, куди дивиться тіло.
 */
function faceNormals(positions: readonly number[], indices: readonly number[]): number[] {
  const normals: number[] = [];
  for (let face = 0; face < indices.length / 3; face += 1) {
    const a = indices[face * 3]! * 3;
    const b = indices[face * 3 + 1]! * 3;
    const c = indices[face * 3 + 2]! * 3;
    const ux = positions[b]! - positions[a]!;
    const uy = positions[b + 1]! - positions[a + 1]!;
    const uz = positions[b + 2]! - positions[a + 2]!;
    const vx = positions[c]! - positions[a]!;
    const vy = positions[c + 1]! - positions[a + 1]!;
    const vz = positions[c + 2]! - positions[a + 2]!;
    normals.push(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx);
  }
  return normals;
}

/**
 * Зварити вершини з урахуванням кута зламу.
 *
 * `creaseAngleDeg` — кут МІЖ ГРАНЯМИ, за яким ребро лишається твердим.
 * 180° означає «згладити все», 0° — «нічого не згладжувати» (тобто те саме,
 * що робив `flatShading`, тільки тепер це сказано в геометрії й видно в
 * числі вершин).
 *
 * `tint` — необов'язкове значення на ВХІДНУ вершину, яке треба донести до
 * вихідної. Коли в одну вершину зварюються кілька вхідних, береться їхнє
 * середнє: тінт у цьому проєкті — функція від висоти тіла, тож у зварених
 * вершин він однаковий, і середнє нічого не зміщує.
 */
export interface WeldOptions {
  creaseAngleDeg: number;
  /** Значення на ВХІДНУ вершину, яке треба донести до вихідної. */
  tint?: readonly number[];
  /**
   * Номери СХОВАНИХ трикутників — нижніх кришок і денець.
   *
   * Множина, а не межа: у колонії кришки лежать не в кінці, а вперемішку —
   * по одній на кожне коралове тіло, одразу за його маківкою.
   *
   * ЧОМУ ЦЕ ТУТ, А НЕ В РЕНДЕРЕРІ. Кришка коралового тіла затоплена в
   * купол, кришка купола — у камінь, денце кульки лежить на поверхні: усі
   * вони мусять існувати, щоб тіло лишалось замкненим, і жодного з них
   * камера не бачить (`maxPolarAngle` рифа — 0.48π).
   *
   * Якби вони брали участь у зварюванні, сталося б дві шкоди, і обидві
   * виміряні:
   *
   *  1. **Затінення.** Нормаль кришки дивиться строго вниз. Усереднена з
   *     боковими гранями, вона потягнула б нижнє кільце донизу — і по
   *     основі кожного тіла пішла б темна смуга, якої на тілі немає.
   *  2. **Розщеплення.** Кришка стикається з боком майже під прямим, тож
   *     будь-який розумний поріг лишає ребро твердим і розводить вершини
   *     нижнього кільця на дві копії. Це зсуває ВСІ наступні індекси —
   *     і мовчки ламає кожен тест, який шукає маківку чи основу за
   *     номером вершини.
   *
   * Тому сховані трикутники лишаються в індексному буфері (тіло замкнене),
   * але нормалей не дають і зламів не створюють.
   */
  hiddenFaces?: ReadonlySet<number>;
}

export function weldCreased(
  positions: readonly number[],
  indices: readonly number[],
  options: WeldOptions & { tint: readonly number[] },
): Required<CreasedMesh>;
export function weldCreased(
  positions: readonly number[],
  indices: readonly number[],
  options: WeldOptions,
): CreasedMesh;
export function weldCreased(
  positions: readonly number[],
  indices: readonly number[],
  options: WeldOptions,
): CreasedMesh {
  const { creaseAngleDeg, tint } = options;
  const hiddenFaces = options.hiddenFaces;
  const faces = indices.length / 3;
  const rawNormals = faceNormals(positions, indices);
  const creaseCos = Math.cos((Math.min(180, Math.max(0, creaseAngleDeg)) * Math.PI) / 180);

  // Які грані сходяться в кожній ЗВАРЕНІЙ точці.
  const atPoint = new Map<string, Array<{ face: number; corner: number }>>();
  const hiddenAtPoint = new Map<string, number>();
  for (let face = 0; face < faces; face += 1) {
    // Схована грань у розкладку не входить зовсім: вона не дає нормалі й
    // не розводить вершини, бо її ніхто не бачить.
    const hidden = hiddenFaces?.has(face) === true;
    for (let corner = 0; corner < 3; corner += 1) {
      const key = positionKey(positions, indices[face * 3 + corner]!);
      if (hidden) {
        if (!hiddenAtPoint.has(key)) hiddenAtPoint.set(key, face);
        continue;
      }
      const bucket = atPoint.get(key);
      if (bucket) bucket.push({ face, corner });
      else atPoint.set(key, [{ face, corner }]);
    }
  }

  /*
   * Групи згладжування будуються В КОЖНІЙ ТОЧЦІ ОКРЕМО, а не на все тіло.
   * Та сама грань може бути гладкою з лівим сусідом і твердою з правим —
   * так на камені й виходить ребро, що обривається.
   *
   * Об'єднання транзитивне, і це не недогляд: на кулі ланцюжок дрібних
   * кутів мусить зливатись в одну гладку шапку. На кубі ланцюжка немає —
   * три грані по 90° не зіллються ніколи.
   */
  const outPositions: number[] = [];
  const outNormals: number[] = [];
  const outTint: number[] = [];
  const outIndices: number[] = new Array(indices.length).fill(0);

  /*
   * Групи згладжування будуються В КОЖНІЙ ТОЧЦІ ОКРЕМО, а не на все тіло.
   * Та сама грань може бути гладкою з лівим сусідом і твердою з правим —
   * так на камені й виходить ребро, що обривається.
   *
   * Об'єднання транзитивне, і це не недогляд: на кулі ланцюжок дрібних
   * кутів мусить зливатись в одну гладку шапку. На кубі ланцюжка немає —
   * три грані по 90° не зіллються ніколи.
   */
  const parentByKey = new Map<string, number[]>();
  for (const [key, corners] of atPoint) {
    const parent = corners.map((_c, at) => at);
    for (let left = 0; left < corners.length; left += 1) {
      for (let right = left + 1; right < corners.length; right += 1) {
        const a = corners[left]!.face * 3;
        const b = corners[right]!.face * 3;
        const lenA = Math.hypot(rawNormals[a]!, rawNormals[a + 1]!, rawNormals[a + 2]!);
        const lenB = Math.hypot(rawNormals[b]!, rawNormals[b + 1]!, rawNormals[b + 2]!);
        if (lenA <= 1e-12 || lenB <= 1e-12) continue;
        const dot = (rawNormals[a]! * rawNormals[b]!
          + rawNormals[a + 1]! * rawNormals[b + 1]!
          + rawNormals[a + 2]! * rawNormals[b + 2]!) / (lenA * lenB);
        if (dot >= creaseCos) {
          const rootA = findRoot(parent, left);
          const rootB = findRoot(parent, right);
          if (rootA !== rootB) parent[Math.max(rootA, rootB)] = Math.min(rootA, rootB);
        }
      }
    }
    parentByKey.set(key, parent);
  }

  /*
   * ВИХІДНІ ВЕРШИНИ ЙДУТЬ У ПОРЯДКУ ВХІДНИХ, і це не охайність.
   *
   * Перша редакція видавала їх у порядку обходу таблиці точок — і меш, у
   * якому нічого не зварилось, усе одно виходив із переставленими
   * вершинами. Від того посипались чужі тести: той, що ходить кільцями
   * кульки, той, що знає ціну колонії, і той, що шукає маківку. Жоден із
   * них не був про нормалі.
   *
   * Тобто перестановка — це мовчазна зміна контракту, якого ніхто не
   * оголошував. Тепер вершина, яка нікуди не розщепилась, лишається на
   * своєму місці, а розщеплена дає свої копії підряд, одразу за собою.
   */
  const sourceCount = positions.length / 3;
  const emitted = new Map<string, Map<number, number>>();
  const hiddenVertexOf = new Map<string, number>();
  for (let source = 0; source < sourceCount; source += 1) {
    const key = positionKey(positions, source);
    const corners = atPoint.get(key);
    const parent = parentByKey.get(key);
    if (!corners || !parent) {
      /*
       * Вершина, яку тримає ЛИШЕ схована грань, — це центр кришки. Вона
       * теж виходить тут, на своєму місці в порядку, а не дописується в
       * кінець: крок вершин на тіло — частина контракту меша, і кожен
       * тест, що шукає основу чи маківку за номером, спирається на нього.
       */
      const hiddenFace = hiddenAtPoint.get(key);
      if (hiddenFace === undefined || hiddenVertexOf.has(key)) continue;
      hiddenVertexOf.set(key, outPositions.length / 3);
      outPositions.push(
        positions[source * 3]!, positions[source * 3 + 1]!, positions[source * 3 + 2]!,
      );
      const face3 = hiddenFace * 3;
      outNormals.push(rawNormals[face3]!, rawNormals[face3 + 1]!, rawNormals[face3 + 2]!);
      if (tint) outTint.push(tint[source] ?? 1);
      continue;
    }
    let byGroup = emitted.get(key);
    if (!byGroup) { byGroup = new Map<number, number>(); emitted.set(key, byGroup); }
    for (let at = 0; at < corners.length; at += 1) {
      const corner = corners[at]!;
      if (indices[corner.face * 3 + corner.corner] !== source) continue;
      const group = findRoot(parent, at);
      if (byGroup.has(group)) continue;
      byGroup.set(group, outPositions.length / 3);
      outPositions.push(
        positions[source * 3]!, positions[source * 3 + 1]!, positions[source * 3 + 2]!,
      );
      outNormals.push(0, 0, 0);
      if (tint) outTint.push(tint[source] ?? 1);
    }
  }

  // Другий прохід: сума нормалей граней і самі індекси.
  for (const [key, corners] of atPoint) {
    const parent = parentByKey.get(key)!;
    const byGroup = emitted.get(key)!;
    for (let at = 0; at < corners.length; at += 1) {
      const corner = corners[at]!;
      const vertex = byGroup.get(findRoot(parent, at))!;
      const at3 = vertex * 3;
      const face3 = corner.face * 3;
      outNormals[at3] = outNormals[at3]! + rawNormals[face3]!;
      outNormals[at3 + 1] = outNormals[at3 + 1]! + rawNormals[face3 + 1]!;
      outNormals[at3 + 2] = outNormals[at3 + 2]! + rawNormals[face3 + 2]!;
      outIndices[corner.face * 3 + corner.corner] = vertex;
    }
  }

  /*
   * Сховані грані тепер треба перенумерувати окремо: у розкладці їх не
   * було, тож їхні кути ще дивляться на ВХІДНІ вершини. Кожен бере ту
   * вихідну вершину, яку його позиція вже отримала від видимої частини
   * тіла; якщо позиція видимій частині не належала зовсім (центр кришки),
   * вершина заводиться тут — із нормаллю грані, щоб не лишитись чорною.
   */
  for (let face = 0; face < faces; face += 1) {
    if (!hiddenFaces?.has(face)) continue;
    for (let corner = 0; corner < 3; corner += 1) {
      const source = indices[face * 3 + corner]!;
      const key = positionKey(positions, source);
      const byGroup = emitted.get(key);
      const first = byGroup ? byGroup.values().next() : { done: true as const, value: undefined };
      if (!first.done && typeof first.value === 'number') {
        outIndices[face * 3 + corner] = first.value;
        continue;
      }
      const vertex = hiddenVertexOf.get(key);
      if (vertex === undefined) continue;
      outIndices[face * 3 + corner] = vertex;
    }
  }

  /*
   * Нормування в кінці, і тут же — ЄДИНЕ місце, де вироджена вершина
   * отримує відповідь. Сума нормалей може бути нулем лише тоді, коли всі
   * грані точки взаємно погасились (голка нульової товщини). Замість нуля,
   * який на екрані дає чорну пляму, береться нормаль ПЕРШОЇ грані точки:
   * вона завжди має напрямок, бо вироджені грані до групи не входять.
   */
  for (let vertex = 0; vertex < outNormals.length / 3; vertex += 1) {
    const at = vertex * 3;
    let length = Math.hypot(outNormals[at]!, outNormals[at + 1]!, outNormals[at + 2]!);
    if (length <= 1e-12) {
      outNormals[at] = 0; outNormals[at + 1] = 1; outNormals[at + 2] = 0;
      length = 1;
    }
    outNormals[at] = round6(outNormals[at]! / length);
    outNormals[at + 1] = round6(outNormals[at + 1]! / length);
    outNormals[at + 2] = round6(outNormals[at + 2]! / length);
  }

  /*
   * Перша вихідна вершина кожної вхідної. Береться з тих самих таблиць,
   * якими щойно видавались вершини, тож розійтись вони не можуть.
   */
  const firstOf: number[] = new Array(sourceCount).fill(-1);
  for (let source = 0; source < sourceCount; source += 1) {
    const key = positionKey(positions, source);
    const byGroup = emitted.get(key);
    const first = byGroup?.values().next();
    if (first && !first.done && typeof first.value === 'number') firstOf[source] = first.value;
    else firstOf[source] = hiddenVertexOf.get(key) ?? -1;
  }

  return tint
    ? {
      positions: outPositions,
      normals: outNormals,
      indices: outIndices,
      tint: outTint.map(round6),
      firstOf,
    }
    : { positions: outPositions, normals: outNormals, indices: outIndices, firstOf };
}
