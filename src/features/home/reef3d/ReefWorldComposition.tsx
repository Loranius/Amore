import { useLayoutEffect } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';

type TransformSnapshot = {
  object: THREE.Object3D;
  position: THREE.Vector3;
  scale: THREE.Vector3;
};

function materialNames(mesh: THREE.Mesh): string[] {
  const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  return materials.map((material) => material.name);
}

/**
 * Renderer-only composition pass for decorative limestone around the hero reef.
 *
 * Data-driven foundation, arches, terraces and visited-place outcrops keep their
 * authored transforms. Only world-decoration rocks carrying `reefGroundedRock`
 * are reduced and sunk into the seabed. Distant non-grounded stone stacks are
 * compressed vertically so they read as eroded background masses instead of
 * crystal-like spires.
 */
export function ReefWorldComposition() {
  const scene = useThree((state) => state.scene);
  const invalidate = useThree((state) => state.invalidate);

  useLayoutEffect(() => {
    const snapshots: TransformSnapshot[] = [];

    scene.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;

      const names = materialNames(object);
      const isGroundedDecoration = object.userData.reefGroundedRock === true;
      const isDistantStone = names.includes('reef-coral-stone-distant');

      if (!isGroundedDecoration && !isDistantStone) return;

      snapshots.push({
        object,
        position: object.position.clone(),
        scale: object.scale.clone(),
      });

      if (isGroundedDecoration) {
        object.scale.set(
          object.scale.x * 0.58,
          object.scale.y * 0.72,
          object.scale.z * 0.58,
        );
        object.position.y -= 0.18;
      }

      if (isDistantStone && !isGroundedDecoration) {
        object.scale.set(
          object.scale.x * 0.78,
          object.scale.y * 0.58,
          object.scale.z * 0.78,
        );
        object.position.y *= 0.58;
      }
    });

    scene.updateMatrixWorld(true);
    invalidate();

    return () => {
      for (const snapshot of snapshots) {
        snapshot.object.position.copy(snapshot.position);
        snapshot.object.scale.copy(snapshot.scale);
      }
      scene.updateMatrixWorld(true);
      invalidate();
    };
  }, [invalidate, scene]);

  return null;
}
