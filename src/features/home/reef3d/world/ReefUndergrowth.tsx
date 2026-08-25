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
import { Color, InstancedMesh, Object3D, Quaternion, Vector3 } from 'three';
import {
  buildReefBladeMesh,
  buildReefPebbleMesh,
  buildReefTuftMesh,
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
  }), []);

  const groups = useMemo(() => {
    const byKind: Record<ReefGrowthKind, ReefGrowth[]> = { blade: [], tuft: [], pebble: [] };
    for (const growth of growths) byKind[growth.kind].push(growth);
    return byKind;
  }, [growths]);

  return (
    <>
      {(['blade', 'tuft', 'pebble'] as const).map((kind) => (
        <GrowthInstances
          key={kind}
          kind={kind}
          geometry={kinds[kind]}
          items={groups[kind]}
          lift={lift}
        />
      ))}
    </>
  );
}

function GrowthInstances({
  kind, geometry, items, lift,
}: {
  kind: ReefGrowthKind;
  geometry: ReturnType<typeof reefGeometryOf>;
  items: ReefGrowth[];
  lift: number;
}): React.JSX.Element | null {
  const mesh = useRef<InstancedMesh>(null);
  const scratch = useMemo(() => new Object3D(), []);

  useLayoutEffect(() => {
    const instances = mesh.current;
    if (!instances) return;
    const colour = new Color();
    const normal = new Vector3();
    const spin = new Quaternion();

    items.forEach((growth, index) => {
      normal.set(growth.normal.x, growth.normal.y, growth.normal.z).normalize();
      // Те, що на куполі, піднімається разом із ним; те, що на піску,
      // лежить на нулі — його нормаль дивиться просто вгору.
      const onHead = growth.normal.y < 0.999 || growth.point.y > 1e-6;
      scratch.position.set(
        growth.point.x,
        growth.point.y + (onHead ? lift : 0),
        growth.point.z,
      );
      scratch.quaternion.setFromUnitVectors(UP, normal);
      spin.setFromAxisAngle(UP, growth.spinRad);
      scratch.quaternion.multiply(spin);
      scratch.scale.setScalar(growth.size);
      scratch.updateMatrix();
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
        metalness={0}
        flatShading
      />
    </instancedMesh>
  );
}
