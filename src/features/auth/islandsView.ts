// ============================================================
// Що показує тло входу (ADR-0230) — окремо від самого полотна.
// ------------------------------------------------------------
// Тип і константи тут, а не в `AuthIslands.tsx`, навмисно: той файл
// тягне three.js і вантажиться ліниво, а екрани реєстрації потрібні
// одразу. Імпорт константи з полотна приніс би весь рушій у перший кадр
// входу.
// ============================================================
import type { DemoIsland, DemoSpecies } from './demoIslands';

export type IslandsMode = 'backdrop' | 'choose' | 'grow';

/** Порядок острівців у ряду вибору — той самий, що й кнопок під ними. */
export const CHOICE_ORDER: readonly DemoSpecies[] = ['crystal', 'tree', 'reef'];

export interface IslandsView {
  mode: IslandsMode;
  /** Розфокус тла, поки попереду питання. */
  defocus: boolean;
  /** Обраний вид у `choose`, або той, що росте, у `grow`. */
  picked: DemoSpecies | null;
  /** Знімок пари для `grow`. */
  grown: DemoIsland | null;
}

export const BACKDROP: IslandsView = { mode: 'backdrop', defocus: false, picked: null, grown: null };
