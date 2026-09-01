// ============================================================
// Лабораторія кристала — окремий вхід, без порталу.
// ------------------------------------------------------------
// НАВІЩО. `amore-crystal-look` тримається на одному правилі: міряй,
// перш ніж крутити. Кожну справжню причину скарги «кристал виглядає
// пласким» знайшов піксельний скан, і жодного разу це не було те число,
// по яке потягнулась би рука. Але зняти кристал досі можна було лише
// через живий портал: підняти сервер, залогінитись справжнім PIN'ом,
// дочекатись семи запитів. Тобто найдорожча передумова стояла перед
// найчастішою дією — а в пісочниці без ключів вона не виконується
// взагалі, і вимір ставав неможливим саме тоді, коли потрібен.
//
// Тут немає ані Supabase, ані маршрутизатора, ані входу. Джерела
// синтетичні (`applyEvolutionSandboxSources` — той самий генератор, яким
// користується пісочниця власника), ланцюг станів той самий
// (`buildCrystalPipelineStates`), сцена та сама (`PortalStage`).
//
// САМЕ ТОЙ САМИЙ — це головне. Друга копія показувала б схожий кристал,
// і жодне число з неї не було б доказом про портал.
//
// Сторінка НЕ входить у збірку продукту: вона є лише на dev-сервері,
// тобто пара її не бачить і не платить за неї жодним байтом.
// ============================================================
import { StrictMode, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { Canvas } from '@react-three/fiber';
import { crystalVeinBearings } from '@/engine/geometry';
import { crystalRenderScale } from '@/engine/renderer';
import {
  crystalSceneHeight,
  crystalSceneRadius,
  crystalSubstrateSceneRadius,
} from '@/engine/renderer/three';
import type { CrystalMaterialQuality } from '@/engine/material';
import { PortalStage } from '@/features/home/crystal3d/scene/PortalStage';
import { EvolutionCrystalObject } from '@/features/home/crystal3d/evolution/EvolutionCrystalObject';
import { EvolutionRuntimeProbe } from '@/features/home/crystal3d/evolution/EvolutionRuntimeProbe';
import { buildCrystalPipelineStates } from '@/features/home/crystal3d/evolution/crystalPipeline';
import {
  applyEvolutionSandboxSources,
  type EvolutionSandboxValues,
} from '@/features/home/evolutionSandbox';
import { crystalPoseForRegion } from '@/features/world/crystalAtlas';
import '@/index.css';

/** Той самий день для всіх прогонів: вимір не має залежати від того, коли його зробили. */
const AS_OF = '2026-09-01T00:00:00.000Z';

const DAYS_PER_YEAR = 365.2425;

/**
 * Скільки чого має синтетична пара.
 *
 * Числа — не «щоб було»: це історія, яка ЗАПОВНЮЄ роки, бо порожній рік
 * дає тіло мінімального розміру, а міряти треба той кристал, який пара
 * справді бачить. Міняються через рядок запиту.
 */
function valuesFrom(params: URLSearchParams, years: number): EvolutionSandboxValues {
  const num = (key: string, fallback: number) => {
    const raw = params.get(key);
    const parsed = raw === null ? Number.NaN : Number(raw);
    return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : fallback;
  };
  return {
    relationshipDays: Math.round(years * DAYS_PER_YEAR),
    calendarEvents: num('calendar', years * 6),
    completedPlans: num('plans', years * 4),
    fulfilledWishes: num('wishes', years * 5),
    visitedPlaces: num('places', years * 7),
    memories: num('memories', years * 12),
    finishedMedia: num('media', years * 9),
    sharedDaysOff: num('daysOff', years * 30),
  };
}

function CrystalLab() {
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const years = Math.max(1, Math.min(50, Number(params.get('years') ?? 4) || 4));
  const quality = (params.get('quality') ?? 'high') as CrystalMaterialQuality;
  const theme = params.get('theme') === 'light' ? 'light' : 'dark';

  const states = useMemo(() => {
    const sources = applyEvolutionSandboxSources({
      enabled: true,
      values: valuesFrom(params, years),
      asOf: AS_OF,
      relationshipStartedAt: '2015-06-10',
      snapshot: {
        calendarEvents: [], plans: [], wishlistItems: [],
        mapPlaces: [], memories: [], memoryLinks: [], media: [],
      },
    });
    return buildCrystalPipelineStates({
      coupleId: 'amore-couple:lab',
      asOf: AS_OF,
      relationshipStartedAt: sources.relationshipStartedAt,
      snapshot: sources.snapshot,
      sharedDaysOff: sources.sharedDaysOff,
      quality,
      reducedMotion: false,
    });
  }, [params, years, quality]);

  const veinBearings = useMemo(
    () => crystalVeinBearings(states.geometry.meshes),
    [states.geometry.meshes],
  );
  const radius = crystalSceneRadius(states.geometry);

  return (
    <div className="lab-stage" data-evolution-preview="ready">
      <Canvas
        dpr={[1, crystalRenderScale(quality, window.devicePixelRatio)]}
        camera={{ position: [0, 0.685, 7.1], fov: 42 }}
        gl={{ alpha: true, antialias: quality !== 'fallback' }}
      >
        <PortalStage
          seed={states.geometry.artifactSeed}
          theme={theme}
          quality={quality}
          reduceMotion={false}
          artifactSceneRadius={radius}
          crystalsSceneRadius={radius}
          artifactSceneHeight={crystalSceneHeight(states.geometry)}
          veinBearings={veinBearings}
          veinReach={crystalSubstrateSceneRadius(states.geometry)}
          pose={crystalPoseForRegion('centre')}
          spin={0}
          allowOrbit={false}
          freeCamera={false}
          motionMode={{ current: 'idle' }}
        >
          <EvolutionCrystalObject
            geometry={states.geometry}
            material={states.material}
            life={states.life}
            substrateVisible={false}
          />
          {/*
            * Публікує сцену й КРИВУ ТОНУВАННЯ. Без другого вимір світла
            * обертав би криву, якої не застосовували: R3F ставить ACES за
            * замовчуванням, але `flat` на полотні це вимикає — і мовчки.
            */}
          <EvolutionRuntimeProbe onMetrics={() => {}} />
        </PortalStage>
      </Canvas>
    </div>
  );
}

const host = document.getElementById('root');
if (host) {
  document.documentElement.dataset['artifact'] = 'crystal';
  createRoot(host).render(<StrictMode><CrystalLab /></StrictMode>);
}
