// ============================================================
// Зграя в сцені: два виклики малювання на всіх риб.
// ------------------------------------------------------------
// Тіла — один інстансований меш із кольором на інстанс, очі — другий,
// увесь чорний. Двадцять дві риби коштують два виклики; стара сцена
// малювала зграю окремими об'єктами з власним шейдером плавання.
//
// ЧАС ЖИВЕ ТУТ, А НЕ В РУШІЇ. Рушій віддав орбіту (радіус, висота,
// нахил, фаза, швидкість) — де риба саме зараз, рахується з годинника
// кадру. Так вимагає контракт детермінізму: у рушії немає годинника й
// не має бути.
// ============================================================
import { useLayoutEffect, useMemo, useRef } from 'react';
import { Color, InstancedMesh, Matrix4, Object3D } from 'three';
import { useFrame } from '@react-three/fiber';
import { buildReefFishEyeMesh, buildReefFishMesh } from '@/engine/species/reef/fishMesh';
import { REEF_FISH_COLOURS, reefFishSchool } from '@/engine/species/reef/fishSchool';
import type { ReefPlan } from '@/engine/species/reef/reefAssembly';
import { reefGeometryOf } from './reefGeometry';

interface ReefSchoolProps {
  plan: ReefPlan;
  /** На яку висоту піднято риф — зграя ходить навколо нього, не навколо нуля. */
  lift: number;
  reduceMotion: boolean;
}

export function ReefSchool({ plan, lift, reduceMotion }: ReefSchoolProps): React.JSX.Element | null {
  const school = useMemo(() => reefFishSchool(plan), [plan]);
  const bodyGeometry = useMemo(() => reefGeometryOf(buildReefFishMesh()), []);
  const eyeGeometry = useMemo(() => reefGeometryOf(buildReefFishEyeMesh()), []);
  const bodies = useRef<InstancedMesh>(null);
  const eyes = useRef<InstancedMesh>(null);
  const scratch = useMemo(() => new Object3D(), []);
  const matrix = useMemo(() => new Matrix4(), []);

  /*
   * Колір ставиться раз: він не залежить ні від часу, ні від пари.
   * `useLayoutEffect`, а не `useEffect`, щоб перший же кадр був
   * кольоровий — інакше зграя блимає білим.
   */
  useLayoutEffect(() => {
    const mesh = bodies.current;
    if (!mesh) return;
    const colour = new Color();
    school.forEach((fish, index) => {
      const rgb = REEF_FISH_COLOURS[fish.colourIndex] ?? REEF_FISH_COLOURS[0]!;
      mesh.setColorAt(index, colour.setRGB(rgb[0], rgb[1], rgb[2]));
    });
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [school]);

  const place = (seconds: number): void => {
    const body = bodies.current;
    const eye = eyes.current;
    if (!body) return;

    school.forEach((fish, index) => {
      const angle = fish.phaseRad + seconds * fish.spinPerSecond * Math.PI * 2;
      const x = Math.cos(angle) * fish.orbitRadius;
      const z = Math.sin(angle) * fish.orbitRadius;
      // Нахил площини кола: зграя не пласка, інакше вона читається
      // каруселлю.
      const y = lift + fish.height + Math.sin(angle) * fish.orbitRadius * Math.sin(fish.tiltRad);

      scratch.position.set(x, y, z);
      /*
       * Ніс — по дотичній до кола, у бік руху. Похідна кола дає
       * (-sin, cos), а знак швидкості каже, у який бік цією дотичною
       * пливуть.
       */
      const way = Math.sign(fish.spinPerSecond) || 1;
      scratch.lookAt(
        x - Math.sin(angle) * fish.orbitRadius * way,
        y,
        z + Math.cos(angle) * fish.orbitRadius * way,
      );
      scratch.scale.setScalar(fish.length);
      scratch.updateMatrix();
      matrix.copy(scratch.matrix);
      body.setMatrixAt(index, matrix);
      if (eye) eye.setMatrixAt(index, matrix);
    });

    body.instanceMatrix.needsUpdate = true;
    if (eye) eye.instanceMatrix.needsUpdate = true;
  };

  // Перший кадр: без цього зграя стоїть у початку координат, доки не
  // піде час — а при приглушеному русі не піде ніколи.
  useLayoutEffect(() => { place(0); });

  useFrame((state) => {
    if (reduceMotion) return;
    place(state.clock.elapsedTime);
  });

  if (school.length === 0) return null;

  return (
    <group>
      <instancedMesh ref={bodies} args={[bodyGeometry, undefined, school.length]}>
        <meshStandardMaterial roughness={0.55} metalness={0} flatShading />
      </instancedMesh>
      <instancedMesh ref={eyes} args={[eyeGeometry, undefined, school.length]}>
        {/* Крапка має лишатись чорною при будь-якому світлі: це око, а
            не поверхня. */}
        <meshBasicMaterial color="#0a0c10" />
      </instancedMesh>
    </group>
  );
}
