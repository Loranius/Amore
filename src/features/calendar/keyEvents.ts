// ============================================================
// Шаблони ключових подій.
// ------------------------------------------------------------
// Ключовою подію не можна зробити вручну — її можна лише взяти зі списку з
// двох. Так вибір рівня перестає бути місцем, де легко помилитись: поки він
// був вільним, у пари-власника ключових набралось чотири, і ядром сузір'я
// стала «Річниця першого повідомлення» замість початку відносин.
//
// Друга половина правила — в базі: частковий унікальний індекс не дає
// з'явитись другому початку відносин чи другому одруженню, навіть якщо два
// телефони збережуть подію одночасно.
// ============================================================
import type { EventRow, KeySignificance } from '@/types';
import { isKeySignificance } from '@/types';

export interface KeyEventTemplate {
  significance: KeySignificance;
  /** Назва підставляється у форму; пара може її переписати. */
  title: string;
  hint: string;
}

export const KEY_EVENT_TEMPLATES: readonly KeyEventTemplate[] = [
  {
    significance: 'relationship_start',
    title: 'Початок відносин',
    hint: 'Дата, з якої ви разом',
  },
  {
    significance: 'marriage',
    title: 'Одруження',
    hint: 'Забирає центр сузір’я в початку відносин',
  },
];

/**
 * Які ключові події в пари вже є.
 *
 * `except` — подія, яку зараз редагують: власний рівень не має вимикати
 * власну ж кнопку, інакше відкрити й зберегти одруження стане неможливо.
 */
export function takenKeySignificance(
  events: readonly EventRow[],
  except: EventRow | null = null,
): Set<KeySignificance> {
  const taken = new Set<KeySignificance>();
  for (const event of events) {
    if (except && event.id === except.id) continue;
    if (isKeySignificance(event.significance)) taken.add(event.significance);
  }
  return taken;
}
