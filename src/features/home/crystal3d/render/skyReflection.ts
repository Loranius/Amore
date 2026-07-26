// ============================================================
// skyReflection — «скло» БЕЗ карти оточення (Volume VI, рендер-шар).
// ------------------------------------------------------------
// ЧОМУ НЕ ENV MAP. План цієї фази спирався на те, що процедурну
// equirect-текстуру можна віддати як `scene.environment` «без render
// target і без HalfFloat», на відміну від drei `<Environment>` з його
// CubeCamera. Перевірка джерел three.js це СПРОСТУВАЛА:
// `WebGLCubeUVMaps.get()` проганяє через `PMREMGenerator` і equirect-, і
// звичайні cube-текстури, а `PMREMGenerator` створює render target типу
// `HalfFloatType` (`PMREMGenerator.js:273`). Для PBR-матеріалів обійти це
// неможливо: інший шлях є лише в не-PBR матеріалів (Basic/Lambert/Phong),
// які нам не годяться.
//
// Тобто «безпечної» карти оточення не існує — будь-яка веде рівно до того
// класу механізмів (HalfFloat render target), який лишився головним
// підозрюваним у білому фоні на пристрої власника.
//
// ЩО ТУТ НАТОМІСТЬ. Дві речі, які й читаються оком як скло, дає звичайна
// математика прямо в шейдері, без жодного проходу й жодної текстури:
//
//   1. **Френель** — краї тіла яскравіші за середину. Саме це око читає як
//      «прозорий матеріал», навіть коли заломлення немає взагалі;
//   2. **Небо/земля у відбитті** — колір, підмішаний за вертикаллю
//      відбитого променя: холодне світло згори, тепліше знизу. Це імітує
//      найпомітнішу частину будь-якого студійного оточення.
//
// Обидва терми додаються до `outgoingLight` через `onBeforeCompile`, тобто
// поверх фізичної моделі three, а не замість неї.
//
// Справжня карта оточення лишається доступною під `?gfx=env` (render/
// envMap.ts) — але як ДІАГНОСТИКА для пристрою, а не як дефолт.
// ============================================================
import * as THREE from 'three';

export interface SkyReflectionOptions {
  /** Сила френелівського краю (0 — вимкнено). */
  rim: number;
  /** Сила підмішування неба/землі у відбиток. */
  sky: number;
  /** Колір «неба» — те, що відбивається у гранях, повернутих угору. */
  skyColor: THREE.Color;
  /** Колір «землі» — для граней, повернутих униз. */
  groundColor: THREE.Color;
  /** Колір самого френелівського краю. */
  rimColor: THREE.Color;
}

/** Ключ, який мусить входити в підпис батча: два тіла з різними
 *  параметрами відбиття не сміють опинитись в одному батчі. */
export function skyReflectionSignature(o: SkyReflectionOptions): string {
  return [
    o.rim.toFixed(6),
    o.sky.toFixed(6),
    o.skyColor.getHexString(),
    o.groundColor.getHexString(),
    o.rimColor.getHexString(),
  ].join(':');
}

const PARS = /* glsl */ `
uniform float uRimStrength;
uniform float uSkyStrength;
uniform vec3 uSkyColor;
uniform vec3 uGroundColor;
uniform vec3 uRimColor;
`;

// Вставляється ПЕРЕД `<opaque_fragment>`: на цей момент `outgoingLight`
// уже порахований фізичною моделлю, `normal` — після
// `<normal_fragment_begin>`, а `vViewPosition` оголошений самим
// meshphysical.glsl. Нічого свого в шейдер не заводимо.
const BODY = /* glsl */ `
  vec3 viewDir = normalize( vViewPosition );
  float facing = clamp( dot( normal, viewDir ), 0.0, 1.0 );
  // Шліковий наближений френель: (1-cos)^5 — та сама крива, що в
  // фізичній моделі, тож край не сперечається з власним specular.
  float fresnel = pow( 1.0 - facing, 5.0 );

  // Напрямок відбитого променя у ПРОСТОРІ КАМЕРИ; його вертикаль і вирішує,
  // небо там чи земля. Камера кристала майже не нахиляється (OrbitControls
  // без панорами), тож view-space вертикаль достатньо близька до світової,
  // а нормальної матриці для переведення тут не потрібно.
  vec3 reflected = reflect( -viewDir, normal );
  float upness = clamp( reflected.y * 0.5 + 0.5, 0.0, 1.0 );
  vec3 sky = mix( uGroundColor, uSkyColor, upness );

  // Небо підмішується САМЕ по краях (fresnel), як і в справжньому
  // відображенні: у центрі грані видно тіло, скраю — оточення.
  outgoingLight += sky * uSkyStrength * ( 0.25 + 0.75 * fresnel );
  outgoingLight += uRimColor * uRimStrength * fresnel;
`;

/**
 * Вішає френель + небо на матеріал. Викликається один раз на батч
 * (батчі створюються заново при зміні даних, тож накопичення не буде).
 *
 * `customProgramCacheKey` обов'язковий: без нього three перевикористав би
 * скомпільовану програму між матеріалами з різними опціями — і два батчі
 * поділили б чужий шейдер.
 */
export function applySkyReflection(
  material: THREE.MeshPhysicalMaterial,
  options: SkyReflectionOptions,
): void {
  if (options.rim <= 0 && options.sky <= 0) return;

  material.onBeforeCompile = (shader) => {
    shader.uniforms['uRimStrength'] = { value: options.rim };
    shader.uniforms['uSkyStrength'] = { value: options.sky };
    shader.uniforms['uSkyColor'] = { value: options.skyColor };
    shader.uniforms['uGroundColor'] = { value: options.groundColor };
    shader.uniforms['uRimColor'] = { value: options.rimColor };

    shader.fragmentShader = shader.fragmentShader
      .replace('void main() {', `${PARS}\nvoid main() {`)
      .replace('#include <opaque_fragment>', `${BODY}\n#include <opaque_fragment>`);
  };
  const key = skyReflectionSignature(options);
  material.customProgramCacheKey = () => `sky:${key}`;
  material.needsUpdate = true;
}
