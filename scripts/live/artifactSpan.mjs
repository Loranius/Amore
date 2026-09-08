// ============================================================
// Скільки місця артефакт займає на екрані — числом, а не оком.
// ------------------------------------------------------------
// Народилось із зуму (ADR-0160): питання «чи наблизилось» не можна
// поставити знімком, бо на око «трохи більше» й «удвічі більше» — те саме
// слово. Потрібен розмір у пікселях до жесту й після.
//
// ЧОМУ ВІДТІНОК, А НЕ ЯСКРАВІСТЬ. Насиченість тут не розділяє: у кадрі
// порталу камінь острова має 0.57–0.58, а кристал 0.58–0.63 — це та сама
// смуга. Відтінок розділяє начисто, і виміряно на живому кадрі:
// кристал 304–310°, острів, брили й хмари 253–260°. Вікно 285…345°
// лишає між ними двадцять п'ять градусів запасу з обох боків.
//
// НАСИЧЕНІСТЬ ТУТ — НЕ ФІЛЬТР ТІЛА, А ЗАХИСТ ВІД СІРОГО. 0.12, а не 0.3, і
// це виміряно: світлий обвід грані має 0.16–0.30, і поріг 0.3 різав саме
// його — тобто розрізав кристал на окремі грані, між якими не лишалось
// жодного спільного пікселя. Тіло, розрізане навпіл, перестає бути
// найбільшою плямою, і мірка починала звітувати про одну грань.
//
// Пороги названі, а не сховані: свій відтінок кристала заслужений
// (ADR-0004) і поїде разом із кольором пари, тож той, хто змінить колір,
// мусить побачити тут число, а не магію.
// ============================================================

/** Відтінок пікселя, 0…360, і його насиченість, 0…1. */
export function pixelHue(r, g, b) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const span = max - min;
  if (span === 0) return { hue: 0, saturation: 0, value: max };
  let hue;
  if (max === r) hue = 60 * (((g - b) / span) % 6);
  else if (max === g) hue = 60 * ((b - r) / span + 2);
  else hue = 60 * ((r - g) / span + 4);
  if (hue < 0) hue += 360;
  return { hue, saturation: span / max, value: max };
}

/**
 * Маска пікселів артефакта в межах `box`, рядок за рядком.
 *
 * Окремо від `artifactSpan`, бо порівняння двох кадрів питає не рамку, а
 * саме маску: «які пікселі належать тілу на ОБОХ кадрах» — і лише на них
 * має сенс віднімати світло (ADR-0161).
 */
export function artifactMask(image, box, {
  hueFrom = 285,
  hueTo = 345,
  minSaturation = 0.12,
  minValue = 60,
} = {}) {
  const x0 = Math.max(0, Math.floor(box?.x ?? 0));
  const y0 = Math.max(0, Math.floor(box?.y ?? 0));
  const width = Math.max(0, Math.min(image.width - x0, Math.ceil(box?.width ?? image.width)));
  const height = Math.max(0, Math.min(image.height - y0, Math.ceil(box?.height ?? image.height)));
  const mask = new Uint8Array(width * height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const at = ((y + y0) * image.width + (x + x0)) * image.channels;
      const { hue, saturation, value } = pixelHue(
        image.data[at], image.data[at + 1], image.data[at + 2],
      );
      if (value < minValue || saturation < minSaturation) continue;
      if (hue < hueFrom || hue > hueTo) continue;
      mask[y * width + x] = 1;
    }
  }
  return mask;
}

/**
 * Прямокутник, у який вписується артефакт, у пікселях знімка.
 *
 * НАЙБІЛЬША ЗВ'ЯЗНА ПЛЯМА, а не рамка всіх відповідних пікселів, і це не
 * педантизм. Полотно порталу займає ВЕСЬ екран (виміряно: `canvas` — це
 * 0,0,412,915), тож обмежити пошук ним неможливо, а над ним лежить
 * інтерфейс того ж відтінку. Рамка всіх пікселів звітувала про артефакт
 * заввишки 1292 замість 754 у тих прогонах, де привітання випало з
 * рожевою квіткою в емодзі: 144 пікселі вгорі екрана піднімали верхню
 * межу на 538. Число виглядало правдоподібно й було неправдою.
 *
 * Пляма — це тіло. Лічильник днів, крапка на вкладці й емодзі в
 * привітанні тілами не є, хай який у них відтінок.
 *
 * Повертає `null`, коли жоден піксель не пройшов, — і це чесніша
 * відповідь за нуль: «артефакта в кадрі немає» і «артефакт нульової
 * висоти» — різні речі, і перша вже двічі коштувала хибного висновку.
 */
export function artifactSpan(image, box, {
  hueFrom = 285,
  hueTo = 345,
  minSaturation = 0.12,
  minValue = 60,
} = {}) {
  const x0 = Math.max(0, Math.floor(box?.x ?? 0));
  const y0 = Math.max(0, Math.floor(box?.y ?? 0));
  const x1 = Math.min(image.width, Math.ceil(x0 + (box?.width ?? image.width)));
  const y1 = Math.min(image.height, Math.ceil(y0 + (box?.height ?? image.height)));
  const width = Math.max(0, x1 - x0);
  const height = Math.max(0, y1 - y0);
  if (width === 0 || height === 0) return null;

  const mask = artifactMask(image, { x: x0, y: y0, width, height }, {
    hueFrom, hueTo, minSaturation, minValue,
  });

  // Обхід у ширину власним стеком, а не рекурсією: тіло на весь екран —
  // це сотні тисяч пікселів, і рекурсія лягла б на глибині стека.
  const seen = new Uint8Array(width * height);
  const stack = new Int32Array(width * height);
  let best = null;
  for (let start = 0; start < mask.length; start += 1) {
    if (mask[start] === 0 || seen[start] === 1) continue;
    let top = 0;
    stack[top] = start;
    top += 1;
    seen[start] = 1;
    let pixels = 0;
    let left = width;
    let right = -1;
    let upper = height;
    let lower = -1;
    while (top > 0) {
      top -= 1;
      const cell = stack[top];
      const x = cell % width;
      const y = (cell - x) / width;
      pixels += 1;
      if (x < left) left = x;
      if (x > right) right = x;
      if (y < upper) upper = y;
      if (y > lower) lower = y;
      const neighbours = [
        x > 0 ? cell - 1 : -1,
        x + 1 < width ? cell + 1 : -1,
        y > 0 ? cell - width : -1,
        y + 1 < height ? cell + width : -1,
      ];
      for (const next of neighbours) {
        if (next < 0 || mask[next] === 0 || seen[next] === 1) continue;
        seen[next] = 1;
        stack[top] = next;
        top += 1;
      }
    }
    if (best === null || pixels > best.pixels) {
      best = {
        pixels,
        left: left + x0,
        right: right + x0,
        top: upper + y0,
        bottom: lower + y0,
        width: right - left + 1,
        height: lower - upper + 1,
      };
    }
  }
  return best;
}
