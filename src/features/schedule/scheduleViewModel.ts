import type { ScheduleMark } from './useSchedule';
import type { AppUser } from '@/types';
import type { MarksMap } from './useSchedule';

export type DayStatus = 'both-off' | 'lena-off' | 'dima-off' | 'none';

export function dayStatus(
  lena: AppUser | undefined,
  dima: AppUser | undefined,
  marks: MarksMap,
  date: string,
): DayStatus {
  const lenaOff = !!lena && marks[lena.id]?.[date] === 'Х';
  const dimaOff = !!dima && marks[dima.id]?.[date] === 'Х';
  if (lenaOff && dimaOff) return 'both-off';
  if (lenaOff) return 'lena-off';
  if (dimaOff) return 'dima-off';
  return 'none';
}

/**
 * «неділя, 20 вересня» — НАЗИВНИЙ відмінок, а не «неділю».
 *
 * ВАДА, ЯКОЇ ТЕСТ НА NODE ПОБАЧИТИ НЕ МІГ, і це головне тут. Один виклик
 * `toLocaleDateString` із днем тижня У СКЛАДІ дати дає різне в різних ICU:
 *
 *   Chromium : «неділю, 20 вересня» · «суботу, 26 вересня»
 *   Node     : «неділя, 20 вересня» · «субота, 26 вересня»
 *
 * Обидва виміряні тут-таки. Українська має окремі форми для «у неділю» і
 * «неділя», і ICU Chromium обирає першу, щойно день тижня стоїть поруч із
 * числом. Пара бачить браузер, а набір тестів — Node, тож вада прожила б
 * скільки завгодно: аудит §4.7 помітив її оком.
 *
 * Ліки — форматувати день тижня ОКРЕМИМ викликом: сам по собі він іде в
 * самостійній формі, і Chromium теж дає називний. Перевірено в Chromium.
 */
export function fmtLongDate(date: string): string {
  const at = new Date(`${date}T12:00:00`);
  const weekday = at.toLocaleDateString('uk-UA', { weekday: 'long' });
  const rest = at.toLocaleDateString('uk-UA', { day: 'numeric', month: 'long' });
  return `${weekday}, ${rest}`;
}

/**
 * Наступний стан дня за дотиком по доріжці (ADR-0208, варіант A).
 *
 * Правило коротке, і воно вибране за даними, а не за симетрією:
 *
 *   порожньо → Х   позначати варто те, заради чого сюди заходять —
 *                  вільний день;
 *   Х        → Р
 *   Р        → Х   далі це чистий перемикач.
 *
 * ЧОМУ «ОЧИСТИТИ» НЕ В КОЛІ. Три стани по колу означали б, що повернути
 * день у попередній вигляд можна лише двома дотиками, а самé «порожньо»
 * в даних пари не трапляється ЖОДНОГО разу: 184 мітки за три місяці, усі
 * або `Р`, або `Х`, і кожен день обох заповнений. Очищення лишається в
 * пакетних інструментах, де воно й потрібне (очистити місяць).
 *
 * НАСЛІДОК, ЯКИЙ ВАРТО НАЗВАТИ: між `Р` і `Х` перемикач САМ СОБІ
 * скасування — другий дотик повертає перший стан. Саме тому режим правки
 * більше не потрібен, щоб уберегти від випадкового дотику.
 */
export function nextMark(current: ScheduleMark): ScheduleMark {
  return current === 'Х' ? 'Р' : 'Х';
}

export function countdownLabel(date: string, today: string): string {
  const target = new Date(`${date}T12:00:00`).getTime();
  const current = new Date(`${today}T12:00:00`).getTime();
  const days = Math.max(0, Math.round((target - current) / 86_400_000));
  if (days === 0) return 'Сьогодні';
  if (days === 1) return 'Завтра';
  return `Через ${days} дн.`;
}

/** Двоє членів пари, як їх зовуть — для рядка про стан дня. */
export interface StatusNames {
  /** Той, кого модуль тримає в слоті `--her` (другий за порядком id). */
  lena: string | undefined;
  /** Той, кого модуль тримає в слоті `--him` (перший за порядком id). */
  dima: string | undefined;
}

/**
 * Що сказано про день словами.
 *
 * ТУТ БУЛИ НЕ ЛИШЕ ІМЕНА, А Й РІД: «Лєна вільна» проти «Діма вільний».
 * Імена підставити легко, рід — ні: з рядка `users.name` він не виводиться,
 * а вгадувати його по закінченню означало б звертатись до пари неправильно
 * її ж іменем (ADR-0209).
 *
 * Тому форма змінена на таку, що НЕ УЗГОДЖУЄТЬСЯ ні в роді, ні у відмінку:
 * ім'я стоїть у називному, дієслово — у третій особі однини. Вона працює
 * для «Лєна», «Діма», «Олексій» і «Marie» однаково.
 *
 * Ціна названа прямо: формулювання цієї пари змінилось із
 * «Лєна вільна, Діма працює» на «Тільки Лєна відпочиває, Діма працює».
 * Зміст той самий, слів на одне більше.
 *
 * `undefined` тут можливий, поки список користувачів не приїхав, і тоді
 * рядок не вигадує імені: він каже про кількість, а не про людину.
 */
export function statusText(status: DayStatus, names: StatusNames): string {
  if (status === 'both-off') return 'Ви обоє вільні';
  if (status === 'lena-off') return pairLine(names.lena, names.dima);
  if (status === 'dima-off') return pairLine(names.dima, names.lena);
  return 'Спільного вихідного немає';
}

function pairLine(resting: string | undefined, working: string | undefined): string {
  if (resting === undefined || working === undefined) return 'Вільний лише один із вас';
  return `Тільки ${resting} відпочиває, ${working} працює`;
}

