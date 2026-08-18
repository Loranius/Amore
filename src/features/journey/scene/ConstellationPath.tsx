import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  AdditiveBlending,
  CatmullRomCurve3,
  TubeGeometry,
  Vector3,
  type ShaderMaterial,
} from 'three';
import type { Star3D } from '../constellation3d';
import { hslToRgb, type JourneyPalette } from '../journeyPalette';
import { pathReveal, pathSegments, pulsePosition } from './constellationLife';

// ============================================================
// Шлях між подіями.
// ------------------------------------------------------------
// Раніше тут були ВІДРІЗКИ: кожна зірка, крім найпершої за датою, тягла пряму
// лінію до попередньої. Ламана з різкими зламами на кожній події — це і є
// друга половина вади, яку власник назвав «network graph». Перша половина
// (кут від порядку створення) виправлена в `constellation3d`; тут виправлена
// друга: ланцюг проходить одним сплайном, і на зірці він згинається, а не
// ламається.
//
// Це справжня геометрія у сцені, а не накладений SVG. Різниця не декоративна:
// накладений шар не має глибини, тож ділянка шляху, яка мала б пройти ЗА
// зіркою, малювалась би поверх неї, і сузір'я миттєво читалось би пласким.
//
// **Один виклик малювання на весь шлях.** `TubeGeometry` будується раз на
// зміну набору подій; поява й імпульс живуть в уніформах, тобто щокадру не
// перебудовується нічого.
//
// Крива навмисно стримана. `CatmullRomCurve3` із натягом 0.5 («centripetal»)
// не робить петель на різких поворотах — а вони тут неминучі, бо ядро стоїть
// у нулі осі, збоку від власного місця в ланцюгу.
// ============================================================

/**
 * Товщина шляху. Помітно тонша за найдрібнішу зірку — це зв'язок, не подія.
 *
 * Зменшено з 0.16 після виміру у focus-режимі: труба має сталу товщину у
 * СВІТІ, тож здалеку вона стрічка, а впритул — смуга через увесь кадр. На
 * розкритій події вона виходила помітнішою за саму подію.
 */
const PATH_RADIUS = 0.12;
/** Скільки поперечних граней у труби. П'ять досить: труба тонша за піксель здалеку. */
const PATH_SIDES = 5;

const PATH_VERTEX = /* glsl */ `
  varying vec2 vPath;
  void main() {
    vPath = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

/**
 * Поява й імпульс — обидва по ДОВЖИНІ труби, тобто по `uv.x`.
 *
 * `TubeGeometry` розкладає `uv.x` рівномірно за параметром кривої, тож
 * контрольна точка `i` лежить рівно на `i / (n − 1)`. Саме на цьому й
 * тримається `pathReveal`, і саме тому поява не потребує ні перебудови
 * геометрії, ні `drawRange`.
 */
const PATH_FRAGMENT = /* glsl */ `
  varying vec2 vPath;
  uniform vec3 uColour;
  uniform float uReveal;
  uniform float uPulse;
  uniform float uOpacity;
  void main() {
    if (vPath.x > uReveal) discard;
    // Кінчик прокладеної частини гасне, а не обрізається ножем.
    float tip = smoothstep(uReveal, uReveal - 0.012, vPath.x);
    // Вузька світла смуга, що йде від найдавнішої події до найновішої.
    float band = uPulse < 0.0 ? 0.0 : exp(-pow((vPath.x - uPulse) / 0.045, 2.0));
    vec3 colour = uColour * (1.0 + band * 2.6);
    gl_FragColor = vec4(colour, uOpacity * tip * (1.0 + band * 1.8));
  }
`;

export interface ConstellationPathProps {
  /** Зірки в порядку ЛАНЦЮГА, тобто за датою. */
  chain: readonly Star3D[];
  palette: JourneyPalette;
  /** Секунди від початку сцени. Реф, а не значення: див. шапку `JourneyScene`. */
  clock: { current: number };
  reducedMotion: boolean;
}

export function ConstellationPath({
  chain,
  palette,
  clock,
  reducedMotion,
}: ConstellationPathProps) {
  const materialRef = useRef<ShaderMaterial>(null);

  const geometry = useMemo(() => {
    if (chain.length < 2) return null;
    const points = chain.map((star) => new Vector3(star.x, star.y, star.z));
    // `centripetal` — не смак, а запобіжник: `chordal` і `catmullrom` роблять
    // петлю на різкому повороті, а ядро в нулі осі саме такий поворот і дає.
    const curve = new CatmullRomCurve3(points, false, 'centripetal', 0.5);
    return new TubeGeometry(curve, pathSegments(chain.length), PATH_RADIUS, PATH_SIDES, false);
  }, [chain]);

  useEffect(() => () => geometry?.dispose(), [geometry]);

  const orders = useMemo(() => chain.map((star) => star.order), [chain]);
  const colour = useMemo(() => hslToRgb(palette.path), [palette.path]);

  useFrame(() => {
    const material = materialRef.current;
    if (!material) return;
    const revealed = reducedMotion ? 1 : pathReveal(orders, clock.current);
    material.uniforms.uReveal!.value = revealed;
    // Пара просила спокою — імпульсу немає взагалі, а не «повільніший».
    material.uniforms.uPulse!.value = reducedMotion
      ? -1
      : pulsePosition(clock.current, revealed);
  });

  if (!geometry) return null;

  return (
    <mesh geometry={geometry} frustumCulled={false} renderOrder={1}>
      <shaderMaterial
        ref={materialRef}
        vertexShader={PATH_VERTEX}
        fragmentShader={PATH_FRAGMENT}
        uniforms={{
          uColour: { value: colour },
          uReveal: { value: 0 },
          uPulse: { value: -1 },
          // Шлях — це зв'язок, а не подія. Він мусить читатись, лишаючись
          // тихішим за будь-яку зірку, інакше сузір'я стає схемою.
          uOpacity: { value: 0.42 },
        }}
        transparent
        depthWrite={false}
        blending={AdditiveBlending}
        toneMapped={false}
      />
    </mesh>
  );
}
