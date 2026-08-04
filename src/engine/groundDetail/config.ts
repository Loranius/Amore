import type { TreeGroundDetailConfig } from './types';

export const DEFAULT_TREE_GROUND_DETAIL_CONFIG: TreeGroundDetailConfig = {
  rulesVersion: 'tree-ground-detail-v1.1.0',
  // Утричі менше. Сімдесят два дрібні предмети, рівно розкидані по диску,
  // читались як посипка на печиві — і кількість тут важила більше за колір.
  //
  // Порівну по видах лишається навмисно: нижчі LOD мусять бути префіксами
  // вищих (див. тест на стабільні префікси), а нерівні частки цю властивість
  // ламають — інстанси йдуть по колу за видами, тож обрізання нерівних
  // бюджетів дає інший порядок, а не коротший той самий.
  maximumInstancesByKindByLod: {
    high: { stone: 12, 'fallen-leaf': 12, moss: 12 },
    medium: { stone: 8, 'fallen-leaf': 8, moss: 8 },
    low: { stone: 4, 'fallen-leaf': 4, moss: 4 },
  },
  innerRadiusRatio: 0.3,
  outerRadiusRatio: 0.92,
  radialJitterRatio: 0.035,
  maximumTemplateVertices: 16,
  maximumTemplateTriangles: 24,
  colorQuantizationSteps: 16,
};
