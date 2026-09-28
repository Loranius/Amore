// ============================================================
// Діорама — палітри й м'яке світло (ADR-0220).
// ------------------------------------------------------------
// Еталон — Tap Tap Fish AbyssRium: пастельні пласкі грані, світло
// «обгортає» предмет (half-Lambert) замість різкої тіні, ледь помітні
// сходинки тону між гранями, м'яке сяйво по силуету, тло — градієнт із
// сяйвом за предметом. Один шматок GLSL для всіх трьох видів, щоб кристал,
// дерево й риф були з однієї гри.
// ============================================================

export type DioramaSpecies = 'crystal' | 'tree' | 'reef';

export interface DioramaPalette {
  /** Тло: зеніт, низ, сяйво за предметом. */
  top: string;
  bottom: string;
  glow: string;
  /** Острівець: верхівка й скеля під нею. */
  ground: string;
  cliff: string;
  /** Частинки світла довкола. */
  mote: string;
  moteStrength: number;
}

export const DIORAMA_PALETTES: Record<DioramaSpecies, Record<'light' | 'dark', DioramaPalette>> = {
  crystal: {
    // Сутінковий фіолетовий грот референсу власника (ADR-0221). Верх темний:
    // шапка головної над ним — білі літери.
    light: { top: '#4f4596', bottom: '#b69ad8', glow: '#ffd6f2', ground: '#bfe6c8', cliff: '#a597d6', mote: '#ffe6f8', moteStrength: 0.7 },
    dark: { top: '#15123a', bottom: '#3a2a6e', glow: '#ff8fd6', ground: '#4f6aa6', cliff: '#45427f', mote: '#ffc4f0', moteStrength: 0.9 },
  },
  tree: {
    light: { top: '#94d3f2', bottom: '#ffe0bd', glow: '#fff6dc', ground: '#9fd66c', cliff: '#c19375', mote: '#fff6c8', moteStrength: 0.5 },
    // Небо дерева ДЕННЕ в будь-якій темі (artifactThemes.css): чорнило шапки над
    // ним темне в обох темах і виміряне проти #7fb8e6. Уночі — вечірня гама
    // того ж світлого неба, а не ніч.
    dark: { top: '#7fb8e6', bottom: '#f3c7a3', glow: '#ffe6b8', ground: '#86c865', cliff: '#b0836c', mote: '#fff0a0', moteStrength: 0.8 },
  },
  reef: {
    light: { top: '#78e3ea', bottom: '#1c78b4', glow: '#d2fcff', ground: '#f4e3bb', cliff: '#caa0a8', mote: '#e8fdff', moteStrength: 0.55 },
    dark: { top: '#0b2a5e', bottom: '#030920', glow: '#46eaff', ground: '#3c4d7c', cliff: '#403a6e', mote: '#8ff7ff', moteStrength: 1 },
  },
};

/**
 * М'яке світло діорами. `dioramaShade(base, n, view)`:
 *   * half-Lambert: тіньовий бік не йде в чорне, а лишається пастельним;
 *   * легкі сходинки тону (35% до трьох рівнів) — грані читаються гранями,
 *     але без різкого контрасту;
 *   * сяйво по силуету — тією ж барвою, трохи до білого.
 * Потрібні uniform-и `uKey` (vec3) і `uAmbient` (float).
 */
export const DIORAMA_SHADE = /* glsl */ `
  vec3 dioramaShade(vec3 base, vec3 n, vec3 view) {
    float wrap = dot(n, uKey) * 0.5 + 0.5;
    float band = mix(wrap, floor(wrap * 3.0 + 0.5) / 3.0, 0.35);
    vec3 c = base * (uAmbient + (1.05 - uAmbient) * band);
    float rim = pow(1.0 - max(0.0, dot(n, view)), 3.0);
    return c + mix(base, vec3(1.0), 0.4) * rim * 0.3;
  }
`;
