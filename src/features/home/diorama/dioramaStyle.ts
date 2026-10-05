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
  /** Молочна смуга посередині неба (лише дерево — «небесний сад»). */
  milk?: string;
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
    // «Небесний сад» (власник, 2026-10-05): синє небо → молочні хмари →
    // світлий золотий серпанок → ледь помітні частинки світла.
    light: { top: '#7fc4ef', milk: '#eef5f6', bottom: '#f7e6bd', glow: '#fff8e6', ground: '#9fd66c', cliff: '#c19375', mote: '#fff6c8', moteStrength: 0.45 },
    // Небо дерева ДЕННЕ в будь-якій темі (artifactThemes.css): чорнило шапки над
    // ним темне в обох темах і виміряне проти #7fb8e6. Уночі — вечірня гама
    // того ж світлого неба, а не ніч.
    dark: { top: '#7fb8e6', milk: '#f0e4e0', bottom: '#f3c7a3', glow: '#ffe6b8', ground: '#86c865', cliff: '#b0836c', mote: '#fff0a0', moteStrength: 0.8 },
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
 *
 * Світло й тінь (власник, 2026-10-04: «покращ візуально сцени усіх
 * об'єктів, додай світло і тіні»):
 *   * тепле світло, прохолодна тінь — освітлений бік трохи теплішає, тіньовий
 *     іде в ліловий, а не в сірий, як у мальованих діорамах;
 *   * зворотний бік глибший (до 0.74), але ніколи не чорний;
 *   * широкий м'який відблиск лише на освітленому боці: залежить від
 *     погляду, тож рухається з камерою, а не лежить сталою плямою.
 * Потрібні uniform-и `uKey` (vec3) і `uAmbient` (float).
 */
export const DIORAMA_SHADE = /* glsl */ `
  vec3 dioramaShade(vec3 base, vec3 n, vec3 view) {
    float ndl = dot(n, uKey);
    float wrap = ndl * 0.5 + 0.5;
    float band = mix(wrap, floor(wrap * 3.0 + 0.5) / 3.0, 0.35);
    vec3 c = base * (uAmbient * 0.94 + (1.18 - uAmbient * 0.94) * band);
    c *= mix(vec3(0.84, 0.88, 1.1), vec3(1.06, 1.0, 0.92), smoothstep(0.25, 0.85, wrap));
    c *= mix(0.74, 1.0, smoothstep(0.05, 0.5, wrap));
    vec3 h = normalize(uKey + view);
    float spec = pow(max(0.0, dot(n, h)), 28.0) * 0.16 * step(0.0, ndl);
    c += mix(base, vec3(1.0), 0.6) * spec;
    float rim = pow(1.0 - max(0.0, dot(n, view)), 3.0);
    return c + mix(base, vec3(1.0), 0.4) * rim * 0.3;
  }
`;

/**
 * Радіус острівця — ОДИН для всіх трьох видів (власник: «острів рифу й
 * дерева зрівняй в один розмір з островом кристала, щоб усе виглядало
 * органічно»). Більшим він стає лише тоді, коли предметові на ньому
 * забракло місця (`need` — скільки просить сам вид), тож з роками острів
 * росте разом із тим, що на ньому стоїть, а не за примхою виду.
 */
export const DIORAMA_ISLAND_RADIUS = 1.3;

export function dioramaIslandRadius(need: number): number {
  return Math.max(DIORAMA_ISLAND_RADIUS, Number.isFinite(need) ? need : 0);
}

/**
 * Висота кадру діорами — теж одна на всі види. Камера кадрує за висотою
 * предмета, тож низький риф і молоде дерево знімались ближче за кристал, і
 * однакові острівці виглядали різними. Окремо кадр росте лише тоді, коли
 * предмет з роками переріс спільну висоту.
 */
export const DIORAMA_FRAME_HEIGHT = 1.7;

export function dioramaFrameHeight(own: number): number {
  return Math.max(DIORAMA_FRAME_HEIGHT, Number.isFinite(own) ? own : 0);
}
