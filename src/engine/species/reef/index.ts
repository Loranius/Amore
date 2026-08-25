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
  ANNUAL_BODIES_MAX,
  ANNUAL_BODIES_MIN,
  ANNUAL_DENSITY_FLOOR,
  ANNUAL_HEAD_SHARE,
  reefAnnualColonySize,
  reefColonyAnchor,
  reefColonyAzimuthRad,
  reefColonyBand,
  reefColonyLayout,
  reefHeadScale,
  reefHeadSize,
  yearFill,
  type ReefAnnualColonySize,
  type ReefColonyAnchor,
  type ReefHeadSize,
} from './colonyFormations';

// Тіла всередині однієї річної колонії.
export { reefColonyBodies, type ReefCoralBody } from './colonyBodies';

// Складання: історія пари → повний план рифа.
export {
  buildReefPlan,
  reefHistoryFromArtifact,
  type BuildReefPlanInput,
  type ReefColonyPlan,
  type ReefHistoryEvent,
  type ReefPlan,
} from './reefAssembly';

// Форма: купол голови, коралові тіла, риба.
export { buildReefHeadMesh, type ReefMeshData } from './headMesh';
export { buildReefColonyMesh } from './bodyMesh';
export { buildReefFishEyeMesh, buildReefFishMesh } from './fishMesh';
export {
  FISH_MAX,
  FISH_MIN,
  REEF_FISH_COLOURS,
  reefFishSchool,
  type ReefFish,
} from './fishSchool';

// Палітра пари й постановка сцени.
export {
  reefCoupleHue,
  reefCoupleTint,
  type ReefTheme,
  type ReefTint,
} from './coralPalette';
export {
  REEF_CAMERA_FOV_DEG,
  reefCameraFrame,
  reefStanding,
  type ReefCameraFrame,
  type ReefStanding,
} from './reefStaging';
