// ============================================================
// Лабораторія Crystal Home — головна сцена кристала без входу.
// ------------------------------------------------------------
// Головна вимагає сесії Supabase, а пісочниця без ключів її не має; тоді
// сцену не можна ні зняти, ні оглянути Three.js DevTools. Тут — ТА САМА
// сцена: `PortalStage` із тими самими пропами камери й `CrystalHomeWorld`,
// який монтує й портал. Відрізняються лише джерела: синтетична пара
// (`labSnapshot`) замість бази.
//
//   /crystal-home-lab.html                    — 8 років, темна тема
//   /crystal-home-lab.html?years=2&theme=light
//   /crystal-home-lab.html?fill=12            — подій на рік
//   /crystal-home-lab.html?noshadows          — без тіней (A/B, слабкий профіль)
//   /crystal-home-lab.html?gift=shared        — колір колонії: red (типово) | blue | shared | none (власний тон пари)
//
// Сторінка не входить у збірку продукту: лише dev-сервер.
// ============================================================
import { useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { Canvas } from '@react-three/fiber';
import { buildCrystalV2Geometry } from '@/engine/species/crystalV2/geometry';
import { buildCrystalV2Model } from '@/engine/species/crystalV2/model';
import { hash32 } from '@/engine/species/crystalV2/hash';
import { PortalStage } from '@/features/home/crystal3d/scene/PortalStage';
import { CrystalHomeWorld } from '@/features/home/crystal3d/v2/CrystalHomeWorld';
import { crystalV2Frame } from '@/features/home/crystal3d/v2/crystalV2Frame';
import { dioramaFrameHeight, dioramaIslandRadius } from '@/features/home/diorama/dioramaStyle';
import { labSnapshot } from './labSnapshot';
import '@/index.css';

const NO_BEARINGS: readonly number[] = [];

function Lab() {
  const params = new URLSearchParams(window.location.search);
  const years = Math.max(0, Number(params.get('years') ?? 8));
  const fill = Math.max(0, Number(params.get('fill') ?? 8));
  const theme = params.get('theme') === 'light' ? 'light' : 'dark';
  document.documentElement.dataset.theme = theme;
  const built = useMemo(() => {
    // Колір колонії — від того, хто виконує бажання. Синтетичні бажання
    // спільні, а це зелений канал; власна колонія власника рожева — її дає
    // канал «червоного» партнера (`?gift=red`, типово). `?gift=shared` —
    // як у `labSnapshot`.
    const base = labSnapshot(years, fill);
    const gift = params.get('gift') ?? 'red';
    const wishes = gift === 'shared' ? base.wishes : gift === 'none' ? [] : base.wishes?.map((wish) => ({
      ...wish,
      isShared: false,
      ownerId: (gift === 'red' ? base.partners.blue : base.partners.red) ?? null,
      fulfilledById: (gift === 'red' ? base.partners.red : base.partners.blue) ?? null,
    }));
    const model = buildCrystalV2Model(wishes ? { ...base, wishes } : base);
    const geometry = buildCrystalV2Geometry(model);
    const frame = crystalV2Frame(geometry);
    return { model, geometry, frame, island: dioramaIslandRadius(frame.reach * 1.3) };
  }, [years, fill]);
  const { model, geometry, frame, island } = built;
  return (
    <div className="lab-stage" data-evolution-preview="ready" data-evolution-runtime="ready">
      <Canvas
        dpr={[1, 2]}
        camera={{ position: [0, 0.685, 7.1], fov: 42 }}
        gl={{ alpha: false, antialias: true }}
        shadows={params.has('noshadows') ? false : 'soft'}
      >
        <PortalStage
          seed={hash32(model.startDate)}
          theme={theme}
          quality="high"
          reduceMotion={params.has('still')}
          artifactSceneRadius={Math.max(frame.reach, island * 0.95)}
          crystalsSceneRadius={Math.max(frame.reach, island * 0.95)}
          artifactSceneHeight={dioramaFrameHeight(frame.height)}
          veinBearings={NO_BEARINGS}
          veinReach={frame.geodeRadius}
          allowOrbit
          world="none"
        >
          <CrystalHomeWorld
            model={model}
            geometry={geometry}
            frame={frame}
            island={island}
            theme={theme}
            reduceMotion={params.has('still')}
            shadows={!params.has('noshadows')}
          />
        </PortalStage>
      </Canvas>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<Lab />);
