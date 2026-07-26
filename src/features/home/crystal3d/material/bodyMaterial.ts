// ============================================================
// bodyMaterial — PBR-параметри тіла й ключ батча (Volume VI).
// ------------------------------------------------------------
// Нормативно: Volume_06_Material_Engine §4-§6 (surface properties).
//
// Донедавна ці числа жили просто в JSX сцени, а dev-харнес мав їхню копію.
// Тепер вони тут з двох причин:
//   • це матеріальні властивості, тобто Volume VI, а не рендер-компонент;
//   • батчинг групує тіла ЗА МАТЕРІАЛОМ, тож потрібен стабільний ключ. А
//     ключ, порахований окремо від самих параметрів, рано чи пізно з ними
//     розійдеться — і два тіла з різними матеріалами тихо потраплять в
//     один батч. Тому ключ будується З ТОГО САМОГО об'єкта параметрів.
//
// `transmission` НАВМИСНО завжди 0: реального заломлення в сцені немає —
// воно вмикає окремий render pass THREE.WebGLRenderer для ВСІЄЇ сцени,
// який при прозорому canvas підставляє білий clear-колір (саме це давало
// білий фон на реальних пристроях). Див. заголовок CrystalScene.tsx.
// ============================================================
import type { ClusterBranch, ClusterMaterial } from '../crystalCluster';

export interface BodyMaterialProps {
  roughness: number;
  metalness: number;
  clearcoat: number;
  clearcoatRoughness: number;
  ior: number;
  reflectivity: number;
  emissive: string;
  emissiveIntensity: number;
}

/**
 * Оптика одного тіла. Ієрархія композиції читається не лише в розмірах:
 * монарх — найчистіший (найглибший clearcoat, найнижчий roughness),
 * milestone — золоте світіння вехи, мікрошар — матовіший «пил».
 */
export function bodyMaterialProps(branch: ClusterBranch, material: ClusterMaterial): BodyMaterialProps {
  const coreGlow = branch.kind === 'core' ? material.glow * 0.5 : 0;
  // Монарх друзи: скляна чистота без transmission (заборонений — див. вище)
  // і без opacity (перетинні мешi без сортування артефачать).
  const primary = branch.primary && !branch.emissive;
  const micro = branch.tier === 'micro';
  const support = branch.tier === 'support' && !branch.emissive;

  return {
    roughness: branch.emissive
      ? 0.06
      : primary
        ? 0.03
        : micro
          ? Math.min(0.5, material.roughness * 1.6)
          : Math.max(0.04, material.roughness * 0.5),
    metalness: branch.emissive ? 0.1 : 0,
    clearcoat: branch.emissive
      ? 0.95
      : primary
        ? 1
        : support
          ? Math.min(1, material.clearcoat + 0.35)
          : micro
            ? material.clearcoat * 0.4
            : Math.min(1, material.clearcoat + 0.25),
    clearcoatRoughness: primary ? 0.02 : 0.04,
    ior: 1.6,
    reflectivity: branch.emissive ? 0.8 : primary ? 0.9 : 0.7,
    emissive: branch.emissive ? '#e8b23d' : '#ff9d5c',
    emissiveIntensity: branch.emissive ? 0.4 : primary ? Math.max(coreGlow, 0.12) : coreGlow,
  };
}

/**
 * Ключ батча — детермінована серіалізація ВСІХ параметрів. Будується з
 * того самого об'єкта, що йде в матеріал, тож не може розійтися з ним:
 * додане поле автоматично потрапляє в ключ.
 *
 * Числа округлюються до 6 знаків, щоб мікроскопічна різниця в float не
 * плодила батчі, які око все одно не розрізнить.
 */
export function materialSignature(props: BodyMaterialProps): string {
  return (Object.keys(props) as (keyof BodyMaterialProps)[])
    .sort()
    .map((k) => {
      const v = props[k];
      return `${k}=${typeof v === 'number' ? v.toFixed(6) : v}`;
    })
    .join('|');
}
