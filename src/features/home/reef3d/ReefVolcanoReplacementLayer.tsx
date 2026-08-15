import { useLayoutEffect } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';

function markIgnoredSupport(object: THREE.Object3D): void {
  object.traverse((child) => {
    child.userData.reefIgnoreSupport = true;
    if (child instanceof THREE.Mesh) {
      child.geometry.userData.reefIgnoreSupport = true;
    }
  });
}

/**
 * Renderer migration shim for the volcano pass.
 *
 * The old terraced foundation and accepted continuous arch meshes still exist
 * in the production build for diagnostics/history, but the volcano is now the
 * visible central geology. Hide those legacy renderer meshes before passive
 * coral-placement effects run, and mark them so raycasts cannot create floating
 * colonies on invisible surfaces.
 */
export function ReefVolcanoReplacementLayer() {
  const scene = useThree((state) => state.scene);
  const invalidate = useThree((state) => state.invalidate);

  useLayoutEffect(() => {
    const hero = scene.getObjectByName('reef-hero-support');
    if (!hero) return undefined;

    const hidden: THREE.Object3D[] = [];

    hero.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;

      const isTerracedFoundation = object.name === 'reef-terraced-foundation';
      const isLegacyArch = object.geometry.userData.reefSupportSurfaceKind === 'arch'
        || typeof object.geometry.userData.reefSourceArchId === 'string';

      if (!isTerracedFoundation && !isLegacyArch) return;
      object.visible = false;
      object.userData.reefVolcanoReplaced = true;
      object.geometry.userData.reefIgnoreSupport = true;
      hidden.push(object);
    });

    // The first annual zone used to create a small central shelf on top of the
    // stepped foundation. Once the volcano owns the centre, that shelf would
    // read as a geometric cap, so keep its logical record but hide its renderer.
    hero.children.forEach((child) => {
      if (!child.name.startsWith('reef:growth-zone:1:core')) return;
      child.visible = false;
      child.userData.reefVolcanoReplaced = true;
      markIgnoredSupport(child);
      hidden.push(child);
    });

    invalidate();

    return () => {
      hidden.forEach((object) => {
        object.visible = true;
        delete object.userData.reefVolcanoReplaced;
        delete object.userData.reefIgnoreSupport;
        object.traverse((child) => {
          delete child.userData.reefVolcanoReplaced;
          delete child.userData.reefIgnoreSupport;
          if (child instanceof THREE.Mesh) {
            delete child.geometry.userData.reefIgnoreSupport;
          }
        });
      });
      invalidate();
    };
  }, [invalidate, scene]);

  return null;
}
