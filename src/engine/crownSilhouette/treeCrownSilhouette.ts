import {
  clamp,
  round6,
  roundVec,
  seededUnit,
} from '../growth/math';
import { TREE_CROWN_BOTTOM_SHARE, treeCrownHalfWidthAt } from '../species/tree';
import type {
  BuildTreeCrownSilhouetteInput,
  TreeCrownSilhouetteProfile,
  TreeCrownSilhouetteState,
  TreeCrownViewReadability,
} from './types';

const TAU = Math.PI * 2;
const EPSILON = 1e-9;

function validateInput(input: BuildTreeCrownSilhouetteInput): void {
  const {
    composition,
    leaves,
    canopyDepth,
    canopyLight,
    phenology,
    leafOrientation,
    config,
  } = input;

  if (!config.rulesVersion.trim()) {
    throw new Error('Tree Crown Silhouette requires a non-empty rulesVersion.');
  }
  if (!Number.isInteger(config.azimuthSectorCount)
    || config.azimuthSectorCount < 8
    || config.azimuthSectorCount > 64) {
    throw new Error('Tree Crown Silhouette azimuthSectorCount must be an integer between 8 and 64.');
  }
  if (!Number.isInteger(config.verticalBandCount)
    || config.verticalBandCount < 3
    || config.verticalBandCount > 16) {
    throw new Error('Tree Crown Silhouette verticalBandCount must be an integer between 3 and 16.');
  }
  if (!Number.isInteger(config.viewDirectionCount)
    || config.viewDirectionCount < 4
    || config.viewDirectionCount > 16) {
    throw new Error('Tree Crown Silhouette viewDirectionCount must be an integer between 4 and 16.');
  }
  if (!Number.isFinite(config.maximumRadialOffsetRatio)
    || config.maximumRadialOffsetRatio < 0
    || config.maximumRadialOffsetRatio > 0.08) {
    throw new Error('Tree Crown Silhouette maximumRadialOffsetRatio must stay in [0, 0.08].');
  }
  if (!Number.isFinite(config.maximumScaleDelta)
    || config.maximumScaleDelta < 0
    || config.maximumScaleDelta > 0.5) {
    throw new Error('Tree Crown Silhouette maximumScaleDelta must stay in [0, 0.5].');
  }
  if (!Number.isFinite(config.frontClosureMaximumInwardOffsetRatio)
    || config.frontClosureMaximumInwardOffsetRatio < 0
    || config.frontClosureMaximumInwardOffsetRatio > 0.25) {
    throw new Error('Tree Crown Silhouette frontClosureMaximumInwardOffsetRatio must stay in [0, 0.25].');
  }
  for (const [name, value] of [
    ['envelopeResponse', config.envelopeResponse],
    ['middleLayerResponse', config.middleLayerResponse],
    ['frontClosureSelectionFraction', config.frontClosureSelectionFraction],
    ['frontClosureTargetRadialRatio', config.frontClosureTargetRadialRatio],
    ['frontClosureScaleDelta', config.frontClosureScaleDelta],
    ['minimumReadableFacingDot', config.minimumReadableFacingDot],
    ['minimumReadableLeafFraction', config.minimumReadableLeafFraction],
  ] as const) {
    if (!Number.isFinite(value) || value < 0 || value > 1) {
      throw new Error(`Tree Crown Silhouette ${name} must stay in [0, 1].`);
    }
  }
  if (config.envelopeResponse <= 0) {
    throw new Error('Tree Crown Silhouette envelopeResponse must be greater than zero.');
  }
  if (!Number.isFinite(composition.bounds.radius) || composition.bounds.radius <= 0) {
    throw new Error('Tree Crown Silhouette requires a positive accepted crown radius.');
  }
  if (!Number.isFinite(composition.bounds.height) || composition.bounds.height <= 0) {
    throw new Error('Tree Crown Silhouette requires a positive accepted crown height.');
  }

  const artifactSeed = leaves.artifactSeed;
  if (composition.artifactSeed !== artifactSeed
    || canopyDepth.artifactSeed !== artifactSeed
    || canopyLight.artifactSeed !== artifactSeed
    || phenology.artifactSeed !== artifactSeed
    || leafOrientation.artifactSeed !== artifactSeed) {
    throw new Error('Tree Crown Silhouette received states from different artifacts.');
  }
  if (canopyDepth.sourceCompositionVersion !== composition.treeCompositionVersion
    || canopyDepth.sourceCompositionRulesVersion !== composition.rulesVersion
    || canopyDepth.sourceLeafGeometryVersion !== leaves.treeLeafGeometryVersion
    || canopyDepth.sourceLeafGeometryRulesVersion !== leaves.rulesVersion
    || canopyDepth.lod !== leaves.lod) {
    throw new Error('Tree Crown Silhouette Canopy Depth provenance does not match.');
  }
  if (canopyLight.sourceLeafGeometryVersion !== leaves.treeLeafGeometryVersion
    || canopyLight.sourceLeafGeometryRulesVersion !== leaves.rulesVersion
    || canopyLight.sourceCanopyDepthSignature !== canopyDepth.signature
    || canopyLight.lod !== leaves.lod) {
    throw new Error('Tree Crown Silhouette Canopy Light provenance does not match.');
  }
  if (phenology.sourceLeafGeometryVersion !== leaves.treeLeafGeometryVersion
    || phenology.sourceLeafGeometryRulesVersion !== leaves.rulesVersion
    || phenology.sourceCanopyLightSignature !== canopyLight.signature
    || phenology.lod !== leaves.lod) {
    throw new Error('Tree Crown Silhouette Phenology provenance does not match.');
  }
  if (leafOrientation.sourceLeafGeometryVersion !== leaves.treeLeafGeometryVersion
    || leafOrientation.sourceLeafGeometryRulesVersion !== leaves.rulesVersion
    || leafOrientation.sourceCanopyDepthSignature !== canopyDepth.signature
    || leafOrientation.sourceCanopyLightSignature !== canopyLight.signature
    || leafOrientation.sourcePhenologySignature !== phenology.signature
    || leafOrientation.lod !== leaves.lod) {
    throw new Error('Tree Crown Silhouette Leaf Orientation provenance does not match.');
  }
  if (canopyDepth.profiles.length !== leaves.instances.length
    || canopyLight.profiles.length !== leaves.instances.length
    || phenology.profiles.length !== leaves.instances.length
    || leafOrientation.profiles.length !== leaves.instances.length) {
    throw new Error('Tree Crown Silhouette requires one upstream profile per accepted leaf.');
  }
}

function sectorIndex(x: number, z: number, count: number): number {
  const angle = (Math.atan2(z, x) + TAU) % TAU;
  return Math.min(count - 1, Math.floor(angle / TAU * count));
}

function verticalBandIndex(
  y: number,
  minimumY: number,
  height: number,
  count: number,
): number {
  const normalized = clamp((y - minimumY) / height, 0, 1);
  return Math.min(count - 1, Math.floor(normalized * count));
}

/*
 * ОГИНАЛЬНА ТУТ БУЛА ДРУГИМ, СУПЕРЕЧЛИВИМ ЗАКОНОМ КРОНИ — ADR-0108.
 *
 * Стояло чотири дуги за архетипом силуету, і всі чотири мали спільну
 * властивість: НІЖНЯ МЕЖА 0.62. Тобто на будь-якій висоті — біля самої
 * землі й на маківці однаково — контракт вважав, що листок мусить стояти
 * щонайменше на 62% радіуса коробки, і совав його НАЗОВНІ, поки не
 * впирався у власну стелю зсуву.
 *
 * Виміряно на сорокарічному дереві: з 616 листків контракт посунув назовні
 * 289 і всередину 7, а картку збільшив 399 разів. Позицій за огинальною
 * крони було 245 до нього й 260 після. Тобто шар, заведений «доводити
 * листя до оболонки крони», роздував крону там, де оболонки вже не було.
 *
 * Це те саме, що ADR-0107 знайшов у симуляції, тільки на поверх вище:
 * закон форми, виведений із самої форми. Тепер тут стоїть огинальна ПОРОДИ
 * (`crownProfile.ts`) — та сама, за якою йдуть гілки симуляції, скелетні
 * гілки й еталонне дерево.
 *
 * ЧОМУ ЧЕРЕЗ `bounds.height`, А НЕ `bounds.radius`. Огинальна оголошена в
 * частках ВИСОТИ дерева, а `sourceRadialRatio` міряється радіусом коробки
 * (тривимірним, тобто близьким до половини діагоналі). Перерахунок робить
 * обидва боки порівняння одиницями коробки й нічого не вигадує.
 */
function targetEnvelopeRatio(
  normalizedHeight: number,
  boundsHeight: number,
  boundsRadius: number,
): number {
  const h = clamp(normalizedHeight, 0, 1);
  /*
   * Нижче за низ крони стеля не нульова, а рівна найвужчому місцю самої
   * крони — так само, як у `applyTreeCrownEnvelope`. Листя там росте на
   * гілках, які ПОЧИНАЮТЬСЯ під кроною, і втягувати його в стовбур
   * означало б оголити ті гілки.
   */
  const share = h < TREE_CROWN_BOTTOM_SHARE
    ? treeCrownHalfWidthAt(TREE_CROWN_BOTTOM_SHARE) * (h / TREE_CROWN_BOTTOM_SHARE)
    : treeCrownHalfWidthAt(h);
  return round6((share * boundsHeight) / boundsRadius);
}

function average(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function layerResponse(
  layer: TreeCrownSilhouetteProfile['layer'],
  input: BuildTreeCrownSilhouetteInput,
): number {
  if (layer === 'outer') return 1;
  if (layer === 'middle') return input.config.middleLayerResponse;
  return 0;
}

function buildViewReadability(
  input: BuildTreeCrownSilhouetteInput,
  profiles: readonly TreeCrownSilhouetteProfile[],
): TreeCrownViewReadability[] {
  const result: TreeCrownViewReadability[] = [];

  for (let viewIndex = 0; viewIndex < input.config.viewDirectionCount; viewIndex += 1) {
    const angle = viewIndex / input.config.viewDirectionCount * TAU;
    const direction = roundVec({
      x: Math.cos(angle),
      y: 0,
      z: Math.sin(angle),
    });
    let frontLeafCount = 0;
    let readableFrontLeafCount = 0;

    for (const profile of profiles) {
      const relativeX = profile.renderPosition.x - input.composition.bounds.center.x;
      const relativeZ = profile.renderPosition.z - input.composition.bounds.center.z;
      const frontProjection = relativeX * direction.x + relativeZ * direction.z;
      if (frontProjection < 0) continue;

      frontLeafCount += 1;
      const orientation = input.leafOrientation.profiles[profile.sequence]!;
      const facingDot = Math.abs(
        orientation.presentationNormal.x * direction.x
          + orientation.presentationNormal.z * direction.z,
      );
      if (facingDot >= input.config.minimumReadableFacingDot) {
        readableFrontLeafCount += 1;
      }
    }

    const readableFrontLeafFraction = frontLeafCount > 0
      ? readableFrontLeafCount / frontLeafCount
      : 0;
    /*
     * Замалу вибірку приймаємо без розмови — див. `minimumReadableSampleSize`.
     * Порожній напрямок так само приймається: там немає крони, яку судити.
     */
    const accepted = frontLeafCount < input.config.minimumReadableSampleSize
      || readableFrontLeafFraction >= input.config.minimumReadableLeafFraction;

    result.push({
      viewIndex,
      direction,
      frontLeafCount,
      readableFrontLeafCount,
      readableFrontLeafFraction: round6(readableFrontLeafFraction),
      accepted,
    });
  }

  return result;
}

function signatureFor(state: Omit<TreeCrownSilhouetteState, 'signature'>): string {
  return [
    state.rulesVersion,
    state.artifactSeed,
    state.lod,
    state.sourceLeafOrientationSignature,
    state.profiles.length,
    state.diagnostics.adjustedLeafCount,
    state.diagnostics.adjustedInnerLeafCount,
    state.diagnostics.ceilingClampedLeafCount,
    state.diagnostics.frontClosureLeafCount,
    state.diagnostics.frontClosureInwardLeafCount,
    state.diagnostics.emptyOuterSectorIndices.join(','),
    state.diagnostics.maximumRadialOffsetRatio.toFixed(6),
    state.diagnostics.maximumFrontClosureInwardOffsetRatio.toFixed(6),
    state.diagnostics.maximumCeilingInwardOffsetRatio.toFixed(6),
    state.diagnostics.maximumScaleDelta.toFixed(6),
    state.diagnostics.averageEnvelopeErrorAfter.toFixed(6),
    state.diagnostics.minimumReadableFrontLeafFraction.toFixed(6),
  ].join('|');
}

/**
 * Refines accepted outer and middle leaf matrices toward the published crown
 * envelope, pulls a deterministic middle-layer subset into the front interior,
 * and validates readability from eight views.
 */
export function buildTreeCrownSilhouette(
  input: BuildTreeCrownSilhouetteInput,
): TreeCrownSilhouetteState {
  validateInput(input);

  const profiles: TreeCrownSilhouetteProfile[] = [];
  const sourceOuterSectors = new Set<number>();
  const renderOuterSectors = new Set<number>();
  const outerErrorsBefore: number[] = [];
  const outerErrorsAfter: number[] = [];
  let adjustedLeafCount = 0;
  let adjustedOuterLeafCount = 0;
  let adjustedMiddleLeafCount = 0;
  let adjustedInnerLeafCount = 0;
  let frontClosureLeafCount = 0;
  let frontClosureInwardLeafCount = 0;
  let untouchedInnerLeafCount = 0;
  let untouchedMiddleLeafCount = 0;
  let maximumRadialOffset = 0;
  let maximumRadialOffsetRatio = 0;
  let maximumFrontClosureInwardOffsetRatio = 0;
  let maximumCeilingInwardOffsetRatio = 0;
  let maximumScaleDelta = 0;
  let ceilingClampedLeafCount = 0;

  for (let index = 0; index < input.leaves.instances.length; index += 1) {
    const leaf = input.leaves.instances[index]!;
    const depth = input.canopyDepth.profiles[index]!;
    const light = input.canopyLight.profiles[index]!;
    const phenology = input.phenology.profiles[index]!;
    const orientation = input.leafOrientation.profiles[index]!;

    if (depth.leafInstanceId !== leaf.id
      || light.leafInstanceId !== leaf.id
      || light.canopyProfileId !== depth.id
      || phenology.leafInstanceId !== leaf.id
      || phenology.canopyLightProfileId !== light.id
      || orientation.leafInstanceId !== leaf.id
      || orientation.canopyDepthProfileId !== depth.id
      || orientation.canopyLightProfileId !== light.id
      || orientation.phenologyProfileId !== phenology.id) {
      throw new Error(`Tree Crown Silhouette cannot resolve upstream profiles for "${leaf.id}".`);
    }

    const sourcePosition = depth.renderPosition;
    const relativeX = sourcePosition.x - input.composition.bounds.center.x;
    const relativeZ = sourcePosition.z - input.composition.bounds.center.z;
    const horizontalDistance = Math.hypot(relativeX, relativeZ);
    const sourceRadialRatio = round6(horizontalDistance / input.composition.bounds.radius);
    const normalizedHeight = clamp(
      (sourcePosition.y - input.composition.bounds.min.y) / input.composition.bounds.height,
      0,
      1,
    );
    const targetRatio = targetEnvelopeRatio(
      normalizedHeight,
      input.composition.bounds.height,
      input.composition.bounds.radius,
    );
    /*
     * ОБОЛОНКА КРОНИ — ТАМ, ДЕ ЛИСТОК КІНЧАЄТЬСЯ, А НЕ ТАМ, ДЕ ВІН
     * ЧІПЛЯЄТЬСЯ (ADR-0108).
     *
     * Досі і нудження, і похибка міряли ПОЧАТОК картки. Картка ж має
     * довжину, і на сорокарічному дереві вона виносила крону далеко за
     * оболонку: позиції під стелею, а кінчиків за нею 357 із 616,
     * найдальший на 0.199 висоти дерева. Крону видно по кінчиках, і еталон
     * — теж оболонка листя, а не точки кріплення.
     *
     * Тому виліт картки віднімається від стелі один раз і в одному місці,
     * а далі його бачать усі троє: нудження, стеля й похибка. Інакше
     * контракт суперечив би сам собі — власна перевірка
     * `silhouetteErrorNotIncreased` падала саме на цьому, коли стеля вже
     * знала про картку, а похибка ще ні.
     */
    const cardReachBefore = (leaf.length * (depth.scaleMultiplier ?? 1))
      / input.composition.bounds.radius;
    const surfaceRatio = round6(Math.max(0, targetRatio - cardReachBefore));
    const sourceSectorIndex = sectorIndex(relativeX, relativeZ, input.config.azimuthSectorCount);
    const sourceVerticalBandIndex = verticalBandIndex(
      sourcePosition.y,
      input.composition.bounds.min.y,
      input.composition.bounds.height,
      input.config.verticalBandCount,
    );

    const response = layerResponse(depth.layer, input);
    const frontCandidate = depth.layer !== 'inner'
      && (depth.renderFrontDepth >= 0 || depth.presentationShifted);
    const frontClosureSelected = depth.layer === 'middle'
      && frontCandidate
      && normalizedHeight >= 0.24
      && seededUnit(
        input.leaves.artifactSeed,
        `${leaf.id}:crown-silhouette:front-closure`,
      ) < input.config.frontClosureSelectionFraction;

    let radialOffsetRatio = 0;
    let frontClosureInwardOffsetRatio = 0;
    let radialOffset = 0;
    let renderPosition = { ...sourcePosition };
    const errorBefore = Math.abs(surfaceRatio - sourceRadialRatio);
    const signedError = surfaceRatio - sourceRadialRatio;

    if (frontClosureSelected && horizontalDistance > EPSILON) {
      const maximumInward = Math.min(
        input.config.frontClosureMaximumInwardOffsetRatio,
        sourceRadialRatio * 0.45,
      );
      frontClosureInwardOffsetRatio = round6(clamp(
        (input.config.frontClosureTargetRadialRatio - sourceRadialRatio) * 0.82,
        -maximumInward,
        0,
      ));
      radialOffsetRatio = frontClosureInwardOffsetRatio;
    } else if (response > 0 && horizontalDistance > EPSILON) {
      const centerSafeMaximum = Math.min(
        input.config.maximumRadialOffsetRatio * response,
        sourceRadialRatio * 0.45,
      );
      radialOffsetRatio = round6(clamp(
        signedError * input.config.envelopeResponse * response,
        -centerSafeMaximum,
        centerSafeMaximum,
      ));
    }

    /*
     * СТЕЛЯ — ОКРЕМИЙ КРОК, І ВОНА НЕ ЗНАЄ ПРО ШАРИ.
     *
     * Усе вище — це доведення листка ДО оболонки: воно зважене на шар
     * (`response`), обмежене `maximumRadialOffsetRatio` і має право не
     * спрацювати. Стеля — інше твердження: листка ЗА кроною не буває.
     * Внутрішній листок (`response` нуль) її слухається так само, як
     * зовнішній, бо «внутрішній» — це про глибину в кроні, а не про дозвіл
     * стояти поза нею.
     *
     * Виміряно, чому це мусить бути повний захід, а не половина: найдальший
     * листок сорокарічного дерева стояв на 0.195 висоти за огинальною при
     * півширині крони 0.38 — тобто на півкрони назовні. Обмеження на
     * 45% власного радіуса (як у нудження вище) лишало б його все одно
     * поза кроною.
     *
     * Через вісь це не тягне ніколи: стеля невід'ємна, і листок сідає рівно
     * на неї.
     */
    /*
     * Листок ближче за десяту частку міліметра до осі стеля не чіпає, і це
     * не косметика: позиції округлюються до шести знаків, тож у листка,
     * який стоїть майже НА осі, після зсуву на 90% радіуса координати
     * можуть перекинутись через нуль — а разом із ними й азимутний сектор,
     * який контракт нижче зобов'язаний зберегти. Такий листок і без стелі
     * усередині будь-якої оболонки.
     */
    let ceilingClamped = false;
    const ceilingBefore = sourceRadialRatio + radialOffsetRatio;
    if (ceilingBefore > surfaceRatio && horizontalDistance > 1e-4) {
      /*
       * Десятину відстані від осі листок лишає собі завжди. Це не запас
       * «про всяк випадок», а те, чим тримається інваріант нижче:
       * `sourceSectorIndex !== renderSectorIndex` кидає виняток, а сектор
       * рахується через `atan2` від зсуву до центра — на самій осі він
       * невизначений. Виміряно: без цієї десятини контракт падав на
       * листі під низом крони, де стеля дорівнює нулю.
       *
       * Найдальший листок сорокарічного дерева стояв на 0.195 висоти за
       * огинальною, і щоб завести його під неї, треба забрати дві третини
       * його радіуса. Тому дозвіл саме 0.9, а не 0.45, як у нудження вище:
       * там ішлося про доведення до оболонки, тут — про те, що листок поза
       * кроною не лишається поза кроною.
       */
      radialOffsetRatio = round6(Math.max(
        surfaceRatio - sourceRadialRatio,
        -sourceRadialRatio * 0.9,
      ));
      ceilingClamped = true;
      ceilingClampedLeafCount += 1;
    }

    /*
     * Зсув — це МНОЖЕННЯ ПРОМЕНЯ, і саме тому кут береться з нього, а не з
     * округленої точки.
     *
     * Рух суто радіальний, тобто азимут не міняється за побудовою. Але
     * позиції округлюються до шести знаків, а сектор рахується через
     * `atan2` уже з округленої точки — і листок, що стоїть РІВНО на межі
     * секторів, перекидається через неї на 1e-6. Доти цього не траплялось,
     * бо контракт рухав листя щонайбільше на 5.5% радіуса; заведення стелі
     * (ADR-0108) дало зсуви до 90%, і похибка округлення разом із ними
     * виросла на порядок. Впало це на догмі «дерево росте щороку», де
     * контракт кинув виняток замість дерева.
     *
     * Тому нижче зберігається ОКРУГЛЕНА точка (її й малюють), а сектор і
     * радіус беруться з неокругленого променя. Різниця між ними — півтори
     * десятимільйонні одиниці сцени, тобто менше за товщину будь-чого, що
     * дерево має.
     */
    let renderRelativeX = relativeX;
    let renderRelativeZ = relativeZ;
    if (Math.abs(radialOffsetRatio) > EPSILON && horizontalDistance > EPSILON) {
      radialOffset = round6(radialOffsetRatio * input.composition.bounds.radius);
      const scale = Math.max(0, (horizontalDistance + radialOffset) / horizontalDistance);
      renderRelativeX = relativeX * scale;
      renderRelativeZ = relativeZ * scale;
      renderPosition = roundVec({
        x: input.composition.bounds.center.x + renderRelativeX,
        y: sourcePosition.y,
        z: input.composition.bounds.center.z + renderRelativeZ,
      });
    }

    /*
     * Листок, який заводять ПІД стелю, не зменшується: він саме той, що
     * тримає оболонку крони, і зменшити його означало б обміняти форму на
     * дірку. Зменшення лишається тільки там, де воно й було осмислене —
     * коли листок не дотягує до оболонки.
     */
    const envelopeScaleDelta = frontClosureSelected || signedError < 0
      ? 0
      : signedError * input.config.envelopeResponse * 0.45 * response;
    const normalizedFrontDepth = clamp(
      depth.renderFrontDepth / input.composition.bounds.radius,
      -1,
      1,
    );
    const frontWeight = frontCandidate
      ? clamp((normalizedFrontDepth + 0.08) / 0.58, 0.3, 1)
      : 0;
    const heightWeight = frontCandidate
      ? clamp((normalizedHeight - 0.18) / 0.56, 0.35, 1)
      : 0;
    const closureLayerWeight = frontClosureSelected
      ? 1
      : depth.layer === 'outer' && frontCandidate
        ? 0.34
        : 0;
    const frontClosureScaleDelta = input.config.frontClosureScaleDelta
      * closureLayerWeight
      * frontWeight
      * heightWeight
      * (0.72 + orientation.renderFacingDot * 0.28);
    const totalScaleDelta = depth.layer === 'inner'
      ? 0
      : clamp(
        envelopeScaleDelta + frontClosureScaleDelta,
        -input.config.maximumScaleDelta,
        input.config.maximumScaleDelta,
      );
    const renderRadialRatio = Math.hypot(renderRelativeX, renderRelativeZ)
      / input.composition.bounds.radius;
    /*
     * КАРТКА ТЕЖ НЕ ПЕРЕРОСТАЄ ОБОЛОНКУ.
     *
     * Збільшення картки — той самий рух назовні, тільки іншим важелем:
     * листок стоїть на місці, а його кінчик їде. Без цієї межі стеля
     * заводила листок під оболонку, а `envelopeScaleDelta` тут-таки
     * виштовхував його кінчик назад — і власна перевірка контракту
     * «похибка не зросла» ловила це на окремих листках (0.000718 ->
     * 0.000797).
     */
    const growthRoom = cardReachBefore > EPSILON
      ? Math.max(0, (targetRatio - renderRadialRatio) / cardReachBefore)
      : Number.POSITIVE_INFINITY;
    /*
     * Стеля тільки НЕ ДАЄ РОСТИ; зменшити картку вона не може.
     *
     * Місця під оболонкою іноді немає зовсім — біля самої маківки й під
     * низом крони оболонка вужча за довжину картки. Тоді це питання не
     * силуету, а геометрії листка (`leafGeometry`), і платити за нього
     * зникомим листком означало б проміняти видиму ваду на іншу видиму
     * ваду. Тому нижня межа тут — одиниця: картка лишається такою, якою її
     * зробили вище за течією.
     */
    const scaleMultiplier = round6(Math.min(
      1 + totalScaleDelta,
      Math.max(1, growthRoom),
    ));
    const renderSectorIndex = sectorIndex(
      renderRelativeX,
      renderRelativeZ,
      input.config.azimuthSectorCount,
    );
    const renderVerticalBandIndex = verticalBandIndex(
      renderPosition.y,
      input.composition.bounds.min.y,
      input.composition.bounds.height,
      input.config.verticalBandCount,
    );
    const cardReachAfter = (leaf.length * (depth.scaleMultiplier ?? 1) * scaleMultiplier)
      / input.composition.bounds.radius;
    const errorAfter = Math.abs(targetRatio - (renderRadialRatio + cardReachAfter));
    const adjusted = Math.abs(radialOffset) > EPSILON || Math.abs(scaleMultiplier - 1) > EPSILON;

    /*
     * ВНУТРІШНІЙ ЛИСТОК ТЕПЕР ТЕЖ БУВАЄ ЗСУНУТИЙ — ADR-0108.
     *
     * Доти лічильник був однозначний: `response` для внутрішнього шару
     * нуль, тобто його не чіпали ніколи. Стеля крони шарів не знає — листок
     * за оболонкою це листок поза кроною, хай яким глибоким його визнала
     * глибина крони, — тож внутрішніх зсунутих стало ненульове число, і
     * тотожність «зсунутих = зовнішні + середні» перестала бути правдою.
     * Замість того щоб її ослабити, заведено третій доданок.
     */
    if (depth.layer === 'inner') {
      if (adjusted) adjustedInnerLeafCount += 1;
      else untouchedInnerLeafCount += 1;
    }
    if (depth.layer === 'middle') {
      if (adjusted) adjustedMiddleLeafCount += 1;
      else untouchedMiddleLeafCount += 1;
    }
    if (depth.layer === 'outer') {
      sourceOuterSectors.add(sourceSectorIndex);
      renderOuterSectors.add(renderSectorIndex);
      outerErrorsBefore.push(errorBefore);
      outerErrorsAfter.push(errorAfter);
      if (adjusted) adjustedOuterLeafCount += 1;
    }
    if (frontClosureScaleDelta > EPSILON) frontClosureLeafCount += 1;
    if (frontClosureInwardOffsetRatio < -EPSILON) frontClosureInwardLeafCount += 1;
    if (adjusted) adjustedLeafCount += 1;
    maximumRadialOffset = Math.max(maximumRadialOffset, Math.abs(radialOffset));
    /*
     * СТЕЛЯ МІРЯЄТЬСЯ ОКРЕМИМ ЧИСЛОМ, і це та сама причина, з якої окремо
     * міряється затягування (`maximumFrontClosureInwardOffsetRatio`):
     * `maximumRadialOffsetRatio` означає «наскільки контракт дозволяє собі
     * ПІДСУНУТИ листок до оболонки», і його стеля в налаштуваннях — 0.08.
     * Стеля крони — не підсування, а межа існування: вона заводить листок
     * під оболонку на скільки треба. Класти обидва в одне число означало б
     * зробити перевірку «не більше за дозволене» безглуздою.
     */
    maximumRadialOffsetRatio = Math.max(
      maximumRadialOffsetRatio,
      frontClosureSelected || ceilingClamped ? 0 : Math.abs(radialOffsetRatio),
    );
    if (ceilingClamped) {
      maximumCeilingInwardOffsetRatio = Math.max(
        maximumCeilingInwardOffsetRatio,
        Math.abs(radialOffsetRatio),
      );
    }
    maximumFrontClosureInwardOffsetRatio = Math.max(
      maximumFrontClosureInwardOffsetRatio,
      Math.abs(frontClosureInwardOffsetRatio),
    );
    maximumScaleDelta = Math.max(maximumScaleDelta, Math.abs(scaleMultiplier - 1));

    profiles.push({
      id: `tree:crown-silhouette:${leaf.id}`,
      leafInstanceId: leaf.id,
      canopyDepthProfileId: depth.id,
      canopyLightProfileId: light.id,
      phenologyProfileId: phenology.id,
      leafOrientationProfileId: orientation.id,
      sequence: leaf.sequence,
      layer: depth.layer,
      crownCellId: depth.crownCellId,
      sourcePosition: { ...sourcePosition },
      renderPosition,
      sourceSectorIndex,
      renderSectorIndex,
      verticalBandIndex: sourceVerticalBandIndex,
      sourceRadialRatio,
      targetEnvelopeRatio: targetRatio,
      radialOffset,
      radialOffsetRatio,
      frontClosureSelected,
      ceilingClamped,
      frontClosureInwardOffsetRatio,
      frontClosureScaleDelta: round6(frontClosureScaleDelta),
      scaleMultiplier,
      envelopeErrorBefore: round6(errorBefore),
      envelopeErrorAfter: round6(errorAfter),
      adjusted,
    });

    if (sourceVerticalBandIndex !== renderVerticalBandIndex) {
      throw new Error('Tree Crown Silhouette must preserve vertical bands.');
    }
    if (sourceSectorIndex !== renderSectorIndex) {
      throw new Error('Tree Crown Silhouette must preserve azimuth sectors.');
    }
  }

  const occupiedOuterSectorIndices = [...sourceOuterSectors].sort((left, right) => left - right);
  const emptyOuterSectorIndices = Array.from(
    { length: input.config.azimuthSectorCount },
    (_, index) => index,
  ).filter((index) => !sourceOuterSectors.has(index));
  const renderEmptyOuterSectorIndices = Array.from(
    { length: input.config.azimuthSectorCount },
    (_, index) => index,
  ).filter((index) => !renderOuterSectors.has(index));
  const stableLeafOrderPreserved = profiles.every((profile, index) => (
    profile.sequence === input.leaves.instances[index]?.sequence
    && profile.leafInstanceId === input.leaves.instances[index]?.id
  ));
  const instanceCountPreserved = profiles.length === input.leaves.instances.length;
  const crownCellProvenancePreserved = profiles.every((profile, index) => (
    profile.crownCellId === input.canopyDepth.profiles[index]?.crownCellId
  ));
  const preservedEmptySectorIndices = emptyOuterSectorIndices.length === renderEmptyOuterSectorIndices.length
    && emptyOuterSectorIndices.every((value, index) => value === renderEmptyOuterSectorIndices[index]);
  const preservedVerticalBands = profiles.every((profile) => (
    profile.verticalBandIndex === verticalBandIndex(
      profile.renderPosition.y,
      input.composition.bounds.min.y,
      input.composition.bounds.height,
      input.config.verticalBandCount,
    )
  ));
  const averageEnvelopeErrorBefore = average(outerErrorsBefore);
  const averageEnvelopeErrorAfter = average(outerErrorsAfter);
  const silhouetteErrorNotIncreased = averageEnvelopeErrorAfter <= averageEnvelopeErrorBefore + 1e-9;
  const viewReadability = buildViewReadability(input, profiles);
  const minimumReadableFrontLeafFraction = viewReadability.length > 0
    ? Math.min(...viewReadability.map((view) => view.readableFrontLeafFraction))
    : 0;
  const viewReadabilityAccepted = viewReadability.every((view) => view.accepted);

  /*
   * Помилка НАЗИВАЄ умову, яка впала, а не сам факт падіння.
   *
   * Тут сходяться сім різних інваріантів, і повідомлення «preservation or
   * multi-view acceptance contract failed» однакове для всіх сімох. Коли
   * контракт упав на одинадцяти роках із сорока в однієї пари, з нього не
   * можна було дізнатись навіть того, геометрія це чи листя, — довелось
   * дописувати діагностику, щоб просто прочитати причину. Друге таке
   * розслідування вже не знадобиться.
   */
  const broken = [
    ['stableLeafOrder', stableLeafOrderPreserved],
    ['instanceCount', instanceCountPreserved],
    ['crownCellProvenance', crownCellProvenancePreserved],
    ['emptyOuterSectors', preservedEmptySectorIndices],
    ['verticalBands', preservedVerticalBands],
    ['silhouetteErrorNotIncreased', silhouetteErrorNotIncreased],
    ['viewReadability', viewReadabilityAccepted],
  ].filter(([, ok]) => !ok).map(([name]) => name);

  if (broken.length > 0) {
    throw new Error(
      `Tree Crown Silhouette preservation or multi-view acceptance contract failed: ${broken.join(', ')}`
      + ` (найгірша частка читаного листя ${minimumReadableFrontLeafFraction.toFixed(3)}`
      + ` за порогу ${input.config.minimumReadableLeafFraction};`
      + ` листя попереду в найгіршому напрямку: ${
        viewReadability.filter((view) => !view.accepted)
          .map((view) => `${view.frontLeafCount}/${view.readableFrontLeafCount}`).join(' ')
      })`,
    );
  }

  const stateWithoutSignature: Omit<TreeCrownSilhouetteState, 'signature'> = {
    treeCrownSilhouetteVersion: 1,
    rulesVersion: input.config.rulesVersion.trim(),
    sourceCompositionVersion: input.composition.treeCompositionVersion,
    sourceCompositionRulesVersion: input.composition.rulesVersion,
    sourceLeafGeometryVersion: input.leaves.treeLeafGeometryVersion,
    sourceLeafGeometryRulesVersion: input.leaves.rulesVersion,
    sourceCanopyDepthVersion: input.canopyDepth.treeCanopyDepthVersion,
    sourceCanopyDepthRulesVersion: input.canopyDepth.rulesVersion,
    sourceCanopyDepthSignature: input.canopyDepth.signature,
    sourceCanopyLightVersion: input.canopyLight.treeCanopyLightVersion,
    sourceCanopyLightRulesVersion: input.canopyLight.rulesVersion,
    sourceCanopyLightSignature: input.canopyLight.signature,
    sourcePhenologyVersion: input.phenology.treePhenologyVersion,
    sourcePhenologyRulesVersion: input.phenology.rulesVersion,
    sourcePhenologySignature: input.phenology.signature,
    sourceLeafOrientationVersion: input.leafOrientation.treeLeafOrientationVersion,
    sourceLeafOrientationRulesVersion: input.leafOrientation.rulesVersion,
    sourceLeafOrientationSignature: input.leafOrientation.signature,
    artifactSeed: input.leaves.artifactSeed,
    lod: input.leaves.lod,
    descriptor: {
      id: 'tree:crown-silhouette:polish',
      profileId: 'tree:crown-silhouette:instance-profile',
      matrixAttributeId: 'tree:crown-silhouette:instance-matrix',
      negativeSpaceId: 'tree:crown-silhouette:negative-space',
      sourceGeometryId: 'tree:leaf:instances',
    },
    profiles,
    diagnostics: {
      sourceLeafCount: input.leaves.instances.length,
      emittedProfileCount: profiles.length,
      adjustedLeafCount,
      adjustedOuterLeafCount,
      adjustedMiddleLeafCount,
      adjustedInnerLeafCount,
      frontClosureLeafCount,
      frontClosureInwardLeafCount,
      untouchedInnerLeafCount,
      ceilingClampedLeafCount,
      untouchedMiddleLeafCount,
      occupiedOuterSectorIndices,
      emptyOuterSectorIndices,
      occupiedOuterSectorCount: occupiedOuterSectorIndices.length,
      emptyOuterSectorCount: emptyOuterSectorIndices.length,
      maximumRadialOffset: round6(maximumRadialOffset),
      maximumRadialOffsetRatio: round6(maximumRadialOffsetRatio),
      maximumFrontClosureInwardOffsetRatio: round6(maximumFrontClosureInwardOffsetRatio),
      maximumCeilingInwardOffsetRatio: round6(maximumCeilingInwardOffsetRatio),
      maximumScaleDelta: round6(maximumScaleDelta),
      averageEnvelopeErrorBefore: round6(averageEnvelopeErrorBefore),
      averageEnvelopeErrorAfter: round6(averageEnvelopeErrorAfter),
      viewReadability,
      minimumReadableFrontLeafFraction: round6(minimumReadableFrontLeafFraction),
      viewReadabilityAccepted: true,
      stableLeafOrderPreserved: true,
      instanceCountPreserved: true,
      crownCellProvenancePreserved: true,
      preservedEmptySectorIndices: true,
      filledPreviouslyEmptySectors: false,
      preservedVerticalBands: true,
      silhouetteErrorNotIncreased: true,
      negativeSpaceAccepted: true,
      estimatedAdditionalDrawCalls: 0,
      estimatedAdditionalMaterials: 0,
      estimatedAdditionalMatrixUpdatesPerFrame: 0,
    },
  };

  return {
    ...stateWithoutSignature,
    signature: signatureFor(stateWithoutSignature),
  };
}