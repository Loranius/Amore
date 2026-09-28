// ============================================================
// Тло входу: три летючі острівці з тим, що росте всередині (ADR-0228).
// ------------------------------------------------------------
// Кристал, дерево й риф — справжні види порталу, вирощені тими самими
// моделями з вигаданої історії (`demoIslands.ts`), на своїх острівцях у
// «голому» режимі: без неба, храму й променів, які в порталі оточують
// один великий острів. Нове зерно щоразу — кожне відкриття показує інших.
//
// Полотно прозоре й лежить під карткою; якщо WebGL немає, лишається
// градієнт екрана — вхід від тла не залежить.
// ============================================================
import { Component, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import type * as THREE from 'three';
import { buildCrystalV2Model } from '@/engine/species/crystalV2/model';
import { buildCrystalV2Geometry } from '@/engine/species/crystalV2/geometry';
import { buildTreeV2Model } from '@/engine/species/treeV2/model';
import { buildTreeV2Geometry } from '@/engine/species/treeV2/geometry';
import { buildReefV2Model } from '@/engine/species/reefV2/model';
import { buildReefV2Geometry } from '@/engine/species/reefV2/geometry';
import { freshSeed } from '@/lib/entropy';
import { dioramaIslandRadius } from '@/features/home/diorama/dioramaStyle';
import { PORTAL_GROUND_Y } from '@/features/home/crystal3d/scene/portalScene';
import { crystalV2Frame } from '@/features/home/crystal3d/v2/crystalV2Frame';
import { CrystalIsland } from '@/features/home/crystal3d/v2/CrystalIsland';
import { CrystalV2Object } from '@/features/home/crystal3d/v2/CrystalV2Object';
import { linearColour } from '@/features/home/crystal3d/v2/crystalV2Material';
import { treeV2Frame } from '@/features/home/crystal3d/treeV2/treeV2Frame';
import { TreeV2World } from '@/features/home/crystal3d/treeV2/TreeV2World';
import { reefV2Frame } from '@/features/home/reef3d/v2/reefV2Frame';
import { ReefV2World } from '@/features/home/reef3d/v2/ReefV2World';
import { demoIslands, type DemoIsland } from './demoIslands';

interface IslandProps {
  demo: DemoIsland;
  theme: 'light' | 'dark';
  reduceMotion: boolean;
}

/** Острівець із видом; розмір нормовано: радіус острова = 1. */
function SpeciesIsland({ demo, theme, reduceMotion }: IslandProps) {
  const seed = demo.snapshot.startDate;
  const built = useMemo(() => {
    if (demo.species === 'crystal') {
      const model = buildCrystalV2Model(demo.snapshot);
      const geometry = buildCrystalV2Geometry(model);
      const frame = crystalV2Frame(geometry);
      return { kind: 'crystal' as const, model, geometry, frame, island: dioramaIslandRadius(frame.reach * 1.3) };
    }
    if (demo.species === 'tree') {
      const geometry = buildTreeV2Geometry(buildTreeV2Model(demo.snapshot as never));
      const frame = treeV2Frame(geometry);
      return { kind: 'tree' as const, geometry, frame, island: dioramaIslandRadius(frame.reach * 0.9) };
    }
    const model = buildReefV2Model(demo.snapshot);
    const geometry = buildReefV2Geometry(model);
    const frame = reefV2Frame(geometry);
    const rock = model.radius * frame.scale;
    return {
      kind: 'reef' as const, geometry, frame, rock,
      island: dioramaIslandRadius(Math.max(frame.reach * 1.1, rock * 1.55)),
    };
  }, [demo]);

  return (
    <group scale={1 / built.island} position={[0, -PORTAL_GROUND_Y / built.island, 0]}>
      {built.kind === 'crystal' && (
        <>
          <CrystalIsland
            bare
            seed={seed}
            theme={theme}
            radius={built.island}
            groundY={PORTAL_GROUND_Y}
            glowColour={linearColour(built.model.colour.rgb)}
            crystalHeight={built.frame.height}
            reduceMotion={reduceMotion}
          />
          <CrystalV2Object model={built.model} geometry={built.geometry} scale={built.frame.scale} theme={theme} reduceMotion={reduceMotion} />
        </>
      )}
      {built.kind === 'tree' && (
        <TreeV2World bare seed={seed} geometry={built.geometry} scale={built.frame.scale} theme={theme} reduceMotion={reduceMotion} island={built.island} />
      )}
      {built.kind === 'reef' && (
        <ReefV2World
          bare
          seed={seed}
          geometry={built.geometry}
          scale={built.frame.scale}
          theme={theme}
          reduceMotion={reduceMotion}
          island={built.island}
          rockRadius={built.rock}
        />
      )}
    </group>
  );
}

/**
 * Де стоять острівці. На телефоні картка займає середину, тож острівці —
 * над нею й під нею; на широкому екрані — обабіч.
 */
function slots(width: number, height: number): { x: number; y: number; size: number }[] {
  if (width >= height * 0.9) {
    const size = Math.min(width * 0.13, height * 0.2);
    return [
      { x: -width * 0.33, y: height * 0.14, size },
      { x: width * 0.33, y: height * 0.2, size: size * 0.85 },
      { x: width * 0.3, y: -height * 0.26, size: size * 0.7 },
    ];
  }
  // Над карткою мало місця: дерево сягає ~1.6 радіуса острова вгору,
  // тож верхні острівці менші й нижчі — інакше крону зрізав край екрана
  // (перший живий кадр). Їхні підошви ховаються за карткою.
  const size = Math.min(width * 0.2, height * 0.08);
  return [
    { x: -width * 0.22, y: height * 0.31, size },
    { x: width * 0.26, y: height * 0.3, size: size * 0.85 },
    { x: width * 0.02, y: -height * 0.38, size: size * 1.1 },
  ];
}

function Floating({ islands, theme, reduceMotion }: { islands: DemoIsland[]; theme: 'light' | 'dark'; reduceMotion: boolean }) {
  const viewport = useThree((state) => state.viewport);
  const refs = useRef<(THREE.Group | null)[]>([]);
  const places = slots(viewport.width, viewport.height);

  useFrame(({ clock }) => {
    const t = reduceMotion ? 0 : clock.getElapsedTime();
    refs.current.forEach((group, k) => {
      if (!group) return;
      const place = places[k]!;
      // Кожен острівець пливе у своєму темпі: не хором.
      group.position.y = place.y + Math.sin(t * 0.45 + k * 2.1) * place.size * 0.08;
      group.rotation.y = 0.5 + k * 2.2 + t * (0.05 + 0.02 * k);
    });
  });

  return (
    <>
      {islands.map((demo, k) => {
        const place = places[k]!;
        return (
          <group key={demo.species} ref={(g) => { refs.current[k] = g; }} position={[place.x, place.y, 0]} scale={place.size}>
            <SpeciesIsland demo={demo} theme={theme} reduceMotion={reduceMotion} />
          </group>
        );
      })}
    </>
  );
}

/** Без WebGL полотно кидає — тоді тло просто лишається градієнтом. */
class Quiet extends Component<{ children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  override componentDidCatch(error: unknown) {
    console.warn('Тло входу без острівців:', error);
  }
  override render() {
    return this.state.failed ? null : this.props.children;
  }
}

export default function AuthIslands({ theme }: { theme: 'light' | 'dark' }) {
  // Зерно — одне на відкриття сторінки: острівці не міняються посеред вводу.
  const [islands] = useState(() => demoIslands(`demo-${freshSeed()}`, new Date().getFullYear()));
  const [reduceMotion, setReduceMotion] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduceMotion(query.matches);
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  return (
    <div className="auth-islands" aria-hidden="true" data-auth-islands={islands.map((i) => i.species).join(',')}>
      <Quiet>
        <Canvas
          frameloop={reduceMotion ? 'demand' : 'always'}
          dpr={[1, 1.5]}
          camera={{ position: [0, 2.2, 12], fov: 36 }}
          gl={{ alpha: true, antialias: true }}
          onCreated={({ camera }) => camera.lookAt(0, 0, 0)}
        >
          <Floating islands={islands} theme={theme} reduceMotion={reduceMotion} />
        </Canvas>
      </Quiet>
    </div>
  );
}
