import { useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';

const WHALE_URL = `${import.meta.env.BASE_URL}models/glow_whale_background.glb`;

/**
 * Distant bioluminescent whale for the underwater background.
 *
 * The source GLB is intentionally optimized for this role: the reef only needs a
 * readable silhouette, colour and emissive pattern at distance, so the original
 * heavy asset is reduced before being shipped to mobile clients.
 */
export function BackgroundWhale({ reducedMotion }: { reducedMotion: boolean }) {
  const routeRef = useRef<THREE.Group>(null);
  const modelRef = useRef<THREE.Group>(null);
  const indicatorRef = useRef<THREE.Mesh>(null);
  const gltf = useGLTF(WHALE_URL);

  const whale = useMemo(() => {
    const cloned = gltf.scene.clone(true);

    cloned.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      child.castShadow = false;
      child.receiveShadow = false;
    });

    return cloned;
  }, [gltf.scene]);

  useFrame(({ clock, camera }) => {
    const route = routeRef.current;
    const model = modelRef.current;
    const indicator = indicatorRef.current;
    if (!route || !model || !indicator) return;

    if (reducedMotion) {
      route.position.set(6.2, 3.05, -10.4);
      model.rotation.set(0.035, -Math.PI / 2, -0.02);
      indicator.scale.setScalar(1);
      indicator.quaternion.copy(camera.quaternion);
      return;
    }

    const t = clock.getElapsedTime();
    const progress = (t * 0.018) % 1;

    // The whale crosses behind the reef slowly, then resets while already
    // outside the useful camera framing. The small Y/Z drift prevents it from
    // feeling like a model sliding on rails.
    route.position.set(
      THREE.MathUtils.lerp(10.5, -10.5, progress),
      3.1 + Math.sin(t * 0.28) * 0.24,
      -10.8 + Math.sin(t * 0.16) * 0.62,
    );

    model.rotation.set(
      0.035 + Math.sin(t * 0.24) * 0.025,
      -Math.PI / 2 + Math.sin(t * 0.13) * 0.07,
      Math.sin(t * 0.31) * 0.035,
    );

    // A quiet diegetic indicator: no HUD label, just a cyan pulse that makes the
    // distant whale discoverable through fog without competing with the hero reef.
    const pulse = 0.92 + Math.sin(t * 1.9) * 0.12;
    indicator.scale.setScalar(pulse);
    indicator.quaternion.copy(camera.quaternion);
  });

  return (
    <group ref={routeRef} name="reef-background-whale">
      <group ref={modelRef} scale={11.5}>
        <primitive object={whale} />
      </group>

      <mesh ref={indicatorRef} position={[0, 0.72, 0]} renderOrder={3}>
        <ringGeometry args={[0.075, 0.12, 24]} />
        <meshBasicMaterial
          color="#8df3ff"
          transparent
          opacity={0.52}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

useGLTF.preload(WHALE_URL);
