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
import { useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Canvas } from '@react-three/fiber';
import { crystalVeinBearings } from '@/engine/geometry';
import { crystalRenderScale } from '@/engine/renderer';
import {
  crystalSceneHeight,
  crystalSceneRadius,
  crystalSubstrateSceneRadius,
} from '@/engine/renderer/three';
import type { CrystalMaterialQuality, CrystalMaterialState } from '@/engine/material';
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

/**
 * Терми, які можна вимкнути по одному.
 *
 * Уся техніка цього проєкту тримається на одній дії: обнулити ОДИН доданок
 * і перезняти. Різниця в профілі — і є внесок того доданка, і він
 * регулярно не має нічого спільного з тим, що підказує код: «емісія
 * розмиває грані» дала 0.047, «ключове світло заслабке» — ×4 і нуль.
 *
 * Тому перемикач тут, а не редагування конфігурації: вимір мусить
 * коштувати один рядок запиту, інакше його не роблять.
 */
const SHADER_TERMS = [
  'rimStrength', 'skyStrength', 'coreStrength', 'glassStrength',
  'veilStrength', 'auroraStrength', 'axialTintStrength', 'innerFlowStrength',
  'facetEdgeStrength', 'inclusionContrast', 'surfaceReliefStrength',
  'surfaceVeinStrength',
] as const;

type ShaderTerm = (typeof SHADER_TERMS)[number];

/**
 * Обнулити названі терми в кожному тілі.
 *
 * Копія, а не мутація: стан рушія опублікований і незмінний, і лабораторія
 * не має права це порушити навіть у себе вдома.
 */
function withTermsOff(material: CrystalMaterialState, off: readonly string[]): CrystalMaterialState {
  if (off.length === 0) return material;
  const terms = off.filter((name): name is ShaderTerm => (
    (SHADER_TERMS as readonly string[]).includes(name)
  ));
  const zeroEmissive = off.includes('emissive');
  const flatFacets = off.includes('facetTint');
  /*
   * Дзеркальна складова. Дифузне світло на ПЛАСКІЙ грані від напрямленого
   * джерела стале (нормаль стала, виміряно: розкид усередині грані 0.0–0.1°),
   * тож градієнт на 85 пікселів мусить давати щось видозалежне. Обідок,
   * скло, ядро й небо вже зняті — лишається дзеркало самого матеріалу.
   */
  const dullSurface = off.includes('specular');
  /*
   * Проба «чи фарба взагалі доходить». Два навмисно дикі тони: якщо
   * грані й від них не розійдуться, атрибут кольору до шейдера не
   * доходить, і вся розмова про фарбу на грані була про мертвий код.
   */
  const paintProbe = off.includes('paintProbe');

  return {
    ...material,
    bodies: material.bodies.map((body) => {
      const shader = { ...body.shader };
      for (const term of terms) shader[term] = 0;
      return {
        ...body,
        shader,
        ...(zeroEmissive ? { emissiveIntensity: 0 } : {}),
        ...(dullSurface
          ? { roughness: 1, metalness: 0, clearcoat: 0, reflectivity: 0, envMapIntensity: 0 }
          : {}),
        ...(flatFacets
          ? { facets: { tints: [{ r: 1, g: 1, b: 1 }], cumulativeWeights: [1] } }
          : {}),
        ...(paintProbe
          ? {
            facets: {
              tints: [{ r: 0.2, g: 0.2, b: 0.2 }, { r: 2, g: 2, b: 2 }],
              cumulativeWeights: [0.5, 1],
            },
          }
          : {}),
      };
    }),
  };
}

function CrystalLab() {
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const years = Math.max(1, Math.min(50, Number(params.get('years') ?? 4) || 4));
  const quality = (params.get('quality') ?? 'high') as CrystalMaterialQuality;
  const theme = params.get('theme') === 'light' ? 'light' : 'dark';
  const off = useMemo(() => (params.get('off') ?? '').split(',').filter(Boolean), [params]);
  /*
   * Контрольний кадр: сцена без кристала.
   *
   * Потрібен, щоб довести, що кристал НАМАЛЬОВАНО, а не лише зібрано.
   * Лічильник трикутників усієї сцени цього не доводить: без кристала
   * вона малює 11 916, з ним 12 472 — тобто «11 916» саме по собі
   * виглядає цілком здоровим числом.
   */
  const withoutCrystal = params.get('crystal') === 'off';

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

  const material = useMemo(
    () => withTermsOff(states.material, off),
    [states.material, off],
  );

  /*
   * Скільки трикутників МАЄ бути в кристалі — за станом геометрії.
   *
   * Разом із тим, скільки їх намальовано насправді, це єдиний спосіб
   * відрізнити «кристал гладкий» від «кристала немає». Виміряно, чому це
   * потрібно: коли бандл виявився звільненим, сцена малювалась цілком —
   * руїна, обеліски, каміння, — а скрипт упевнено звітував «читається
   * кристалом, 85%», бо міряв обеліск проти неба.
   */
  const expectedTriangles = useMemo(
    () => states.geometry.meshes.reduce(
      (sum, mesh) => sum + Math.floor(mesh.indices.length / 3),
      0,
    ),
    [states.geometry.meshes],
  );
  const [drawn, setDrawn] = useState(0);

  const veinBearings = useMemo(
    () => crystalVeinBearings(states.geometry.meshes),
    [states.geometry.meshes],
  );
  const radius = crystalSceneRadius(states.geometry);

  return (
    <div
      className="lab-stage"
      data-evolution-preview="ready"
      data-lab-expected-triangles={expectedTriangles}
      data-lab-drawn-triangles={drawn}
    >
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
          {!withoutCrystal && (
            <EvolutionCrystalObject
              geometry={states.geometry}
              material={material}
              life={states.life}
              substrateVisible={false}
            />
          )}
          {/*
            * Публікує сцену й КРИВУ ТОНУВАННЯ. Без другого вимір світла
            * обертав би криву, якої не застосовували: R3F ставить ACES за
            * замовчуванням, але `flat` на полотні це вимикає — і мовчки.
            */}
          <EvolutionRuntimeProbe onMetrics={(metrics) => setDrawn(metrics.triangles)} />
        </PortalStage>
      </Canvas>
    </div>
  );
}

const host = document.getElementById('root');
if (host) {
  document.documentElement.dataset['artifact'] = 'crystal';
  /*
   * БЕЗ StrictMode — і чесно про те, чого я НЕ довів.
   *
   * Спершу оснастка два прогони з трьох малювала сцену взагалі без
   * кристала. Гіпотеза була така: StrictMode у dev монтує двічі (mount →
   * cleanup → mount), cleanup звільняє бандл, а мем його не перерахує, бо
   * залежності ті самі, — тож другий монтаж дістає звільнений бандл.
   * Портал це переживає випадково: там стани приходять асинхронно, тобто
   * ПІСЛЯ подвійного монтажу.
   *
   * Знявши StrictMode, я дістав 3 чисті прогони з 3 і вирішив, що причину
   * знайдено. Це було зарано: коли скрипт почав знімати ще й контрольний
   * кадр (`crystal=off`), тобто робити ДРУГУ навігацію, порожніх кадрів
   * не стало й зі StrictMode. Отже змінних було дві, а не одна, і котра з
   * них лікує — не доведено.
   *
   * StrictMode лишається вимкненим як обережність, а не як діагноз.
   * Справжній захист тут інший і не залежить від причини: скрипт звіряє
   * кадр із контрольним і відмовляється міряти, якщо кристал нічого не
   * змінив.
   */
  createRoot(host).render(<CrystalLab />);
}
