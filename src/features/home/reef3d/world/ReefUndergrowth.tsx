// ============================================================
// Жива шкіра рифа в сцені: три інстанси на все.
// ------------------------------------------------------------
// Пучки, кульки й камінці — по одному інстансованому мешу на вид, із
// кольором на інстанс. Сто п'ятдесят одиниць дрібноти коштують ТРИ
// виклики малювання.
//
// Поворот кожної одиниці — по нормалі поверхні, на якій вона сидить.
// Без цього трава на схилі купола росла б крізь камінь убік, і це
// читалось би вадою, а не рифом.
// ============================================================
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  applyReefSwayPhases,
  createReefGrowthMaterial,
  setReefSwayFrame,
} from './reefUndergrowthSway';
import { Color, InstancedMesh, Object3D, Quaternion, Vector3 } from 'three';
import {
  buildReefBladeMesh,
  buildReefPebbleMesh,
  buildReefTuftMesh,
  buildReefWeedMesh,
} from '@/engine/species/reef/undergrowthMesh';
import {
  REEF_LIFE_COLOURS,
  REEF_PEBBLE_COLOUR,
  reefUndergrowth,
  type ReefGrowth,
  type ReefGrowthKind,
} from '@/engine/species/reef/undergrowth';
import type { ReefPlan } from '@/engine/species/reef/reefAssembly';
import type { ReefStanding } from '@/engine/species/reef/reefStaging';
import { reefGeometryOf } from './reefGeometry';

const UP = new Vector3(0, 1, 0);

/*
 * Вісь, розмах і темп течії переїхали у `reefUndergrowthSway.ts`, бо їх тепер
 * читає GLSL. Числа не змінились — це те саме гойдання, лише рахує його
 * відеокарта.
 */

const SCRATCH_NORMAL = new Vector3();
const SCRATCH_SPIN = new Quaternion();

/** Поставити тіло на його місце — спільне для першого кадру й гойдання. */
function place(target: Object3D, growth: ReefGrowth, lift: number): void {
  SCRATCH_NORMAL.set(growth.normal.x, growth.normal.y, growth.normal.z).normalize();
  // Те, що на куполі, піднімається разом із ним; те, що на піску,
  // лежить на нулі — його нормаль дивиться просто вгору.
  const onHead = growth.normal.y < 0.999 || growth.point.y > 1e-6;
  target.position.set(
    growth.point.x,
    growth.point.y + (onHead ? lift : 0),
    growth.point.z,
  );
  target.quaternion.setFromUnitVectors(UP, SCRATCH_NORMAL);
  SCRATCH_SPIN.setFromAxisAngle(UP, growth.spinRad);
  target.quaternion.multiply(SCRATCH_SPIN);
  target.scale.setScalar(growth.size);
  target.updateMatrix();
}

interface ReefUndergrowthProps {
  plan: ReefPlan;
  standing: ReefStanding;
  /** Підйом голови: те, що сидить на куполі, їде разом із ним. */
  lift: number;
  /**
   * Зменшена анімація.
   *
   * Цього тут не було, і зелень гойдалась завжди — єдина зі своїх сусідів:
   * риби, порошинки й згасання орбіти `reduceMotion` поважали.
   */
  reduceMotion: boolean;
}

export function ReefUndergrowth({
  plan, standing, lift, reduceMotion,
}: ReefUndergrowthProps): React.JSX.Element {
  const growths = useMemo(
    () => reefUndergrowth(plan.head, standing, plan.colonies.length, plan.headSeed),
    [plan.colonies.length, plan.head, plan.headSeed, standing],
  );

  const kinds = useMemo(() => ({
    blade: reefGeometryOf(buildReefBladeMesh()),
    tuft: reefGeometryOf(buildReefTuftMesh()),
    pebble: reefGeometryOf(buildReefPebbleMesh()),
    weed: reefGeometryOf(buildReefWeedMesh()),
  }), []);

  const groups = useMemo(() => {
    const byKind: Record<ReefGrowthKind, ReefGrowth[]> = {
      blade: [], tuft: [], pebble: [], weed: [],
    };
    for (const growth of growths) byKind[growth.kind].push(growth);
    return byKind;
  }, [growths]);

  return (
    <>
      {(['blade', 'tuft', 'pebble', 'weed'] as const).map((kind) => (
        <GrowthInstances
          key={kind}
          kind={kind}
          geometry={kinds[kind]}
          items={groups[kind]}
          lift={lift}
          sway={kind === 'weed' || kind === 'blade'}
          reduceMotion={reduceMotion}
        />
      ))}
    </>
  );
}

function GrowthInstances({
  kind, geometry, items, lift, sway, reduceMotion,
}: {
  kind: ReefGrowthKind;
  geometry: ReturnType<typeof reefGeometryOf>;
  items: ReefGrowth[];
  lift: number;
  /** Чи гойдає це течія: водорості й трава — так, камінь — ні. */
  sway: boolean;
  reduceMotion: boolean;
}): React.JSX.Element | null {
  const mesh = useRef<InstancedMesh>(null);
  const scratch = useMemo(() => new Object3D(), []);
  const surface = useMemo(() => createReefGrowthMaterial(kind, sway), [kind, sway]);
  useEffect(() => () => surface.material.dispose(), [surface]);

  /*
   * Гойдання — поворот УСЬОГО тіла, а не згин вершин, і тепер його рахує
   * вершинний шейдер.
   *
   * Тут стояв покадровий обхід: кожне тіло ставилось на місце заново
   * (позиція, два кватерніони, масштаб, збірка матриці), докручувався нахил
   * течії, матриця збиралась удруге й записувалась — після чого весь буфер
   * їхав на відео. Виміряно: 59 стрічок і 18 водоростей, тобто 77 тіл за
   * кадр, і кожне дорожче за листок дерева, бо збірок матриці дві.
   *
   * Тепер за кадр міняється ОДНЕ число на вид — час. Фаза кожного тіла
   * лежить в атрибуті інстанса, а матриці статичні від першого кадру.
   *
   * Стара приписка казала, що згин вимагав би власного шейдера, і тому
   * обрано поворот цілого тіла. Шейдер тепер є — але поворот лишається той
   * самий, до останнього знака: це перенесення, а не переробка вигляду.
   */
  useFrame((state) => {
    if (!sway || !surface.uniforms) return;
    setReefSwayFrame(surface.uniforms, kind, state.clock.elapsedTime, reduceMotion);
  });

  useLayoutEffect(() => {
    const instances = mesh.current;
    if (!instances) return;
    const colour = new Color();

    items.forEach((growth, index) => {
      place(scratch, growth, lift);
      instances.setMatrixAt(index, scratch.matrix);

      const rgb = kind === 'pebble'
        ? REEF_PEBBLE_COLOUR
        : REEF_LIFE_COLOURS[growth.colourIndex] ?? REEF_LIFE_COLOURS[0]!;
      instances.setColorAt(index, colour.setRGB(rgb[0], rgb[1], rgb[2]));
    });

    instances.instanceMatrix.needsUpdate = true;
    if (instances.instanceColor) instances.instanceColor.needsUpdate = true;
    if (sway) applyReefSwayPhases(instances, items.map((growth) => growth.spinRad));
  }, [items, kind, lift, scratch, sway]);

  if (items.length === 0) return null;

  return (
    <instancedMesh
      ref={mesh}
      args={[geometry, surface.material, items.length]}
      receiveShadow
    />
  );
}
