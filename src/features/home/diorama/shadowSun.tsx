// ============================================================
// Сонце, що кидає тінь, і маска тіні для намальованих матеріалів (ADR-0243).
// ------------------------------------------------------------
// Острови діорами намальовані, а не освітлені: кожен шейдер має власний
// ключ (`DIORAMA_SHADE`). Від three тут потрібна лише карта тіней уздовж
// того самого ключа — світло має силу нуль, а шейдер бере маску тим самим
// `getShadowMask()`, що й `ShadowMaterial`.
//
// Спільне для кристала (ADR-0243) і вулкана (ADR-0246): одна домовленість
// про тінь, а не дві копії, що розійдуться.
// ============================================================
import { useEffect, useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';

/** Юніформи світла three — без них рендерер не покладе в матеріал карти тіней. */
export function shadowLightUniforms(): Record<string, THREE.IUniform> {
  return THREE.UniformsUtils.clone(THREE.UniformsLib.lights);
}

/** Вершинна частина: оголошення (до `main`) і тіло (після обчислення `w`). */
export const SHADOW_VERTEX_PARS = /* glsl */ `
  #ifdef USE_DIORAMA_SHADOWS
    #include <common>
    #include <shadowmap_pars_vertex>
  #endif
`;

/** `w` — світова позиція вершини (vec4). */
export const SHADOW_VERTEX = /* glsl */ `
  #ifdef USE_DIORAMA_SHADOWS
    vec3 transformedNormal = normalMatrix * normal;
    vec4 worldPosition = w;
    #include <shadowmap_vertex>
  #endif
`;

/** Фрагментна частина: оголошення; далі в `main` — `dioramaShadow(c, n, key, tint)`. */
export const SHADOW_FRAGMENT_PARS = /* glsl */ `
  #ifdef USE_DIORAMA_SHADOWS
    #include <common>
    #include <packing>
    #include <lights_pars_begin>
    #include <shadowmap_pars_fragment>
    #include <shadowmask_pars_fragment>
  #endif
  // Тінь лише там, куди світло й так падає: тіньовий бік уже темний, і
  // подвійна тінь пробивала б у ньому чорну діру.
  vec3 dioramaShadow(vec3 c, vec3 n, vec3 key, vec3 tint) {
    #ifdef USE_DIORAMA_SHADOWS
      float lit = smoothstep(0.0, 0.3, dot(n, key));
      return c * mix(vec3(1.0), tint, (1.0 - getShadowMask()) * lit);
    #else
      return c;
    #endif
  }
`;

/** Тіні — лише там, де пристрій потягне вибірку карти тіней у шейдері. */
export function castsShadows(quality: 'high' | 'balanced' | 'low' | 'fallback'): boolean {
  return quality === 'high' || quality === 'balanced';
}

/** Холодна тінь, а не сіра: тінь у діорамі лілова. */
export const SHADOW_TINT = new THREE.Color(0.56, 0.54, 0.74);

interface ShadowSunProps {
  /** Напрям на світло — той самий ключ, що в шейдерах сцени. */
  direction: THREE.Vector3;
  /** Радіус острова: під нього камера тіні. */
  radius: number;
  groundY: number;
  /** Будь-яка зміна геометрії, що кидає тінь, — карта малюється заново. */
  version: unknown;
}

/**
 * Світло з картою тіней. Острів і об'єкт нерухомі (обертається камера), тож
 * карта малюється лише після зміни `version`, а не щокадру: на телефоні тіні
 * коштують вибірку в шейдері, а не другий прохід сцени.
 */
export function ShadowSun({ direction, radius, groundY, version }: ShadowSunProps) {
  const sun = useMemo(() => {
    const light = new THREE.DirectionalLight(0xffffff, 0);
    light.castShadow = true;
    light.shadow.mapSize.set(1024, 1024);
    // Зсув лише вздовж променя, без `normalBias`: нормалі частини плит
    // дивляться всередину (кришки закручені як прийдеться), і зсув уздовж
    // нормалі заганяв точку під поверхню — уся підлога ставала тінню
    // (виміряно в DevTools: 22.9 % пікселів у «тіні» проти 6.9 % справжньої).
    light.shadow.bias = -0.004;
    light.shadow.normalBias = 0;
    // Розмиття краю дає сам `PCFSoftShadowMap` (полотно з `shadows="soft"`);
    // `shadow.radius` він ігнорує.
    const cam = light.shadow.camera;
    const span = radius * 1.7;
    cam.left = -span;
    cam.right = span;
    cam.top = span;
    cam.bottom = -span;
    cam.near = 0.1;
    cam.far = radius * 12;
    const d = direction.clone().normalize();
    light.position.set(d.x * radius * 5, groundY + d.y * radius * 5, d.z * radius * 5);
    light.target.position.set(0, groundY, 0);
    return light;
  }, [direction, radius, groundY]);
  useEffect(() => () => sun.dispose(), [sun]);
  const gl = useThree((state) => state.gl);
  useEffect(() => {
    gl.shadowMap.autoUpdate = false;
    gl.shadowMap.needsUpdate = true;
  }, [gl, sun, version]);
  return (
    <>
      <primitive object={sun} />
      <primitive object={sun.target} />
    </>
  );
}
