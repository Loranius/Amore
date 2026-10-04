// ============================================================
// Стан хроніки росту (ADR-0238) — один на портал.
// ------------------------------------------------------------
// Шторка живе в DOM головної, а камера й об'єкт — у сцені під нею, в
// окремому корені React (`<Canvas>`). Контекст туди не доходить сам (див.
// коментар про `pose` у `PortalStage`), тож стан — зовнішнє сховище з
// підпискою: сцена читає його хуком ЗОВНІ полотна й передає пропом усередину.
//
// Азимут камери сцена пише сюди щокадру без підписки й перемальовування —
// лише щоб у мить відкриття знати, звідки повернути на 90°.
// ============================================================
import { useSyncExternalStore } from 'react';
import type { ActivityKind, CrystalV2Snapshot } from '@/engine/species/crystalV2/model';
import type { HomeArtifact } from '@/features/home/homeArtifact';
import type { ChronicleAnchor } from './anchors';

export interface ChronicleFocus {
  /** Ключ запису або модуля — щоб шторка підсвітила обране. */
  key: string;
  anchor: ChronicleAnchor;
}

export interface ChronicleState {
  open: boolean;
  /** Азимут, на який камера стане при відкритті: поточний ± 90°. */
  azimuth: number;
  /** Показана дата; `null` — сьогодні. */
  asOf: string | null;
  focus: ChronicleFocus | null;
  /** Обраний модуль у шторці. */
  kind: ActivityKind | null;
  /** Що публікує сцена: вид і знімок, з якого він виріс. */
  subject: { species: HomeArtifact; snapshot: CrystalV2Snapshot } | null;
}

const INITIAL: ChronicleState = { open: false, azimuth: 0, asOf: null, focus: null, kind: null, subject: null };

let state: ChronicleState = INITIAL;
const listeners = new Set<() => void>();
/** Азимут камери зараз — пише сцена щокадру (без сповіщень). */
const camera = { azimuth: 0 };

function set(next: Partial<ChronicleState>): void {
  state = { ...state, ...next };
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Стан зараз, без підписки — для обробників подій і тестів. */
export function readChronicle(): ChronicleState {
  return state;
}

export function useChronicle(): ChronicleState {
  return useSyncExternalStore(subscribe, readChronicle, () => INITIAL);
}

export function reportChronicleCamera(azimuth: number): void {
  camera.azimuth = azimuth;
}

/**
 * Відкрити хроніку: камера повертає на чверть оберту від ТОГО місця, де
 * вона стоїть зараз. Бік — з того, де азимут уже ближче (той самий кадр дає
 * той самий бік), тобто «в будь-який бік», але не навмання.
 */
export function openChronicle(): void {
  if (state.open) return;
  const side = Math.sin(camera.azimuth) >= 0 ? 1 : -1;
  set({ open: true, azimuth: camera.azimuth + side * (Math.PI / 2), asOf: null, focus: null, kind: null });
}

export function closeChronicle(): void {
  if (!state.open) return;
  set({ open: false, asOf: null, focus: null, kind: null });
}

export function setChronicleAsOf(asOf: string | null): void {
  if (state.asOf === asOf) return;
  set({ asOf, focus: null });
}

export function focusChronicle(focus: ChronicleFocus | null, kind: ActivityKind | null = state.kind): void {
  set({ focus, kind });
}

export function publishChronicleSubject(subject: ChronicleState['subject']): void {
  const same = state.subject?.species === subject?.species && state.subject?.snapshot === subject?.snapshot;
  if (!same) set({ subject });
}

/** Для тестів: повернути сховище до початку. */
export function resetChronicle(): void {
  state = INITIAL;
  camera.azimuth = 0;
  for (const listener of listeners) listener();
}
