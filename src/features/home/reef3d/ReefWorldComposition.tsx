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

function hasAncestor(object: THREE.Object3D, name: string): boolean {
  let parent = object.parent;
  while (parent) {
    if (parent.name === name) return true;
    parent = parent.parent;
  }
  return false;
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
      const isHeroShelf = names.includes('reef-coral-stone-hero')
        && hasAncestor(object, 'reef-hero-support');

      if (
        !isArchSupport
        && !isGroundedDecoration
        && !isDistantStone
        && !isHeroShelf
      ) return;

      snapshots.push({
        object,
        position: object.position.clone(),
        scale: object.scale.clone(),
        visible: object.visible,
      });

      if (isArchSupport) object.visible = false;

      if (isHeroShelf) {
        const horizontalScale = Math.max(object.scale.x, object.scale.z, 1e-6);
        const tallMass = object.scale.y / horizontalScale > 0.48;
        const horizontalFactor = tallMass ? 1.28 : 1.12;
        const verticalFactor = tallMass ? 0.44 : 0.68;
        object.scale.set(
          object.scale.x * horizontalFactor,
          object.scale.y * verticalFactor,
          object.scale.z * horizontalFactor,
        );
        object.position.y -= tallMass ? 0.12 : 0.055;
      }

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
