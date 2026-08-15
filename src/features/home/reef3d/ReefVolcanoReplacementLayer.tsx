import { useLayoutEffect } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';

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
