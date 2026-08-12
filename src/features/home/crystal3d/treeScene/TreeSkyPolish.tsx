import { useEffect, useMemo } from 'react';
import * as THREE from 'three';

export function TreeSkyPolish({ theme }: { theme: 'light' | 'dark' }) {
  const geometry = useMemo(() => {
    const radius = 49.5;
    const sphere = new THREE.SphereGeometry(radius, 40, 20);
    const position = sphere.getAttribute('position');
    const colors = new Float32Array(position.count * 3);
    const zenith = new THREE.Color(theme === 'light' ? '#65b7ec' : '#579fcf');
    const mid = new THREE.Color(theme === 'light' ? '#a9d5ed' : '#92bfd7');
    const horizon = new THREE.Color(theme === 'light' ? '#edf5f2' : '#d9e6e2');
    const color = new THREE.Color();

    for (let i = 0; i < position.count; i += 1) {
      const y = THREE.MathUtils.clamp(position.getY(i) / radius * 0.5 + 0.5, 0, 1);
      if (y < 0.57) color.copy(horizon).lerp(mid, THREE.MathUtils.smoothstep(y, 0.34, 0.57));
      else color.copy(mid).lerp(zenith, THREE.MathUtils.smoothstep(y, 0.57, 0.98));
      const offset = i * 3;
      colors[offset] = color.r;
      colors[offset + 1] = color.g;
      colors[offset + 2] = color.b;
    }
    sphere.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    return sphere;
  }, [theme]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <mesh geometry={geometry} frustumCulled={false} renderOrder={-20}>
      <meshBasicMaterial
        vertexColors
        side={THREE.BackSide}
        transparent
        opacity={0.42}
        depthWrite={false}
        depthTest={false}
        fog={false}
        toneMapped={false}
      />
    </mesh>
  );
}
