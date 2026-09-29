// ============================================================
// Лабораторія підводного вулкана (ADR-0235) — справжня модель і світ.
// ------------------------------------------------------------
// Та сама пара (сталий день початку) на кількох віках поруч: так видно, як
// ТОЙ САМИЙ вулкан підростає, а не три різні. Сцена — `VolcanoWorld`, той
// самий, що в порталі, лише без глибини навколо (`bare`), як на екрані входу.
//
//   /volcano-lab.html                        — 3, 8, 15, 30 років, історія «середня»
//   /volcano-lab.html?years=1,5,12&fill=0    — порожня історія: росте лише час
//   /volcano-lab.html?fill=12&theme=light    — насичена історія, світла тема
//
// Сторінка не входить у збірку продукту: лише dev-сервер.
// ============================================================
import { useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { Canvas } from '@react-three/fiber';
import type { CrystalV2Snapshot } from '@/engine/species/crystalV2/model';
import { buildVolcanoGeometry } from '@/engine/species/volcano/geometry';
import { buildVolcanoModel } from '@/engine/species/volcano/model';
import { PORTAL_GROUND_Y } from '@/features/home/crystal3d/scene/portalScene';
import { VolcanoWorld } from '@/features/home/volcano3d/VolcanoWorld';
import { volcanoFrame, volcanoIsland } from '@/features/home/volcano3d/volcanoFrame';
import { yearsWord } from '@/features/auth/newCouple';
import '@/index.css';

const START = '1990-03-14';

/** Синтетична пара: `fill` подій на рік, рівно розкиданих по модулях і місяцях. */
export function labSnapshot(years: number, fill: number): CrystalV2Snapshot {
  const startYear = Number(START.slice(0, 4));
  const asOf = `${startYear + years}-03-20`;
  const at = (year: number, k: number) => {
    const month = String(1 + ((k * 5 + year) % 12)).padStart(2, '0');
    const day = String(2 + ((k * 7) % 26)).padStart(2, '0');
    return `${startYear + year + (Number(month) < 3 ? 1 : 0)}-${month}-${day}`;
  };
  const memories: { id: number; date: string }[] = [];
  const plans: { id: number; date: string }[] = [];
  const wishes: { id: number; date: string; isShared: boolean }[] = [];
  const places: { id: number; date: string }[] = [];
  const media: { id: number; date: string }[] = [];
  let id = 0;
  for (let year = 0; year < years; year += 1) {
    for (let k = 0; k < fill; k += 1) {
      const date = at(year, k);
      if (date > asOf) continue;
      const kind = (year + k) % 5;
      if (kind === 2) wishes.push({ id: id++, date, isShared: true });
      else [memories, plans, memories, places, media][kind]!.push({ id: id++, date });
    }
  }
  return { startDate: START, asOf, partners: { red: 2, blue: 1 }, memories, plans, wishes, places, media };
}

function Island({ years, fill, theme, x }: { years: number; fill: number; theme: 'light' | 'dark'; x: number }) {
  const built = useMemo(() => {
    const model = buildVolcanoModel(labSnapshot(years, fill));
    const geometry = buildVolcanoGeometry(model);
    const frame = volcanoFrame(geometry);
    const rock = model.baseRadius * frame.scale;
    return { model, geometry, frame, rock, island: volcanoIsland(frame) };
  }, [years, fill]);
  // Спільний масштаб на всі віки: розмір вулкана видно, а не нормовано.
  const k = 1 / 2.6;
  return (
    <group position={[x, 0, 0]} scale={k}>
      <group position={[0, -PORTAL_GROUND_Y, 0]}>
        <VolcanoWorld
          bare
          seed={built.model.startDate}
          geometry={built.geometry}
          scale={built.frame.scale}
          theme={theme}
          reduceMotion={false}
          island={built.island}
          rockRadius={built.rock}
          glow={built.model.glow}
        />
      </group>
    </group>
  );
}

function Lab() {
  const params = new URLSearchParams(window.location.search);
  const ages = (params.get('years') ?? '3,8,15,30').split(',').map(Number).filter((n) => Number.isFinite(n) && n >= 0);
  const fill = Number(params.get('fill') ?? 4);
  const theme = params.get('theme') === 'light' ? 'light' : 'dark';
  const gap = 2.3;
  return (
    <>
      <Canvas
        dpr={[1, 2]}
        camera={{ position: [0, 1.4, 4.2 + ages.length * 1.35], fov: 34 }}
        onCreated={({ camera }) => camera.lookAt(0, 0.35, 0)}
        gl={{ alpha: false }}
        style={{ position: 'fixed', inset: 0, background: theme === 'light' ? '#8fd0e6' : '#0a2a5a' }}
      >
        <color attach="background" args={[theme === 'light' ? '#8fd0e6' : '#0a2a5a']} />
        {ages.map((years, i) => (
          <Island key={years} years={years} fill={fill} theme={theme} x={(i - (ages.length - 1) / 2) * gap} />
        ))}
      </Canvas>
      <div style={{ position: 'fixed', left: 0, right: 0, bottom: 24, display: 'flex', justifyContent: 'space-around', pointerEvents: 'none' }}>
        {ages.map((years) => (
          <span key={years} style={{ color: '#f2fbff', font: '700 17px system-ui', textShadow: '0 1px 4px #0009' }}>
            {years} {yearsWord(years)}
          </span>
        ))}
      </div>
    </>
  );
}

createRoot(document.getElementById('root')!).render(<Lab />);
