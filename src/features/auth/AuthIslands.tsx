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
//
// РЕЖИМИ (ADR-0230, реєстрація нової пари):
//   • `backdrop` — тло входу; під час питань реєстрації ще й розфокусоване
//     (`defocus`), бо попереду картка й дивитись треба на неї;
//   • `choose` — вибір виду: острівці підпливають ближче, стають у ряд
//     (кристал, дерево, риф), виходять із розфокусу й обертаються з
//     легкою левітацією; обраний трохи більший;
//   • `grow` — обраний вид один посередині, вирощений зі знімка САМОЇ
//     пари (її минулих років), і росте з маленького до повного.
// Переходи — не стрибки: кожен острівець тягнеться до цілі щокадру.
// ============================================================
import { Component, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import type * as THREE from 'three';
import { buildCrystalV2Model } from '@/engine/species/crystalV2/model';
import { buildCrystalV2Geometry } from '@/engine/species/crystalV2/geometry';
import { buildTreeV2Model } from '@/engine/species/treeV2/model';
import { buildTreeV2Geometry } from '@/engine/species/treeV2/geometry';
import { buildVolcanoModel } from '@/engine/species/volcano/model';
import { buildVolcanoGeometry } from '@/engine/species/volcano/geometry';
import { freshSeed } from '@/lib/entropy';
import { dioramaIslandRadius } from '@/features/home/diorama/dioramaStyle';
import { PORTAL_GROUND_Y } from '@/features/home/crystal3d/scene/portalScene';
import { crystalV2Frame } from '@/features/home/crystal3d/v2/crystalV2Frame';
import { CrystalIsland } from '@/features/home/crystal3d/v2/CrystalIsland';
import { CrystalV2Object } from '@/features/home/crystal3d/v2/CrystalV2Object';
import { linearColour } from '@/features/home/crystal3d/v2/crystalV2Material';
import { treeV2Frame } from '@/features/home/crystal3d/treeV2/treeV2Frame';
import { TreeV2World } from '@/features/home/crystal3d/treeV2/TreeV2World';
import { volcanoFrame, volcanoIsland } from '@/features/home/volcano3d/volcanoFrame';
import { VolcanoWorld } from '@/features/home/volcano3d/VolcanoWorld';
import { demoIslands, type DemoIsland, type DemoSpecies } from './demoIslands';

import { BACKDROP, CHOICE_ORDER, type IslandsView } from './islandsView';
import { useCanvasRecovery } from '@/features/world/canvasRecovery';

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
    // Місце рифу — підводний вулкан (ADR-0235).
    const model = buildVolcanoModel(demo.snapshot);
    const geometry = buildVolcanoGeometry(model);
    const frame = volcanoFrame(geometry);
    const rock = model.baseRadius * frame.scale;
    return {
      kind: 'reef' as const, geometry, frame, rock, glow: model.glow, fishKinds: model.fishKinds,
      island: volcanoIsland(frame),
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
            druses={built.model.druses}
          />
          <CrystalV2Object model={built.model} geometry={built.geometry} scale={built.frame.scale} theme={theme} reduceMotion={reduceMotion} />
        </>
      )}
      {built.kind === 'tree' && (
        <TreeV2World bare seed={seed} geometry={built.geometry} scale={built.frame.scale} theme={theme} reduceMotion={reduceMotion} island={built.island} />
      )}
      {built.kind === 'reef' && (
        <VolcanoWorld
          bare
          seed={seed}
          geometry={built.geometry}
          scale={built.frame.scale}
          theme={theme}
          reduceMotion={reduceMotion}
          island={built.island}
          rockRadius={built.rock}
          glow={built.glow}
          fishKinds={built.fishKinds}
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

/**
 * Ряд вибору: острівці ближче й більші, ніж на тлі, над карткою, що
 * опускається вниз екрана. Обраний — трохи більший за сусідів.
 */
function choiceSlots(width: number, height: number): { x: number; y: number; size: number }[] {
  const wide = width >= height * 0.9;
  const size = wide ? Math.min(width * 0.105, height * 0.19) : Math.min(width * 0.17, height * 0.12);
  // Посередині вільного неба над компактною карткою (≈ верхні 2/3 екрана).
  const y = height * 0.16;
  // Телефон: 0.28, а не 0.31 — обраний острів (×1.22) крайнього ряду
  // інакше зрізав край екрана (живий кадр 2026-09-29).
  const step = wide ? width * 0.27 : width * 0.28;
  return CHOICE_ORDER.map((_, k) => ({ x: (k - 1) * step, y, size }));
}

/** Один острів посередині — той, що росте з історії пари. */
function growSlot(width: number, height: number): { x: number; y: number; size: number } {
  const wide = width >= height * 0.9;
  return { x: 0, y: wide ? height * 0.08 : height * 0.14, size: wide ? Math.min(width * 0.2, height * 0.3) : Math.min(width * 0.33, height * 0.17) };
}

/** Ціль острівця в поточному режимі; `hidden` — сховати (масштаб у нуль). */
function targetOf(
  view: IslandsView,
  species: DemoSpecies,
  index: number,
  width: number,
  height: number,
): { x: number; y: number; size: number } {
  if (view.mode === 'choose') {
    const slot = choiceSlots(width, height)[CHOICE_ORDER.indexOf(species)]!;
    const scale = view.picked === null ? 1 : view.picked === species ? 1.22 : 0.82;
    return { ...slot, size: slot.size * scale };
  }
  if (view.mode === 'grow') {
    // Демо-острівці відпливають убік і зникають — сцена лише для пари.
    const slot = choiceSlots(width, height)[CHOICE_ORDER.indexOf(species)]!;
    return { x: slot.x * 1.6, y: slot.y, size: 0 };
  }
  return slots(width, height)[index]!;
}

/** Згасання до цілі щокадру: плавно на будь-якій частоті кадрів. */
const approach = (from: number, to: number, dt: number, rate: number) => to + (from - to) * Math.exp(-dt * rate);

function Floating({ islands, theme, reduceMotion, view }: {
  islands: DemoIsland[];
  theme: 'light' | 'dark';
  reduceMotion: boolean;
  view: IslandsView;
}) {
  const viewport = useThree((state) => state.viewport);
  const refs = useRef<(THREE.Group | null)[]>([]);
  const grownRef = useRef<THREE.Group | null>(null);
  const initial = slots(viewport.width, viewport.height);

  useFrame(({ clock }, delta) => {
    const t = reduceMotion ? 0 : clock.getElapsedTime();
    // `delta` після вкладки у фоні буває секундами — тоді просто стаємо в ціль.
    const dt = reduceMotion ? 10 : Math.min(delta, 0.1);
    const choosing = view.mode === 'choose';
    refs.current.forEach((group, k) => {
      if (!group) return;
      const demo = islands[k]!;
      const target = targetOf(view, demo.species, k, viewport.width, viewport.height);
      const bob = choosing ? 0.12 : 0.08;
      group.position.x = approach(group.position.x, target.x, dt, 3);
      const baseY = approach(group.userData.baseY ?? group.position.y, target.y, dt, 3);
      group.userData.baseY = baseY;
      // Кожен острівець пливе у своєму темпі: не хором.
      group.position.y = baseY + Math.sin(t * 0.45 + k * 2.1) * Math.max(target.size, 0.001) * bob;
      const size = approach(group.scale.x, target.size, dt, 3);
      group.scale.setScalar(Math.max(size, 0.0001));
      group.visible = size > 0.002;
      // У виборі обертаються помітніше: їх розглядають, а не минають.
      group.rotation.y = 0.5 + k * 2.2 + t * (choosing ? 0.35 : 0.05 + 0.02 * k);
    });
    const grown = grownRef.current;
    if (grown) {
      const slot = growSlot(viewport.width, viewport.height);
      const size = approach(grown.scale.x, view.mode === 'grow' ? slot.size : 0, dt, 1.2);
      grown.scale.setScalar(Math.max(size, 0.0001));
      grown.visible = size > 0.002;
      grown.position.set(slot.x, slot.y + Math.sin(t * 0.5) * slot.size * 0.06, 0);
      grown.rotation.y = 0.4 + t * 0.3;
    }
  });

  return (
    <>
      {islands.map((demo, k) => {
        const place = initial[k]!;
        return (
          <group key={demo.species} ref={(g) => { refs.current[k] = g; }} position={[place.x, place.y, 0]} scale={place.size}>
            <SpeciesIsland demo={demo} theme={theme} reduceMotion={reduceMotion} />
          </group>
        );
      })}
      {view.grown && (
        <group ref={grownRef} scale={0.0001}>
          <SpeciesIsland demo={view.grown} theme={theme} reduceMotion={reduceMotion} />
        </group>
      )}
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

export default function AuthIslands({ theme, view = BACKDROP }: { theme: 'light' | 'dark'; view?: IslandsView }) {
  // Зерно — одне на відкриття сторінки: острівці не міняються посеред вводу.
  const [islands] = useState(() => demoIslands(`demo-${freshSeed()}`, new Date().getFullYear()));
  const recovery = useCanvasRecovery();
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
    <div
      className={`auth-islands${view.defocus ? ' is-defocused' : ''}`}
      aria-hidden="true"
      data-auth-islands={islands.map((i) => i.species).join(',')}
      data-islands-mode={view.mode}
    >
      <Quiet>
        <Canvas
          key={recovery.key}
          frameloop={reduceMotion ? 'demand' : 'always'}
          dpr={[1, 1.5]}
          camera={{ position: [0, 2.2, 12], fov: 36 }}
          gl={{ alpha: true, antialias: true }}
          onCreated={(state) => {
            state.camera.lookAt(0, 0, 0);
            recovery.onCreated(state);
          }}
        >
          <Floating islands={islands} theme={theme} reduceMotion={reduceMotion} view={view} />
        </Canvas>
      </Quiet>
    </div>
  );
}
