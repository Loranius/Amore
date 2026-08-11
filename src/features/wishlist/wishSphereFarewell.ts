// ============================================================
// Бажання йдуть далі — прощання при виході з модуля.
// ------------------------------------------------------------
// Власник: «коли переходиш на другий модуль чи на модуль головної, нехай вони
// продовжують рух в ліву сторону екрану». Кулі входять справа; вихід ліворуч
// робить із двох переходів один наскрізний рух, а не показ анімації задом
// наперед.
//
// **Чому шар-двійник, а не анімація на місці.** Сфери живуть у сторінці
// вішліста, і маршрутизатор знімає її миттєво: анімувати нічого — вузлів уже
// немає. Тому в мить зняття робиться знімок поля (клони вузлів у власному
// шарі поверх застосунку), і летить саме він. Живої сторінки він не тримає:
// ані запитів, ані обробників, ані React.
//
// **Чому не завжди.** Перемикання вигляду (Кристали → Список) теж знімає
// сфери, але з модуля ми при цьому не виходимо, і кулі, що летять через
// список, були б непорозумінням. Тому рішення відкладене на кадр: якщо
// сторінка вішліста ще на місці — знімок просто викидається.
// ============================================================

/** Скільки летить одна куля, мілісекунди. */
export const FAREWELL_RUN = 620;

/** Проміжок між сусідніми, мілісекунди. */
export const FAREWELL_STAGGER = 55;

/** Скільки чекати після останнього кадру, перш ніж прибрати шар. */
const FAREWELL_TAIL = 80;

export interface WishSphereFarewellPlan {
  /** Скільки пікселів ліворуч летить кожна куля. */
  awayX: number;
  /** Затримка старту для кулі за її номером, мілісекунди. */
  delayFor: (index: number) => number;
  /** Скільки жити шару, мілісекунди. */
  life: number;
}

/**
 * Скільки й куди летіти.
 *
 * Виліт мусить винести кулю за лівий край ПОВНІСТЮ — з урахуванням її власного
 * радіуса й того, що вона встигає зменшитись. Інакше на слабкому кадрі видно,
 * як половина кулі зникає посеред екрана.
 */
export function wishSphereFarewellPlan({
  count,
  fieldWidth,
  widest,
}: {
  count: number;
  fieldWidth: number;
  widest: number;
}): WishSphereFarewellPlan {
  const balls = Math.max(0, Math.floor(finite(count, 0)));
  const width = Math.max(0, finite(fieldWidth, 0));
  const diameter = Math.max(0, finite(widest, 0));
  return {
    awayX: -(width + diameter + 24),
    delayFor: (index) => Math.max(0, Math.floor(finite(index, 0))) * FAREWELL_STAGGER,
    life: balls === 0
      ? 0
      : FAREWELL_RUN + (balls - 1) * FAREWELL_STAGGER + FAREWELL_TAIL,
  };
}

/**
 * Знімає поле сфер і відправляє знімок ліворуч.
 *
 * Повертає функцію скасування: викликач може передумати, коли з'ясується, що
 * модуль нікуди не подівся.
 */
export function startWishSphereFarewell(field: HTMLElement): (() => void) | null {
  if (typeof document === 'undefined' || !field.isConnected) return null;
  const spheres = Array.from(field.querySelectorAll<HTMLElement>('.wl-sphere'));
  if (spheres.length === 0) return null;

  const box = field.getBoundingClientRect();
  if (box.width < 1 || box.height < 1) return null;

  const plan = wishSphereFarewellPlan({
    count: spheres.length,
    fieldWidth: box.width,
    widest: Math.max(...spheres.map((node) => node.getBoundingClientRect().width)),
  });

  const layer = document.createElement('div');
  // Клас поля обов'язковий, а не для охайності: усі правила сфери — і скло, і
  // абсолютне положення — писані через предка `.wl-sphere-field`. Виміряно на
  // живому порталі: без нього клони втратили все, розклались звичайним потоком
  // і полетіли не туди, куди їх посилали.
  layer.className = 'wl-sphere-field wl-sphere-farewell';
  layer.setAttribute('aria-hidden', 'true');
  layer.style.left = `${box.left}px`;
  layer.style.top = `${box.top}px`;
  layer.style.width = `${box.width}px`;
  layer.style.height = `${box.height}px`;
  layer.style.setProperty('--away-x', `${plan.awayX.toFixed(1)}px`);
  layer.style.setProperty('--away-run', `${FAREWELL_RUN}ms`);

  spheres.forEach((sphere, index) => {
    const slot = document.createElement('span');
    slot.className = 'wl-sphere-farewell__slot';
    slot.style.setProperty('--away-delay', `${plan.delayFor(index)}ms`);
    const clone = sphere.cloneNode(true) as HTMLElement;
    // Двійник нічого не робить: ні фокусу, ні дотиків, ні читачів екрана.
    clone.removeAttribute('id');
    clone.setAttribute('tabindex', '-1');
    clone.setAttribute('aria-hidden', 'true');
    slot.appendChild(clone);
    layer.appendChild(slot);
  });

  document.body.appendChild(layer);
  const timer = window.setTimeout(() => { layer.remove(); }, plan.life);

  return () => {
    window.clearTimeout(timer);
    layer.remove();
  };
}

function finite(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}
