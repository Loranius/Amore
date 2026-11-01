// ============================================================
// Риф: закон росту, форма й палітра.
// ------------------------------------------------------------
// Те, що тут експортується, і є весь вид. Порівняння з тим, що було до
// перепису, варте одного рядка: сімнадцять тисяч рядків старої
// підсистеми (каскадні тераси, вулкан, арки, біоплівка, мікрожиття,
// контракт приймання на чотири файли) замінені законом росту, двома
// мешами, палітрою й зграєю.
//
// Порядок такий самий, як у кристала: закон → складання → форма.
// ============================================================

// Закон росту: голова, річні колонії, їхня розкладка на куполі.
export {
  ANNUAL_HEAD_SHARE,
  reefHeadScale,
  reefHeadSize,
  yearFill,
  type ReefAnnualColonySize,
  type ReefColonyAnchor,
  type ReefHeadSize,
} from './colonyFormations';

// Тіла всередині однієї річної колонії.
export { type ReefCoralBody } from './colonyBodies';

// Складання: історія пари → повний план рифа.
export {
  buildReefPlan,
  type BuildReefPlanInput,
  type ReefColonyPlan,
  type ReefHistoryEvent,
  type ReefPlan,
} from './reefAssembly';

// Мірка силуету: одна функція на еталон і на генератор (ADR-0182).
export {
  REEF_REFERENCE,
  reefSilhouetteProfile,
  type ReefSilhouette,
} from './reefProfile';

// Форма: купол голови, коралові тіла, риба.
export { type ReefMeshData } from './headMesh';
export {
  type ReefFish,
} from './fishSchool';

// Палітра пари й постановка сцени.
export {
  type ReefTheme,
  type ReefTint,
} from './coralPalette';
export {
  type ReefCameraFrame,
  type ReefStanding,
} from './reefStaging';
