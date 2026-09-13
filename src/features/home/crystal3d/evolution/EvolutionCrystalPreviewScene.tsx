import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { crystalVeinBearings } from '@/engine/geometry';
import { crystalRenderScale } from '@/engine/renderer';
import {
  crystalSceneHeight,
  crystalSceneRadius,
  crystalSubstrateSceneRadius,
} from '@/engine/renderer/three';
import { useTheme } from '@/providers/ThemeProvider';
import { useWorldPose } from '@/features/world/useWorldPose';
import { useWorldMotionMode } from '@/features/world/useWorldMotionMode';
import { useWorldFrameloop } from '@/features/world/useImmersiveRoute';
import { MODULE_SPIN_RATE } from '@/features/world/sceneDirector';
import { useEvolutionSandbox } from '@/features/home/evolutionSandbox';
import { useGrowthSinceLastVisit } from '@/features/home/useGrowthSinceLastVisit';
import type { GrowthEvent } from '@/features/home/growthSinceLastVisit';
import { useWorldGrowthReporter } from '@/features/world/growthChannel';
import { CrystalPlaceholder } from '../../CrystalPlaceholder';
import { PortalStage } from '../scene/PortalStage';
import {
  PORTAL_ENVIRONMENT_DRAW_CALLS,
  PORTAL_ENVIRONMENT_TRIANGLES,
} from '../scene/portalScene';
import { EvolutionCrystalObject } from './EvolutionCrystalObject';
import {
  EvolutionRuntimeProbe,
  type EvolutionRuntimeMetrics,
} from './EvolutionRuntimeProbe';
import { isEvolutionDiagnosticsEnabled } from './featureFlag';
import { buildStudioEnvMap } from '../render/envMap';
import { describeGfx, gfxProfileFromLocation, isGfxRequested } from '../render/gfxProfile';
import { useEvolutionCrystalPipeline } from './useEvolutionCrystalPipeline';
import './evolutionPreview.css';

// Аварійний шлях, і вантажиться він теж аварійно. Статичний імпорт зшивав
// увесь старий рендерер — власний конвеєр кластерів, батчинг, публікацію,
// bloom — у той самий чанк, що й головна: приблизно сотня кілобайт, яку
// платить кожен, хто просто відкрив портал, заради гілки, у яку майже ніхто
// ніколи не заходить.
const LegacyCrystalScene = lazy(() => import('../CrystalScene'));

/*
 * ДІАГНОСТИКА ПЕРЕЇХАЛА НА ТУ СЦЕНУ, ЯКУ ПАРА СПРАВДІ БАЧИТЬ (ADR-0171).
 *
 * `?gfx=` читався в `CrystalScene`, а вона з переходом на Evolution
 * лишилась аварійним фолбеком: на головній її не монтує ніхто. Тобто
 * прапорець, на якому тримається все питання «чи можна повернути Bloom»,
 * не діяв на єдиному екрані, де його треба міряти. Власник відкрив
 * посилання й не побачив НІЧОГО — і був правий.
 *
 * `postprocessing` важить сотні кілобайт, тож проба лишається за
 * `React.lazy`: у головний чанк вона не потрапляє, доки в адресі немає
 * прапорця.
 */
const BloomProbe = lazy(() => import('../render/BloomProbe'));

function formatTopology(value: number): string {
  if (value < 1_000) return String(value);
  return `${(value / 1_000).toFixed(value >= 10_000 ? 0 : 1)}k`;
}

export default function EvolutionCrystalPreviewScene() {
  // Build metrics are a development instrument. They were rendering over the
  // artifact in production, which is both noise on the portal's one hero
  // surface and an internal detail (body counts, draw calls, build time) that
  // means nothing to a couple looking at their crystal.
  const [diagnosticsVisible] = useState(isEvolutionDiagnosticsEnabled);
  const { theme } = useTheme();
  const { freeCameraActive } = useEvolutionSandbox();
  const [reduceMotion] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  const { pipeline, isPending, error } = useEvolutionCrystalPipeline(reduceMotion);
  // Обидва — ЗЗОВНІ полотна. Всередині <Canvas> живе окремий корінь React, і
  // зміна маршруту не перемальовує його сама; тут же зміна маршруту
  // перемальовує цей компонент, а з ним і дітей полотна. Див. коментар до
  // `PortalStageProps.pose`.
  const { pose, region } = useWorldPose();
  const motionMode = useWorldMotionMode();
  const [runtime, setRuntime] = useState<EvolutionRuntimeMetrics | null>(null);
  // Напрямки гілок кварцової жили. Меми в сцені тримаються за цей масив, тож
  // він мусить бути стабільним посиланням — інакше камінь платформи
  // перебудовувався б щокадру.
  const meshes = pipeline?.geometry.meshes;
  const veinBearings = useMemo(() => crystalVeinBearings(meshes ?? []), [meshes]);

  const onRuntimeMetrics = useCallback((next: EvolutionRuntimeMetrics) => {
    setRuntime(next);
  }, []);

  /*
   * Кадри — лише коли сцену видно.
   *
   * Це полотно живе на КОЖНОМУ маршруті модуля й малює кадри без упину,
   * навіть коли поверх нього непрозорий повний екран — карта спогадів або
   * «Наш шлях». Дві сцени одночасно на телефоні — подвійний рахунок за
   * батарею за одну картинку.
   *
   * Сусідні полотна (`CrystalScene`, `ReefPreviewScene`) цей гак уже
   * поважають; ці два — ні, і це був недогляд. Пауза не звільняє контекст
   * WebGL: повернення на звичайний екран вмикає кадри тим самим станом,
   * без перезбирання (ADR-0020).
   *
   * Стоїть СЕРЕД РЕШТИ ГАКІВ, а не біля `<Canvas>`, куди його тягне
   * читабельність. Нижче два ранні виходи — заглушка й запасний рендерер, —
   * і гак після них викликається не на кожному рендері. React це ловить
   * («Rendered more hooks than during the previous render»), сцена падає в
   * запасний рендерер, і на живому екрані це виглядає не як помилка, а як
   * «кристал сьогодні чомусь простіший».
   */
  const frameloop = useWorldFrameloop();

  /*
   * «Що виросло з минулого разу» — звідси, бо саме тут лежать події, з
   * яких кристал і зібрано. Рахувати їх удруге в шапці означало б
   * тримати ДРУГЕ визначення того, що вважати подією пари, і воно
   * розійшлося б із рушієм тихо: підпис показував би «+2», коли
   * кристал виріс на три.
   *
   * `attribution` у нормалізованій події необов'язковий — джерело може
   * не знати автора. Тоді `actorId: null`, і підпис просто не називає
   * нікого (`growthCaption`).
   *
   * Гаки стоять ТУТ, до ранніх виходів нижче, з тієї ж причини, що й
   * `useWorldFrameloop`.
   */
  /*
   * Адреса читається ОДИН РАЗ при монтуванні: щоб її змінити, сторінку
   * треба перезавантажити. Для діагностики з телефона це навіть краще —
   * кожен вимір починається з чистого контексту WebGL.
   *
   * А от сам ПРОФІЛЬ залежить іще й від якості сцени (ADR-0173), яку
   * рушій називає вже після збірки конвеєра. Тому він рахується
   * похідним: рядок сталий, профіль якості влягається один раз.
   */
  const [gfxSearch] = useState(() =>
    typeof window === 'undefined' ? '' : window.location.search,
  );
  const gfxQuality = pipeline?.metrics.quality ?? 'balanced';
  const gfx = useMemo(
    () => gfxProfileFromLocation(gfxSearch, gfxQuality),
    [gfxSearch, gfxQuality],
  );
  const envMap = useMemo(() => (gfx.env ? buildStudioEnvMap() : null), [gfx.env]);
  useEffect(() => () => envMap?.dispose(), [envMap]);

  const events = pipeline?.artifact.events;
  const growthEvents = useMemo<readonly GrowthEvent[] | null>(
    () => events?.map((event) => ({
      id: event.id,
      actorId: event.attribution?.actorId ?? null,
    })) ?? null,
    [events],
  );
  const growth = useGrowthSinceLastVisit(growthEvents);
  const reportGrowth = useWorldGrowthReporter();
  useEffect(() => {
    reportGrowth(growth);
    // Знімаємо за собою: аварійний рендерер і риф підпису не мають, і
    // рядок про кристал не повинен їх пережити.
    return () => reportGrowth(null);
  }, [growth, reportGrowth]);

  if (error) {
    console.error('[Evolution crystal preview] fallback to legacy renderer:', error);
    return (
      <div className="evolution-preview-fallback">
        <Suspense fallback={<CrystalPlaceholder />}>
          <LegacyCrystalScene />
        </Suspense>
        <span className="evolution-preview-badge evolution-preview-badge--error">
          Evolution fallback
        </span>
      </div>
    );
  }

  if (isPending || !pipeline) return <CrystalPlaceholder />;

  const metrics = pipeline.metrics;
  /*
   * Радіус самих кристалів — це те, під що будується кадр камери.
   *
   * Жила сюди не входить навмисно, і після ADR-0061 це важить менше, ніж
   * важило: вона більше не в 1.58 раза ширша за кристали, а в 1.13, тож
   * різниця між двома відповідями стиснулась із «камера відлітає через
   * камінь» до кількох відсотків. Коментар, що стояв тут, посилався на
   * бронзовий диск релікварію, якого в сцені немає з часів `ruin.glb`.
   */
  const visibleCrystalRadius = crystalSceneRadius(
    pipeline.geometry,
    { includeSubstrate: false },
  );
  const badge = [
    'Evolution',
    metrics.quality,
    `${metrics.meshCount} тіл`,
    `${formatTopology(metrics.usedTriangles)} △`,
    runtime ? `${runtime.drawCalls} DC` : 'метрики…',
    `${metrics.buildMs.toFixed(1)} ms`,
  ].join(' · ');

  return (
    <>
      <div
        className="crystal-wrap evolution-preview-wrap"
        data-evolution-preview="ready"
        data-evolution-renderer="three"
        data-evolution-quality={metrics.quality}
        data-evolution-bodies={metrics.bodyCount}
        data-evolution-meshes={metrics.meshCount}
        data-evolution-materials={metrics.materialCount}
        data-evolution-vertices={metrics.usedVertices}
        data-evolution-triangles={metrics.usedTriangles}
        data-evolution-build-ms={metrics.buildMs}
        data-evolution-runtime={runtime ? 'ready' : 'warming'}
        data-evolution-draw-calls={runtime?.drawCalls ?? ''}
        data-evolution-rendered-triangles={runtime?.triangles ?? ''}
        data-portal-environment-draw-calls={PORTAL_ENVIRONMENT_DRAW_CALLS}
        data-portal-environment-triangles={PORTAL_ENVIRONMENT_TRIANGLES}
      >
        <Canvas
          frameloop={frameloop}
          // Render scale, not optics, is how a dense screen is paid for — see
          // crystalRenderScale. Kept in the engine so the tier and the scale
          // cannot drift apart.
          dpr={[1, crystalRenderScale(metrics.quality, typeof window === 'undefined' ? 2 : window.devicePixelRatio)]}
          // Стартова позиція — приблизно кадр для вертикального телефона.
          // Точну дає PortalCameraRig із фактичного аспекту вже на першому
          // кадрі; тут вона потрібна лише щоб цей кадр не почався здалеку.
          camera={{ position: [0, 0.685, 7.1], fov: 42 }}
          /*
           * ПРОЗОРІСТЬ ПОЛОТНА — НЕ СТАЛА, і саме в ній був замок
           * (ADR-0178). `renderTransmissionPass` заливає буфер білим,
           * щойно `clearAlpha < 1`; тож заломлення вимагає непрозорого
           * полотна, а непрозоре полотно вимагає неба В СЦЕНІ. Обидва
           * приходять одним прапорцем і не можуть розійтись.
           *
           * Читається один раз при монтуванні — як і сам `?gfx=`.
           */
          gl={{ alpha: !gfx.refraction, antialias: metrics.quality !== 'fallback' }}
        >
          <PortalStage
            seed={pipeline.geometry.artifactSeed}
            theme={theme}
            quality={metrics.quality}
            reduceMotion={reduceMotion}
            artifactSceneRadius={visibleCrystalRadius}
            crystalsSceneRadius={visibleCrystalRadius}
            artifactSceneHeight={crystalSceneHeight(pipeline.geometry)}
            veinBearings={veinBearings}
            veinReach={crystalSubstrateSceneRadius(pipeline.geometry)}
            pose={pose}
            // Кристал обертається лише там, де він фон. Власник: «після
            // відкриття модуля… кристал в модулі на фоні починає повільно
            // обертатись навколо своєї осі». На головній він сам предмет
            // розмови й стоїть — тому ознакою служить регіон, а не маршрут
            // списком: будь-який новий модуль отримає обертання без правки.
            spin={region === 'centre' ? 0 : MODULE_SPIN_RATE}
            // Крутити сцену пальцем можна лише вдома: у модулі камера стає в
            // позу маршруту й лишається там, інакше дошка бажань і глядач
            // дивляться в різні боки.
            allowOrbit={region === 'centre'}
            freeCamera={freeCameraActive}
            motionMode={motionMode}
            sky={gfx.refraction}
          >
            <EvolutionCrystalObject
              geometry={pipeline.geometry}
              material={pipeline.material}
              life={pipeline.life}
              /*
               * ПІДКЛАДКА ЗНОВУ МАЛЮЄТЬСЯ (ADR-0135).
               *
               * Тут стояло `false`, і причина була правильна для свого
               * часу: ADR-0063 віддав роль битого каменю самій руїні —
               * «чорні уламки навколо основи і є той битий камінь», — а
               * два камені під одним кристалом читались настилом на
               * настилі.
               *
               * Руїну скасовано (ADR-0116), її замінила печера
               * (ADR-0117), і разом із руїною пішов камінь, з якого
               * кристал росте. Роль лишилась невиконаною: на кадрі
               * монарх стояв просто на підлозі зали, а
               * `amore-crystal-look` каже прямо, що гладка поверхня під
               * кристалом читається п'єдесталом, хай як її формувати.
               *
               * Жеода з коміром при цьому весь час будувалась і весь час
               * була під тестами (ADR-0060, ADR-0115) — її просто ніхто
               * не показував.
               */
              substrateVisible
              envMap={envMap}
              refraction={gfx.refraction}
            />
          </PortalStage>
          <EvolutionRuntimeProbe onMetrics={onRuntimeMetrics} />
          {gfx.bloom && (
            <Suspense fallback={null}>
              <BloomProbe />
            </Suspense>
          )}
        </Canvas>
        {diagnosticsVisible && (
          <span className="evolution-preview-badge" aria-label="Метрики Evolution preview">
            {badge}
          </span>
        )}
        {/*
          Значок профілю. Потрібен саме на телефоні: якщо помилитись у
          слові (`?gfx=blomo`), профіль мовчки вийде дефолтним, власник
          побачить сцену без білого фону й зробить ХИБНИЙ висновок, що
          Bloom безпечний. Значок показує, що РЕАЛЬНО ввімкнено.

          Умова — «в адресі щось просили», а не «профіль не дефолтний»:
          відколи Bloom у дефолті на потужних пристроях (ADR-0173),
          `?gfx=bloom` дорівнює дефолту, і значок зник би рівно тоді,
          коли він найпотрібніший.
        */}
        {isGfxRequested(gfxSearch) && (
          <span className="crystal-gfx-badge" aria-label="Графічний профіль">
            {describeGfx(gfx)}
          </span>
        )}
        {diagnosticsVisible && pipeline.diagnostics.length > 0 && (
          <span
            className="evolution-preview-diagnostics"
            title={pipeline.diagnostics.map((item) => item.message).join('\n')}
          >
            {pipeline.diagnostics.length} діагн.
          </span>
        )}
      </div>
    </>
  );
}
