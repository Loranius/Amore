import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import type { CrystalGeometryState } from '@/engine/geometry';
import type { CrystalMaterialState } from '@/engine/material';
import type { ThreeCrystalRenderBundle } from '@/engine/renderer/three';
import { buildWishCrystalGeometry } from './wishCrystalGeometry';
import {
  buildWishBoard,
  wishBoardCentre,
  wishSatelliteBounds,
  type WishCrystal,
  type WishSatelliteQuality,
  type WishSubject,
} from './wishCrystals';

// ============================================================
// Дошка бажань — кожне бажання тілом, із фото всередині граней.
// ------------------------------------------------------------
// **Фото не на поверхні, а в камені.** Координати текстури рахуються з
// положення вершини в об'єктному просторі — площинна проєкція на силует. Тому
// зображення не розсипається по гранях, а читається як одне ціле крізь тіло:
// грані ламають на ньому світло, але не саму картинку. Це і є те, що просив
// власник — «зображення всередині 3D-моделі, але чітко видно».
//
// **Чому не інстансинг.** Дванадцять тіл з однією матрицею коштували б один
// draw call — але в кожного своє фото, тобто своя текстура, тобто свій
// матеріал. Спільна геометрія лишається спільною; окремими є тільки матеріали.
//
// **Батьківство.** Дошка кріпиться до `bundle.content`, як і внутрішні іскри
// (ADR-0019): саме там живе підгонка. Кріплення до `group` коштувало цьому
// проєкту іскор у небі.
// ============================================================

export interface WishCrystalBoardProps {
  bundle: ThreeCrystalRenderBundle;
  geometry: CrystalGeometryState;
  material: CrystalMaterialState;
  wishes: readonly WishSubject[];
  quality: WishSatelliteQuality;
  /** Азимут камери маршруту — дошка стоїть до неї лицем. */
  facing: number;
  reduceMotion: boolean;
  /** Бажання, аркуш якого відкрито — воно виходить уперед (§30). */
  focused?: number | null;
  onSelect?: (wishId: number) => void;
}

/**
 * Текстури бажань, спільні на весь застосунок і на весь час сесії.
 *
 * Це не оптимізація, а виправлення гонки. Спочатку кожне покоління матеріалів
 * заводило власний завантажувач — і на живому порталі виходило так: текстури
 * приходили («ready 970x1040» на кожне фото), а на камені не з'являлось нічого.
 * Причина: матеріали перебудовуються частіше, ніж їде картинка, тож
 * зображення доїжджало в матеріал, який уже знято зі сцени.
 *
 * Спільний об'єкт текстури цю гонку прибирає за побудовою: хто б яким за
 * рахунком не був матеріал, він отримує **той самий** об'єкт, і коли картинка
 * доїде, її побачить той, хто на сцені зараз.
 */
const WISH_TEXTURES = new Map<string, THREE.Texture>();

function wishTexture(url: string): THREE.Texture {
  const cached = WISH_TEXTURES.get(url);
  if (cached !== undefined) return cached;
  const loader = new THREE.TextureLoader();
  loader.setCrossOrigin('anonymous');
  const texture = loader.load(url);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  WISH_TEXTURES.set(url, texture);
  return texture;
}

/**
 * Де стоїть центр дошки, як частка висоти монарха.
 *
 * Збігається з `targetHeight` пози вішліста в атласі (ADR-0021): камера
 * дивиться саме туди, і дошка має бути там, куди дивиться камера.
 */
const BOARD_CENTRE_SHARE = 0.86;

/**
 * Наскільки вибране тіло виходить уперед, а решта відступає (§30).
 *
 * «Slightly» у брифі — не фігура мови: дошка стоїть близько до камери, і
 * рух на власний розмір уже виводить сусідів за край екрана.
 */
const FOCUS_ADVANCE = 0.55;
const FOCUS_GROWTH = 1.22;
const RECEDE = 0.35;
const RECEDE_FADE = 0.32;
/** Період піврозпаду наближення до стану фокуса, секунди. */
const FOCUS_HALF_LIFE = 0.22;

/** Наскільки тіло гойдається, у власних висотах. */
const BOB_AMPLITUDE = 0.055;
const BOB_PERIOD = 6.2;
/** Скільки повних обертів дає перетягування на всю ширину екрана. */
const DRAG_TURNS_PER_SCREEN = 1.6;
/** Далі за це від точки натискання — це вже не тап (ADR-0019, той самий поріг). */
const TAP_SLOP = 12;

/**
 * Радіус включення у власних висотах тіла.
 *
 * Виміряно на живому порталі: менше читалось плямою, більше — торкається
 * граней і перестає бути включенням.
 */
const INCLUSION_RADIUS = 0.19;

/**
 * Фото — включення В камені, і воно нерухоме, поки камінь обертається.
 *
 * Власник сформулював обидві половини: фотографія всередині кристалика,
 * круглою вставкою, **статична, її завжди видно** — а саме тіло повільно
 * крутиться навколо своєї осі.
 *
 * Тому маска рахується не в об'єктному просторі, а у **просторі камери**:
 * зміщення фрагмента від центру тіла, взяте по осях екрана. Обертання тіла на
 * це зміщення не впливає, тож фото стоїть на місці, поки грані пропливають
 * повз нього. В об'єктному просторі (перша редакція) воно оберталося разом із
 * тілом і зникало, щойно кристал ставав ребром до глядача.
 *
 * Шейдер не множить колір на карту — так робить `map` за замовчуванням, і так
 * виходить наліпка на гранях. Він **підмінює** колір усередині круглої маски
 * й лишає камінь каменем зовні.
 */
function includePhoto(material: THREE.MeshPhysicalMaterial): void {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uWishRadius = { value: INCLUSION_RADIUS };
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
         varying vec2 vWishOffset;`,
      )
      .replace(
        '#include <project_vertex>',
        `#include <project_vertex>
         // Центр тіла в просторі камери — і зміщення фрагмента від нього по
         // осях екрана, у власних висотах тіла.
         vec4 wishCentre = modelViewMatrix * vec4( 0.0, 0.0, 0.0, 1.0 );
         float wishScale = length( vec3( modelMatrix[ 1 ][ 0 ], modelMatrix[ 1 ][ 1 ], modelMatrix[ 1 ][ 2 ] ) );
         vWishOffset = ( mvPosition.xy - wishCentre.xy ) / max( wishScale, 1e-5 );`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        'void main() {',
        `uniform float uWishRadius;
         varying vec2 vWishOffset;
         void main() {`,
      )
      .replace(
        '#include <map_fragment>',
        `float wishDistance = length( vWishOffset );
         float wishMask = 1.0 - smoothstep( uWishRadius * 0.94, uWishRadius, wishDistance );
         vec2 wishUv = vWishOffset / ( 2.0 * uWishRadius ) + 0.5;
         vec4 wishTexel = texture2D( map, clamp( wishUv, 0.0, 1.0 ) );
         diffuseColor.rgb = mix( diffuseColor.rgb, wishTexel.rgb, wishMask );
         // Власне рожеве світло каменю всередині вставки гасне, інакше воно
         // лягає плівкою поверх фото й знебарвлює його — рівно те, що видно
         // було на живому порталі, щойно тіла стали рожевими.
         totalEmissiveRadiance *= 1.0 - wishMask * 0.88;
         // А саме включення світиться власним кольором фото: дошка стоїть між
         // камерою й ключовим світлом, і без цього фото тонуло б у тіні.
         totalEmissiveRadiance += wishTexel.rgb * wishMask * 0.9;`,
      );
  };
  material.customProgramCacheKey = () => 'wish-inclusion:view-space';
}



export function WishCrystalBoard({
  bundle,
  geometry,
  material,
  wishes,
  quality,
  facing,
  reduceMotion,
  focused = null,
  onSelect,
}: WishCrystalBoardProps) {
  const group = useRef<THREE.Group>(null);
  // Матеріали — ресурс, і володіє ним ref, а не ефект.
  //
  // Було: `useEffect(() => () => dispose(), [materials])`. У StrictMode ефект
  // монтується двічі, тож перше ж прибирання звільняло матеріали, які лишались
  // на сітках, — а текстури доїжджали вже в мертві об'єкти. На живому порталі
  // це виглядало так: «texture ready» на кожне фото, і жодного фото на камені.
  const owned = useRef<THREE.MeshPhysicalMaterial[]>([]);
  const spins = useRef<Map<number, number>>(new Map());
  const drag = useRef<{ index: number; x: number; y: number; moved: number } | null>(null);
  /** Наскільки кожне тіло вже дійшло до свого стану фокуса, 0..1. */
  const focusEase = useRef<number[]>([]);

  // Скільки місця дає екран на глибині дошки — в одиницях рушія.
  //
  // Береться з живої камери, а не з припущення: кадр будується під артефакт,
  // а не під бажання, і на телефоні сітка у власних розмірах виходила за
  // краї — крайні тіла зрізало, нижній ряд ховався за доком.
  const camera = useThree((state) => state.camera);
  const size = useThree((state) => state.size);
  // Камера приїжджає не одразу: директор веде її в позу маршруту близько
  // секунди (ADR-0022). Дошку рахували один раз, поки камера ще була в
  // стартовій позиції, — і після перезавантаження сторінки вона лишалась
  // побудованою під той перший кадр: два величезні тіла збоку замість сітки.
  //
  // Тому місце дошки перераховується, коли камера справді зрушила. Лічильник,
  // а не позиція в залежностях: позиція міняється щокадру, і меми
  // перебудовувались би шістдесят разів на секунду.
  const [cameraTick, setCameraTick] = useState(0);
  const lastCamera = useRef<THREE.Vector3 | null>(null);
  const bounds = useMemo(() => wishSatelliteBounds(geometry), [geometry]);
  // Де стоїть дошка і скільки місця їй дає екран.
  //
  // Центр беремо на **осі погляду** камери, а не на осі артефакта: камера
  // дивиться під кутом, і центр кадру з віссю каменю не збігається. Виміряно
  // на телефоні — коли дошку центрували на артефакті, праву колонку зрізало.
  const placement = useMemo(() => {
    const fit = Math.max(1e-6, bundle.fit.scale);
    bundle.content.updateWorldMatrix(true, false);
    const axis = wishBoardCentre(bounds, facing, bounds.height * BOARD_CENTRE_SHARE);
    const axisWorld = new THREE.Vector3(axis[0], axis[1], axis[2])
      .applyMatrix4(bundle.content.matrixWorld);
    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    const depth = Math.max(0.2, axisWorld.clone().sub(camera.position).dot(forward));
    const centreWorld = camera.position.clone().add(forward.clone().multiplyScalar(depth));
    const centre = bundle.content.worldToLocal(centreWorld);

    const perspective = camera instanceof THREE.PerspectiveCamera ? camera : null;
    const fov = ((perspective?.fov ?? 42) * Math.PI) / 180;
    const aspect = size.height > 0 ? size.width / size.height : 1;
    const halfHeight = Math.tan(fov / 2) * depth;
    return {
      centre: [centre.x, centre.y, centre.z] as const,
      viewport: { halfWidth: (halfHeight * aspect) / fit, halfHeight: halfHeight / fit },
    };
  }, [camera, size.width, size.height, bundle, bounds, facing, cameraTick]);

  const crystals = useMemo(
    () => buildWishBoard({
      wishes,
      seed: geometry.artifactSeed,
      bounds,
      quality,
      facing,
      viewport: placement.viewport,
      centre: placement.centre,
    }),
    [wishes, geometry.artifactSeed, bounds, quality, facing, placement],
  );

  // Колір — монарха, а не найменшої доньки. Власник просив прямо: бажання
  // мають бути кольору головного кристала. Донька в цієї пари виявилась
  // блідішою, і на екрані тіла читались сірими уламками замість аметиста.
  const donorMaterial = useMemo(() => material.bodies[0] ?? null, [material]);

  // Форма своя (див. `wishCrystalGeometry.ts`) і має висоту рівно 1, тож
  // масштаб інстансу і є бажана висота тіла.
  const shape = useMemo(() => buildWishCrystalGeometry(), []);

  // Один матеріал на бажання: спільна геометрія, різні фото.
  //
  // **Чому не клон матеріалу монарха.** Це була перша спроба, і вона мовчки не
  // працювала: шейдер кристала рахує колір із власних атрибутів фасетів і
  // `map` не вибирає взагалі. Виміряно на живому порталі — текстури
  // завантажувались («texture ready» на кожну), а на камені не з'являлось
  // нічого.
  //
  // Тому тіло бажання бере **оптику** монарха — шорсткість, лак, показник
  // заломлення, іризацію, базовий колір, — але звичайним фізичним матеріалом,
  // який уміє показати картинку. Огранка й силует лишаються тими самими, бо
  // геометрія та сама.
  const materials = useMemo(() => {
    // Попереднє покоління звільняється тут, де точно відомо, що воно вже
    // нікому не належить.
    // Текстури спільні (`WISH_TEXTURES`), тож звільняється лише матеріал.
    for (const item of owned.current) item.dispose();
    owned.current = [];
    if (donorMaterial === null) return [];
    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin('anonymous');
    const stone = new THREE.Color(
      donorMaterial.baseColor.r,
      donorMaterial.baseColor.g,
      donorMaterial.baseColor.b,
    );
    // Світло тіла — теж опублікований колір монарха, а не білий.
    //
    // Це і був той «сірий блідий камінь», який побачив власник: біле власне
    // світло знебарвлює будь-яку базу, і рожевий аметист виходив попелястим.
    // Рушій публікує emissiveColor поруч із baseColor саме для цього — це та
    // сама гама, якою пофарбована друза від виконаних бажань (ADR-0015).
    const glow = new THREE.Color(
      donorMaterial.emissiveColor.r,
      donorMaterial.emissiveColor.g,
      donorMaterial.emissiveColor.b,
    );
    const built = crystals.map((crystal) => {
      const item = new THREE.MeshPhysicalMaterial({
        color: stone,
        roughness: donorMaterial.roughness,
        metalness: donorMaterial.metalness,
        clearcoat: donorMaterial.clearcoat,
        clearcoatRoughness: donorMaterial.clearcoatRoughness,
        ior: donorMaterial.ior,
        reflectivity: donorMaterial.reflectivity,
        iridescence: donorMaterial.iridescence,
        iridescenceIOR: donorMaterial.iridescenceIOR,
        // Тіла дошки стоять МІЖ камерою й артефактом, а ключове світло — за
        // ними. Виміряно: без власного світла вони виходили майже чорними, бо
        // освітлений бік дивився від глядача.
        // Тіла дошки стоять МІЖ камерою й артефактом, а ключове світло — за
        // ними: освітлений бік дивиться від глядача. Виміряно — без власного
        // світла камінь виходив майже чорним.
        emissive: glow,
        emissiveIntensity: 0.55,
      });
      if (crystal.photo !== null) {
        // Камінь лишається каменем: колір той самий, що в доньки монарха, з
        // якої взято форму. Фото живе всередині, круглим включенням.
        item.map = wishTexture(crystal.photo);
        includePhoto(item);
      }
      return item;
    });
    owned.current = built;
    return built;
  }, [donorMaterial, crystals]);

  useEffect(() => () => {
    for (const item of owned.current) item.dispose();
    owned.current = [];
  }, []);

  useEffect(() => () => { shape.dispose(); }, [shape]);

  // Дошка живе в кадрі підгонки, поруч із тілами друзи.
  useEffect(() => {
    const node = group.current;
    if (node === null) return;
    bundle.content.add(node);
    return () => { node.removeFromParent(); };
  }, [bundle]);

  // Напрямок «до камери» в кадрі артефакта — той самий, за яким побудована
  // дошка. Рахується один раз на кадр, а не на тіло.
  const toCameraX = Math.sin(facing);
  const toCameraZ = Math.cos(facing);


  useFrame((state, delta) => {
    // Чи камера ще їде. Поріг у соту частку сцени: менший рух — це дихання
    // світу (§26), і перебудовувати дошку через нього не треба.
    const previous = lastCamera.current;
    if (previous === null) {
      lastCamera.current = camera.position.clone();
    } else if (previous.distanceTo(camera.position) > 0.01) {
      previous.copy(camera.position);
      setCameraTick((tick) => tick + 1);
    }

    const node = group.current;
    if (node === null) return;
    const time = reduceMotion ? 0 : state.clock.elapsedTime;
    // Той самий підхід, що й у директора сцени (ADR-0022): експонента без
    // розкладу. Пара може вибрати друге бажання, не дочекавшись першого, і
    // перервати тут нічого — рух просто змінює ціль.
    const step = reduceMotion ? 1 : 1 - Math.pow(2, -Math.min(delta, 1 / 15) / FOCUS_HALF_LIFE);
    for (let index = 0; index < node.children.length; index += 1) {
      const child = node.children[index];
      const crystal = crystals[index];
      if (!(child instanceof THREE.Mesh) || crystal === undefined) continue;

      // §30: вибране виходить уперед, решта відступає й гасне.
      const wanted = focused === null ? 0 : (crystal.id === focused ? 1 : -1);
      const eased = (focusEase.current[index] ?? 0) + (wanted - (focusEase.current[index] ?? 0)) * step;
      focusEase.current[index] = eased;
      const advance = eased > 0 ? eased * FOCUS_ADVANCE : eased * RECEDE;
      const grow = 1 + Math.max(0, eased) * (FOCUS_GROWTH - 1);
      const material = child.material as THREE.MeshPhysicalMaterial;
      const dim = 1 - Math.max(0, -eased) * RECEDE_FADE;
      if (material.opacity !== dim) {
        material.opacity = dim;
        material.transparent = dim < 1;
        material.needsUpdate = true;
      }

      // Левітація: кожне тіло має власну фазу, тож дошка дихає, а не пульсує.
      const bob = Math.sin(time * ((2 * Math.PI) / BOB_PERIOD) + crystal.bob);
      child.position.x = crystal.position[0] + toCameraX * advance * crystal.size;
      child.position.z = crystal.position[2] + toCameraZ * advance * crystal.size;
      child.scale.setScalar(crystal.size * grow);
      child.position.y = crystal.position[1] + bob * crystal.size * BOB_AMPLITUDE;
      child.rotation.y = crystal.spin + (spins.current.get(index) ?? 0);
      // Дуже повільний власний обіг, поки бажання не чіпають: камінь живий,
      // але не крутиться перед очима.
      if (!reduceMotion) child.rotation.y += time * 0.06;
    }
  });

  if (crystals.length === 0 || materials.length === 0) return null;

  const onPointerDown = (index: number) => (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    drag.current = { index, x: event.clientX, y: event.clientY, moved: 0 };
    // Захоплення вказівника тут було: воно віддавало подальші події полотну, і
    // відпускання до тіла вже не доходило — бажання не відкривалось.
  };

  const onPointerMove = (event: ThreeEvent<PointerEvent>) => {
    const current = drag.current;
    if (current === null) return;
    event.stopPropagation();
    const dx = event.clientX - current.x;
    current.moved += Math.abs(dx) + Math.abs(event.clientY - current.y);
    current.x = event.clientX;
    current.y = event.clientY;
    const width = Math.max(1, window.innerWidth);
    const turn = (dx / width) * Math.PI * 2 * DRAG_TURNS_PER_SCREEN;
    spins.current.set(current.index, (spins.current.get(current.index) ?? 0) + turn);
  };

  const onClick = (index: number) => (event: ThreeEvent<MouseEvent>) => {
    const current = drag.current;
    drag.current = null;
    event.stopPropagation();
    // Тап — це не рух. Той самий поріг, що й у монарха: інакше кожен оберт
    // закінчувався б відкритою карткою.
    if (current !== null && current.moved > TAP_SLOP) return;
    const crystal = crystals[index];
    if (crystal?.id != null) onSelect?.(crystal.id);
  };

  return (
    <group ref={group}>
      {crystals.map((crystal: WishCrystal, index) => (
        <mesh
          key={crystal.id ?? `cluster-${index}`}
          geometry={shape}
          material={materials[index]!}
          position={[crystal.position[0], crystal.position[1], crystal.position[2]]}
          scale={crystal.size}
          renderOrder={crystal.id === focused ? 1 : 0}
          onPointerDown={onPointerDown(index)}
          onPointerMove={onPointerMove}
          onClick={onClick(index)}
          onPointerCancel={() => { drag.current = null; }}
        />
      ))}
    </group>
  );
}
