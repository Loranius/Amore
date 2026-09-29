// ============================================================
// Лабораторія підводного вулкана — ЕСКІЗ (див. `volcanoSketch.ts`).
// ------------------------------------------------------------
//   /volcano-lab.html                 — та сама пара на 3, 8 і 15 роках
//   /volcano-lab.html?years=12        — один вулкан на весь екран
//   /volcano-lab.html?years=1,5,30    — будь-який ряд
//
// Сторінка не входить у збірку продукту: лише dev-сервер.
// ============================================================
import { useMemo, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import {
  buildLavaVeins,
  buildSeabed,
  buildVolcano,
  coralSpots,
  fishPaths,
  kelpSpots,
  magmaLevel,
  volcanoShape,
  type CoralSpot,
  type FlatMesh,
  type V3,
} from './volcanoSketch';
import { yearsWord } from '@/features/auth/newCouple';
import '@/index.css';

/** Одна пара на всі віки: так видно, як ТОЙ САМИЙ вулкан підростає. */
const SEED = '2012-09-29';
const WATER = '#0f4a5c';

function FlatMeshView({ mesh }: { mesh: FlatMesh }) {
  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(mesh.positions, 3));
    g.setAttribute('color', new THREE.BufferAttribute(mesh.colors, 3));
    g.computeVertexNormals();
    return g;
  }, [mesh]);
  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial vertexColors flatShading roughness={0.85} metalness={0} />
    </mesh>
  );
}

const UP = new THREE.Vector3(0, 1, 0);

function Coral({ spot }: { spot: CoralSpot }) {
  const quaternion = useMemo(() => {
    const dir = new THREE.Vector3(...spot.outward).normalize();
    return new THREE.Quaternion().setFromUnitVectors(UP, dir);
  }, [spot]);
  const s = spot.size;
  const color = new THREE.Color(spot.color);
  return (
    <group position={spot.position} quaternion={quaternion}>
      {spot.kind === 'branch' && [-0.5, 0, 0.5].map((lean, k) => (
        <mesh key={k} position={[lean * s * 0.6, s * 0.7, 0]} rotation={[0, 0, -lean * 0.8]}>
          <cylinderGeometry args={[s * 0.07, s * 0.14, s * (1.5 - Math.abs(lean) * 0.5), 5]} />
          <meshStandardMaterial color={color} flatShading roughness={0.6} emissive={color} emissiveIntensity={0.12} />
        </mesh>
      ))}
      {spot.kind === 'fan' && (
        <mesh position={[0, s * 0.9, 0]} rotation={[0, 0, 0]}>
          <circleGeometry args={[s * 1.1, 6, 0, Math.PI]} />
          <meshStandardMaterial color={color} flatShading side={THREE.DoubleSide} roughness={0.7} emissive={color} emissiveIntensity={0.1} />
        </mesh>
      )}
      {spot.kind === 'brain' && (
        <mesh position={[0, s * 0.25, 0]} scale={[1, 0.65, 1]}>
          <icosahedronGeometry args={[s * 0.75, 0]} />
          <meshStandardMaterial color={color} flatShading roughness={0.75} />
        </mesh>
      )}
    </group>
  );
}

function Kelp({ years }: { years: number }) {
  const spots = useMemo(() => kelpSpots(SEED, years), [years]);
  const refs = useRef<(THREE.Group | null)[]>([]);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    spots.forEach((k, i) => {
      const g = refs.current[i];
      if (!g) return;
      g.rotation.z = Math.sin(t * 0.9 + k.phase) * 0.14;
      g.rotation.x = Math.cos(t * 0.7 + k.phase) * 0.1;
    });
  });
  return (
    <>
      {spots.map((k, i) => (
        <group key={i} position={k.position} ref={(g) => { refs.current[i] = g; }}>
          <mesh position={[0, k.height / 2, 0]}>
            <coneGeometry args={[0.05, k.height, 4, 3]} />
            <meshStandardMaterial color={k.color} flatShading roughness={0.8} />
          </mesh>
          <mesh position={[0.05, k.height * 0.45, 0]} rotation={[0, 0, -0.7]}>
            <coneGeometry args={[0.03, k.height * 0.45, 3]} />
            <meshStandardMaterial color={k.color} flatShading roughness={0.8} />
          </mesh>
        </group>
      ))}
    </>
  );
}

function Fish({ years }: { years: number }) {
  const paths = useMemo(() => fishPaths(SEED, years), [years]);
  const refs = useRef<(THREE.Group | null)[]>([]);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    paths.forEach((f, i) => {
      const g = refs.current[i];
      if (!g) return;
      const a = f.phase + f.speed * t;
      g.position.set(Math.cos(a) * f.radius, f.height + Math.sin(t * 1.3 + f.phase) * 0.06, Math.sin(a) * f.radius);
      // Дивиться вздовж кола, у бік руху.
      g.rotation.set(f.tilt, -a - (f.speed > 0 ? 0 : Math.PI), 0);
    });
  });
  return (
    <>
      {paths.map((f, i) => (
        <group key={i} ref={(g) => { refs.current[i] = g; }}>
          <mesh scale={[0.5, 0.8, 1.6]}>
            <octahedronGeometry args={[f.size, 0]} />
            <meshStandardMaterial color={f.color} flatShading roughness={0.5} emissive={f.color} emissiveIntensity={0.15} />
          </mesh>
          <mesh position={[0, 0, -f.size * 1.7]} rotation={[Math.PI / 2, 0, 0]} scale={[0.25, 1, 1]}>
            <coneGeometry args={[f.size * 0.7, f.size * 0.9, 3]} />
            <meshStandardMaterial color={f.color} flatShading roughness={0.5} />
          </mesh>
        </group>
      ))}
    </>
  );
}

/** Подвійний удар: «серце вулкана» світить двома поштовхами й паузою. */
function heartbeat(t: number): number {
  const p = t % 1.6;
  const beat = (c: number) => Math.exp(-((p - c) ** 2) / 0.004);
  return beat(0.1) + 0.7 * beat(0.35);
}

function Magma({ years }: { years: number }) {
  const { y, radius } = magmaLevel(years);
  const material = useRef<THREE.MeshStandardMaterial>(null);
  const veinMaterial = useRef<THREE.MeshStandardMaterial>(null);
  const light = useRef<THREE.PointLight>(null);
  const veins = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(buildLavaVeins(SEED, years), 3));
    g.computeVertexNormals();
    return g;
  }, [years]);
  useFrame(({ clock }) => {
    const k = heartbeat(clock.elapsedTime);
    if (material.current) material.current.emissiveIntensity = 1.6 + 1.4 * k;
    if (veinMaterial.current) veinMaterial.current.emissiveIntensity = 1.1 + 1.2 * k;
    if (light.current) light.current.intensity = 2.2 + 2.5 * k;
  });
  return (
    <>
      <mesh geometry={veins}>
        <meshStandardMaterial ref={veinMaterial} color="#ff8a5c" emissive="#ff4d6d" emissiveIntensity={1.4} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, y, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[radius, 9]} />
        <meshStandardMaterial ref={material} color="#ff7a45" emissive="#ff4d6d" emissiveIntensity={2} />
      </mesh>
      <pointLight ref={light} position={[0, y + 0.45, 0]} color="#ff7a5c" distance={4} decay={1.4} />
    </>
  );
}

function Bubbles({ years }: { years: number }) {
  const { y } = magmaLevel(years);
  const refs = useRef<(THREE.Mesh | null)[]>([]);
  const count = 9;
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    for (let i = 0; i < count; i += 1) {
      const m = refs.current[i];
      if (!m) continue;
      const life = ((t * 0.35 + i / count) % 1);
      m.position.set(Math.sin(i * 2.4 + t) * 0.12 * life, y + life * 2.2, Math.cos(i * 1.7 + t) * 0.12 * life);
      m.scale.setScalar(0.4 + life);
    }
  });
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <mesh key={i} ref={(m) => { refs.current[i] = m; }}>
          <icosahedronGeometry args={[0.035, 0]} />
          <meshStandardMaterial color="#dffbff" transparent opacity={0.55} roughness={0.1} />
        </mesh>
      ))}
    </>
  );
}

function VolcanoIsland({ years, x }: { years: number; x: number }) {
  const volcano = useMemo(() => buildVolcano(SEED, years), [years]);
  const seabed = useMemo(() => buildSeabed(SEED), []);
  const corals = useMemo(() => coralSpots(SEED, years), [years]);
  const group = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (group.current) group.current.position.y = Math.sin(clock.elapsedTime * 0.5 + x) * 0.05;
  });
  return (
    <group position={[x, 0, 0]}>
      <group ref={group}>
        <FlatMeshView mesh={seabed} />
        <FlatMeshView mesh={volcano} />
        <Magma years={years} />
        <Bubbles years={years} />
        {corals.map((spot, i) => <Coral key={i} spot={spot} />)}
        <Kelp years={years} />
        <Fish years={years} />
      </group>
    </group>
  );
}

/** Промені з поверхні: кілька ледь видимих конусів. */
function LightShafts() {
  const shafts: V3[] = [[-3, 6, -3], [1.5, 6, -4], [5, 6, -2.5], [-6, 6, -1]];
  return (
    <>
      {shafts.map((p, i) => (
        <mesh key={i} position={p} rotation={[0, 0, 0.18 - i * 0.08]}>
          <coneGeometry args={[0.9, 9, 6, 1, true]} />
          <meshBasicMaterial color="#bff3ff" transparent opacity={0.03} depthWrite={false} blending={THREE.AdditiveBlending} side={THREE.DoubleSide} />
        </mesh>
      ))}
    </>
  );
}

function Lab() {
  const raw = new URLSearchParams(window.location.search).get('years') ?? '3,8,15';
  const ages = raw.split(',').map(Number).filter((n) => Number.isFinite(n) && n >= 0);
  const single = ages.length === 1;
  const gap = 4.6;
  const tallest = Math.max(...ages.map((a) => volcanoShape(a).height));
  const camera = single
    ? { position: [0, 3.4 + tallest * 0.8, 10 + tallest * 1.6] as V3, fov: 38 }
    : { position: [0, 5.2, 5.4 + ages.length * 3.2] as V3, fov: 34 };
  return (
    <>
      <Canvas
        dpr={[1, 2]}
        camera={camera}
        onCreated={({ camera: c }) => c.lookAt(0, single ? tallest * 0.45 : 1.1, 0)}
        style={{ position: 'fixed', inset: 0, background: WATER }}
      >
        <color attach="background" args={[WATER]} />
        <fog attach="fog" args={[WATER, 14, 36]} />
        <hemisphereLight args={['#a8ecff', '#1b2a4a', 1.1]} />
        <directionalLight position={[2, 8, 4]} intensity={2} color="#e4fbff" />
        <LightShafts />
        {ages.map((years, i) => (
          <VolcanoIsland key={years} years={years} x={(i - (ages.length - 1) / 2) * gap} />
        ))}
      </Canvas>
      {!single && (
        <div style={{ position: 'fixed', left: 0, right: 0, bottom: 28, display: 'flex', justifyContent: 'space-around', pointerEvents: 'none' }}>
          {ages.map((years) => (
            <span key={years} style={{ color: '#e8fbff', font: '700 18px system-ui', textShadow: '0 1px 4px #0008' }}>
              {years} {yearsWord(years)}
            </span>
          ))}
        </div>
      )}
    </>
  );
}

createRoot(document.getElementById('root')!).render(<Lab />);
