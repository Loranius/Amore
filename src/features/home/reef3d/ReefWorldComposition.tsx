import { useLayoutEffect } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';

type TransformSnapshot = {
  object: THREE.Object3D;
  position: THREE.Vector3;
  scale: THREE.Vector3;
  visible: boolean;
};

function materialNames(mesh: THREE.Mesh): string[] {
  const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  return materials.map((material) => material.name);
}

export function ReefWorldComposition() {
  const scene = useThree((state) => state.scene);
  const invalidate = useThree((state) => state.invalidate);

  useLayoutEffect(() => {
    const snapshots: TransformSnapshot[] = [];

    scene.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;

      const names = materialNames(object);
      const isArchSupport = object.userData.reefSupportSurfaceKind === 'arch';
      const isGroundedDecoration = object.userData.reefGroundedRock === true;
      const isDistantStone = names.includes('reef-coral-stone-distant');

      if (!isArchSupport && !isGroundedDecoration && !isDistantStone) return;

      snapshots.push({
        object,
        position: object.position.clone(),
        scale: object.scale.clone(),
        visible: object.visible,
      });

      if (isArchSupport) object.visible = false;

      if (isGroundedDecoration) {
        const radialDistance = Math.hypot(object.position.x, object.position.z);
        if (radialDistance < 7.4) {
          object.visible = false;
        } else {
          object.scale.set(
            object.scale.x * 0.38,
            object.scale.y * 0.52,
            object.scale.z * 0.38,
          );
          object.position.y -= 0.26;
        }
      }

      if (isDistantStone && !isGroundedDecoration) object.visible = false;
    });

    scene.updateMatrixWorld(true);
    invalidate();

    return () => {
      for (const snapshot of snapshots) {
        snapshot.object.position.copy(snapshot.position);
        snapshot.object.scale.copy(snapshot.scale);
        snapshot.object.visible = snapshot.visible;
      }
      scene.updateMatrixWorld(true);
      invalidate();
    };
  }, [invalidate, scene]);

  return null;
}
