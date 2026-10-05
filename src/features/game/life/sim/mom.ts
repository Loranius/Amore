// ============================================================
// Мама Лєни — день за розкладом (власник, 2026-10-05: «нехай мама
// періодично ходить по подвір'ю, щось готує, щось робить на городі чи в
// садку, годує курей; вона може бути в себе в кімнаті на ліжку»).
// Чиста функція від часу й пори року: де мама і що робить.
// ============================================================
import type { Season } from './calendar';

export type MomSpot = 'kitchen' | 'garden' | 'orchard' | 'chickens' | 'bench' | 'bed';

export interface MomPlan {
  spot: MomSpot;
  /** Що робить — підпис біля мами. */
  task: string;
  /** На подвір'ї (так) чи в хаті, у своїй кімнаті (ні). */
  outside: boolean;
}

const h = (hh: number, mm = 0) => hh * 60 + mm;

export function momPlan(minute: number, season: Season): MomPlan {
  const winter = season === 'winter';
  if (minute < h(7) || minute >= h(21, 30)) return { spot: 'bed', task: 'спить', outside: false };
  if (minute < h(8)) return { spot: 'kitchen', task: 'готує сніданок', outside: true };
  if (minute < h(10, 30)) return winter ? { spot: 'chickens', task: 'чистить курник', outside: true } : { spot: 'garden', task: 'порається на городі', outside: true };
  if (minute < h(11)) return { spot: 'chickens', task: 'годує курей', outside: true };
  if (minute < h(13)) return { spot: 'kitchen', task: 'варить обід', outside: true };
  if (minute < h(14)) return { spot: 'bed', task: 'відпочиває', outside: false };
  if (minute < h(16)) return winter ? { spot: 'kitchen', task: 'пече пиріжки', outside: true } : { spot: 'orchard', task: season === 'spring' ? 'білить дерева в садку' : 'збирає фрукти в садку', outside: true };
  if (minute < h(17)) return { spot: 'chickens', task: 'годує курей', outside: true };
  if (minute < h(19)) return { spot: 'kitchen', task: 'готує вечерю', outside: true };
  return { spot: 'bench', task: 'сидить на лавці біля хати', outside: true };
}
