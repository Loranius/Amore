import { AdditiveBlending, ShaderMaterial } from 'three';
import {
  declaredUniforms,
  RIM_GAIN,
  stellarSignature,
  STELLAR_FRAGMENT,
  STELLAR_VERTEX,
  type StellarDetail,
} from './stellarSurface';

// ============================================================
// Матеріал розкритої події.
// ------------------------------------------------------------
// Тонка фабрика над `stellarSurface`: сам шейдер живе там, тут — його стан.
//
// Матеріал створюється НА КОЖЕН показ. Спокуса тримати один і міняти уніформу
// велика, але тоді дві події ділили б одну одиницю стану, і колір попередньої
// встиг би блимнути на наступній під час переходу. Ціна — один `dispose()`,
// і за ним стежить `useEffect`.
//
// Запечена текстура з `sun.glb` більше не читається взагалі, і це рішення, а
// не недогляд: вона нерухома, а власник просив поверхню, що живе. Геометрія
// асета лишається — форма й розгортка й далі його.
// ============================================================

export interface FocusStarMaterialOptions {
  /** Колір події, три числа 0…1. */
  colour: readonly [number, number, number];
  /** Насіння події, 0…1 — з нього зсув візерунка й густота плям. */
  seed: number;
  /** Наскільки проявлене сонце, 0…1 — веде перехід LOD. */
  opacity?: number;
  /** Профіль пристрою. Слабкий бере вдвічі менше октав шуму. */
  detail?: StellarDetail;
}

export function createFocusStarMaterial(options: FocusStarMaterialOptions): ShaderMaterial {
  const signature = stellarSignature(options.seed);
  return new ShaderMaterial({
    vertexShader: STELLAR_VERTEX,
    fragmentShader: STELLAR_FRAGMENT[options.detail ?? 'full'],
    uniforms: {
      // Новий об'єкт на кожен показ: спільний масив зробив би дві події однією
      // одиницею стану, і колір попередньої блимнув би на наступній.
      uColour: { value: [...options.colour] },
      uOpacity: { value: options.opacity ?? 1 },
      uTime: { value: 0 },
      uSeed: { value: [...signature.offset] },
      uSpots: { value: signature.spots },
      uRim: { value: RIM_GAIN },
    },
    transparent: true,
    // Глибину сонце ПИШЕ, і це не дрібниця. Без цього шлях сузір'я, що
    // проходить позаду події, малювався поверх її диска — на живому екрані це
    // виглядало подряпиною через усе сонце. Куля опукла й малюється лише
    // передніми гранями, тож подвійного додавання це не дає.
    depthWrite: true,
    // Сонце світиться, а не відбиває: воно додається до неба за ним, а не
    // закриває його прямокутником темряви на краях прозорості.
    blending: AdditiveBlending,
    toneMapped: false,
  });
}

export { declaredUniforms };
