// ============================================================
// Лабораторія росту кристала (ADR-0237) — справжня модель і світ.
// ------------------------------------------------------------
// Та сама пара на кількох віках поруч; форма — друза або сталагміт.
// Сцена — `CrystalIsland` + `CrystalV2Object` без храму (`bare`).
//
//   /crystal-growth-lab.html                          — 1, 4, 8, 15, 30 років, друза
//   /crystal-growth-lab.html?form=stalagmite          — сталагміт
//   /crystal-growth-lab.html?days=12                  — дванадцять спільних вихідних на рік (друзи)
//
// Сторінка не входить у збірку продукту: лише dev-сервер.
// ============================================================
import { useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { Canvas } from '@react-three/fiber';
import { CRYSTAL_FORMS, buildCrystalV2Geometry, type CrystalForm } from '@/engine/species/crystalV2/geometry';
import { buildCrystalV2Model } from '@/engine/species/crystalV2/model';
import { PORTAL_GROUND_Y } from '@/features/home/crystal3d/scene/portalScene';
import { crystalV2Frame } from '@/features/home/crystal3d/v2/crystalV2Frame';
import { CrystalIsland } from '@/features/home/crystal3d/v2/CrystalIsland';
import { CrystalV2Object } from '@/features/home/crystal3d/v2/CrystalV2Object';
import { linearColour } from '@/features/home/crystal3d/v2/crystalV2Material';
import { dioramaIslandRadius } from '@/features/home/diorama/dioramaStyle';
import { yearsWord } from '@/features/auth/newCouple';
import { labSnapshot } from './labSnapshot';
import '@/index.css';

function Island({ years, fill, days, theme, x, form }: { years: number; fill: number; days: number; theme: 'light' | 'dark'; x: number; form: CrystalForm }) {
  const built = useMemo(() => {
    const base = labSnapshot(years, fill);
    const startYear = Number(base.startDate.slice(0, 4));
    const daysOff = Array.from({ length: years * days }, (_, k) => `${startYear + Math.floor(k / days)}-07-${String(1 + (k % days)).padStart(2, '0')}`)
      .filter((d) => d <= base.asOf);
    const model = buildCrystalV2Model({ ...base, daysOff });
    const geometry = buildCrystalV2Geometry(model, form);
    const frame = crystalV2Frame(geometry);
    return { model, geometry, frame, island: dioramaIslandRadius(frame.reach * 1.3) };
  }, [years, fill, days, form]);
  const k = 1 / 2.4;
  return (
    <group position={[x, 0, 0]} scale={k}>
      <group position={[0, -PORTAL_GROUND_Y, 0]}>
        <CrystalIsland
          bare
          seed={built.model.startDate}
          theme={theme}
          radius={built.island}
          groundY={PORTAL_GROUND_Y}
          glowColour={linearColour(built.model.colour.rgb)}
          crystalHeight={built.frame.height}
          reduceMotion
          druses={built.model.druses}
        />
        <CrystalV2Object model={built.model} geometry={built.geometry} scale={built.frame.scale} theme={theme} reduceMotion />
      </group>
    </group>
  );
}

function Lab() {
  const params = new URLSearchParams(window.location.search);
  const ages = (params.get('years') ?? '1,4,8,15,30').split(',').map(Number).filter((n) => Number.isFinite(n) && n >= 0);
  const fill = Number(params.get('fill') ?? 4);
  const days = Number(params.get('days') ?? 2);
  const theme = params.get('theme') === 'light' ? 'light' : 'dark';
  const asked = params.get('form');
  const form: CrystalForm = CRYSTAL_FORMS.includes(asked as CrystalForm) ? (asked as CrystalForm) : 'druse';
  const gap = 2.2;
  const sky = theme === 'light' ? '#d9cff2' : '#241a3d';
  return (
    <>
      <Canvas
        dpr={[1, 2]}
        camera={{ position: [0, 1.3, 3.6 + ages.length * 1.3], fov: 34 }}
        onCreated={({ camera }) => camera.lookAt(0, 0.4, 0)}
        gl={{ alpha: false }}
        style={{ position: 'fixed', inset: 0, background: sky }}
      >
        <color attach="background" args={[sky]} />
        <ambientLight intensity={0.8} />
        <directionalLight position={[3, 6, 4]} intensity={1.4} />
        {ages.map((years, i) => (
          <Island key={years} years={years} fill={fill} days={days} theme={theme} form={form} x={(i - (ages.length - 1) / 2) * gap} />
        ))}
      </Canvas>
      <div style={{ position: 'fixed', left: 0, right: 0, bottom: 24, display: 'flex', justifyContent: 'space-around', pointerEvents: 'none' }}>
        {ages.map((years) => (
          <span key={years} style={{ color: theme === 'light' ? '#2a1d4a' : '#f3ecff', font: '700 17px system-ui' }}>
            {years} {yearsWord(years)}
          </span>
        ))}
      </div>
    </>
  );
}

createRoot(document.getElementById('root')!).render(<Lab />);
