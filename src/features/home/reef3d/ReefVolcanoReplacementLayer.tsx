import { useLayoutEffect } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * Renderer migration shim for the volcano pass.
 *
 * The terraced foundation remains visible as the foreground reef platform. Only
 * the legacy generated arch meshes are hidden, because ReefNaturalArchLayer now
 * owns the organic stone arches around the volcano. Keeping the foundation also
 * preserves its coral-support surface while the volcano sits farther back in the
 * scene as a mid-background landmark.
 */
export function ReefVolcanoReplacementLayer() {
  const scene = useThree((state) => state.scene);
  const invalidate = useThree((state) => state.invalidate);

  useLayoutEffect(() => {
    const hero = scene.getObjectByName('reef-hero-support');
    if (!hero) return undefined;

    const hidden: THREE.Mesh[] = [];

    hero.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;

      const isLegacyArch = object.geometry.userData.reefSupportSurfaceKind === 'arch'
        || typeof object.geometry.userData.reefSourceArchId === 'string';

      if (!isLegacyArch) return;
      object.visible = false;
      object.userData.reefVolcanoReplaced = true;
      object.geometry.userData.reefIgnoreSupport = true;
      hidden.push(object);
    });

    invalidate();

    return () => {
      hidden.forEach((object) => {
        object.visible = true;
        delete object.userData.reefVolcanoReplaced;
        delete object.geometry.userData.reefIgnoreSupport;
      });
      invalidate();
    };
  }, [invalidate, scene]);

  return null;
}
