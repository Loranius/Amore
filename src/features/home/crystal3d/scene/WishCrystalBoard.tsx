import { useEffect, useMemo, useRef } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import type { CrystalGeometryState } from '@/engine/geometry';
import type { CrystalMaterialState } from '@/engine/material';
import { createThreeCrystalGeometry, type ThreeCrystalRenderBundle } from '@/engine/renderer/three';
import {
  buildWishBoard,
  pickWishDonor,
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
 * Плоска проєкція фото на силует тіла.
 *
 * Власні UV кристала — по-фасетні й в одиницях рушія: вони існують для зерна
 * поверхні, і фото на них розпалось би на клапті. Тут же координата береться з
 * позиції вершини, тобто картинка натягнута на силует цілком.
 */
function projectPhotoUv(geometry: THREE.BufferGeometry): void {
  const position = geometry.getAttribute('position');
  geometry.computeBoundingBox();
  const box = geometry.boundingBox;
  if (box === null) return;
  const spanX = Math.max(1e-6, box.max.x - box.min.x);
  const spanY = Math.max(1e-6, box.max.y - box.min.y);
  const uv = new Float32Array(position.count * 2);
  for (let index = 0; index < position.count; index += 1) {
    uv[index * 2] = (position.getX(index) - box.min.x) / spanX;
    uv[index * 2 + 1] = (position.getY(index) - box.min.y) / spanY;
  }
  geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
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

  const crystals = useMemo(
    () => buildWishBoard({
      wishes,
      seed: geometry.artifactSeed,
      bounds: wishSatelliteBounds(geometry),
      quality,
      facing,
    }),
    [wishes, geometry, quality, facing],
  );

  const donor = useMemo(() => pickWishDonor(geometry), [geometry]);
  const donorMaterial = useMemo(
    () => (donor ? material.bodies.find((body) => body.bodyId === donor.bodyId) ?? null : null),
    [donor, material],
  );

  const shape = useMemo(() => {
    if (donor === null || donorMaterial === null) return null;
    const built = createThreeCrystalGeometry(donor, donorMaterial, geometry.artifactSeed);
    built.computeBoundingBox();
    const box = built.boundingBox;
    if (box === null) return null;
    built.translate(
      -(box.min.x + box.max.x) / 2,
      -(box.min.y + box.max.y) / 2,
      -(box.min.z + box.max.z) / 2,
    );
    projectPhotoUv(built);
    built.computeBoundingBox();
    const height = Math.max(1e-6, (built.boundingBox?.max.y ?? 1) - (built.boundingBox?.min.y ?? 0));
    return { geometry: built, height };
  }, [donor, donorMaterial, geometry.artifactSeed]);

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
        emissive: new THREE.Color(0xffffff),
        emissiveIntensity: 0.3,
      });
      if (crystal.photo !== null) {
        const texture = wishTexture(crystal.photo);
        item.map = texture;
        // Біла база — щоб фото показалось як є, а не крізь колір каменю.
        item.color = new THREE.Color(0xffffff);
        // І воно світиться зсередини: саме це робить картинку читабельною з
        // будь-якого боку, як просив власник, і знімає залежність від того, з
        // якого боку стоїть лампа.
        item.emissiveMap = texture;
        item.emissiveIntensity = 0.6;
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

  useEffect(() => () => { shape?.geometry.dispose(); }, [shape]);

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
  const shapeHeight = shape?.height ?? 1;

  useFrame((state, delta) => {
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
      child.scale.setScalar((crystal.size / shapeHeight) * grow);
      child.position.y = crystal.position[1] + bob * crystal.size * BOB_AMPLITUDE;
      child.rotation.y = crystal.spin + (spins.current.get(index) ?? 0);
      // Дуже повільний власний обіг, поки бажання не чіпають: камінь живий,
      // але не крутиться перед очима.
      if (!reduceMotion) child.rotation.y += time * 0.06;
    }
  });

  if (shape === null || crystals.length === 0 || materials.length === 0) return null;

  const onPointerDown = (index: number) => (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    drag.current = { index, x: event.clientX, y: event.clientY, moved: 0 };
    (event.target as Element | null)?.setPointerCapture?.(event.pointerId);
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

  const onPointerUp = (index: number) => (event: ThreeEvent<PointerEvent>) => {
    const current = drag.current;
    drag.current = null;
    if (current === null || current.index !== index) return;
    event.stopPropagation();
    // Тап — це не рух. Той самий поріг, що й у монарха: інакше кожен оберт
    // закінчувався б відкритою карткою.
    if (current.moved > TAP_SLOP) return;
    const crystal = crystals[index];
    if (crystal?.id != null) onSelect?.(crystal.id);
  };

  return (
    <group ref={group}>
      {crystals.map((crystal: WishCrystal, index) => (
        <mesh
          key={crystal.id ?? `cluster-${index}`}
          geometry={shape.geometry}
          material={materials[index]!}
          position={[crystal.position[0], crystal.position[1], crystal.position[2]]}
          scale={crystal.size / shape.height}
          renderOrder={crystal.id === focused ? 1 : 0}
          onPointerDown={onPointerDown(index)}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp(index)}
          onPointerCancel={() => { drag.current = null; }}
        />
      ))}
    </group>
  );
}
