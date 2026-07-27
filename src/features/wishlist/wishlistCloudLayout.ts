import './wishlistGiftPortrait.css';

export type WishlistCloudPriority = 'high' | 'medium' | 'low';

export interface WishlistCloudPriorityPresentation {
  label: 'Жадане' | 'Бажане' | 'Приємне';
  icon: string;
  size: number;
}

export interface WishlistCloudPlacement {
  marginTop: number;
  marginRight: number;
  marginBottom: number;
  marginLeft: number;
  translateX: number;
  translateY: number;
  rotate: number;
  delay: number;
  duration: number;
  zIndex: number;
  /** Амплітуда дихання по горизонталі, px (CSS-анімація). */
  driftX: number;
  /** Амплітуда дихання по вертикалі, px (від'ємна — вгору). */
  driftY: number;
}

const PRIORITY_PRESENTATION: Record<WishlistCloudPriority, WishlistCloudPriorityPresentation> = {
  high: { label: 'Жадане', icon: '✦', size: 174 },
  medium: { label: 'Бажане', icon: '♡', size: 116 },
  low: { label: 'Приємне', icon: '❀', size: 78 },
};

function stableHash(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function ranged(hash: number, shift: number, minimum: number, maximum: number): number {
  const range = maximum - minimum + 1;
  return minimum + ((hash >>> shift) % range);
}

export function normalizeWishlistCloudPriority(value: unknown): WishlistCloudPriority {
  if (value === 'high' || value === 'dream') return 'high';
  if (value === 'low') return 'low';
  return 'medium';
}

export function wishlistCloudPriorityPresentation(
  value: unknown,
): WishlistCloudPriorityPresentation {
  return PRIORITY_PRESENTATION[normalizeWishlistCloudPriority(value)];
}

/**
 * Свіжий seed розкладки. Той самий підхід, що вже працює для полароїдів
 * (`freshWishlistPolaroidSeed`) — не новий механізм, а той самий.
 */
export function freshWishlistCloudSeed(): number {
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const value = new Uint32Array(1);
    crypto.getRandomValues(value);
    return value[0] ?? Date.now();
  }
  return (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
}

/**
 * Розкладка однієї бульбашки.
 *
 * `seed` тут — не прикраса, а суть зміни. Донедавна розкладка бралася лише
 * з `stableHash(id)`, тобто бульбашка того самого бажання ЗАВЖДИ стояла в
 * тому самому місці, під тим самим кутом і з тією самою фазою дихання.
 * Вкладка виглядала застиглою, бо буквально була застигла.
 *
 * Тепер seed новий на кожне відкриття вигляду й СТАЛИЙ у межах сесії: між
 * заходами розклад інший, а поки користувач у вкладці — нічого не стрибає.
 * Ціна нульова: це один розрахунок при монтуванні, без кадрів і таймерів.
 *
 * `id` лишається у формулі, щоб дві бульбашки одного екрана не збігались
 * між собою навіть за однакового seed.
 */
export function wishlistCloudPlacement(
  seed: number,
  id: number | string,
  index: number,
): WishlistCloudPlacement {
  const hash = stableHash(`${seed}:${id}:${index}`);

  // Діапазони ширші за колишні (було ±10/±12 по зсуву): при вузькому
  // розкиді два різні seed давали майже однакову картинку, і сенс зміни
  // не читався. Межі підібрані так, щоб на екрані 448px (Pixel 8 Pro у CI)
  // бульбашки лишались у дошці — вихід за край однаково підбирає
  // `clampBodyToBoard`, але краще туди не впиратись.
  return {
    marginTop: ranged(hash, 0, -10, 22),
    marginRight: ranged(hash, 4, -11, 18),
    marginBottom: ranged(hash, 8, -10, 22),
    marginLeft: ranged(hash, 12, -11, 18),
    translateX: ranged(hash, 16, -18, 18),
    translateY: ranged(hash, 20, -20, 20),
    rotate: ranged(hash, 24, -6, 6),
    delay: (hash % 11) * -0.37,
    duration: 5.2 + (hash % 8) * 0.26,
    zIndex: 1 + (hash % 5),
    // Дихання — по ОБОХ осях, амплітуди різні на кожну бульбашку. Це та
    // сама CSS-анімація (кадри малює браузер, JS не бере участі), просто
    // тепер вона не «−6px вертикально в усіх однаково».
    driftX: ranged(hash, 26, -7, 7),
    driftY: -(4 + ((hash >>> 28) % 6)),
  };
}
