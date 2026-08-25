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
import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Color, DoubleSide, FrontSide, InstancedMesh, Object3D, Quaternion, Vector3 } from 'three';
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

/** Вісь і розмах гойдання: течія йде в один бік, як і належить течії. */
const SWAY_AXIS = new Vector3(0, 0, 1);
const SWAY_ANGLE = 0.16;
const SWAY_RATE = 0.55;

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
}

export function ReefUndergrowth({
  plan, standing, lift,
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
        />
      ))}
    </>
  );
}

function GrowthInstances({
  kind, geometry, items, lift, sway,
}: {
  kind: ReefGrowthKind;
  geometry: ReturnType<typeof reefGeometryOf>;
  items: ReefGrowth[];
  lift: number;
  /** Чи гойдає це течія: водорості й трава — так, камінь — ні. */
  sway: boolean;
}): React.JSX.Element | null {
  const mesh = useRef<InstancedMesh>(null);
  const scratch = useMemo(() => new Object3D(), []);

  /*
   * Гойдання — поворот УСЬОГО тіла, а не згин вершин.
   *
   * Згин вимагав би або власного шейдера, або перерахунку вершин на
   * кожному кадрі для кожної стрічки. Поворот цілого тіла коштує один
   * запис матриці, а на вигнутій стрічці читається течією — саме тому
   * стрічка й вигнута.
   */
  useFrame((state) => {
    const instances = mesh.current;
    if (!sway || !instances) return;
    const time = state.clock.elapsedTime;
    items.forEach((growth, index) => {
      place(scratch, growth, lift);
      const phase = growth.spinRad;
      const lean = Math.sin(time * SWAY_RATE + phase) * SWAY_ANGLE
        * (growth.kind === 'weed' ? 1 : 0.45);
      scratch.rotateOnAxis(SWAY_AXIS, lean);
      scratch.updateMatrix();
      instances.setMatrixAt(index, scratch.matrix);
    });
    instances.instanceMatrix.needsUpdate = true;
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
  }, [items, kind, lift, scratch]);

  if (items.length === 0) return null;

  return (
    <instancedMesh ref={mesh} args={[geometry, undefined, items.length]} receiveShadow>
      <meshStandardMaterial
        roughness={kind === 'pebble' ? 0.95 : 0.72}
        side={kind === 'weed' || kind === 'blade' ? DoubleSide : FrontSide}
        metalness={0}
        flatShading
      />
    </instancedMesh>
  );
}
