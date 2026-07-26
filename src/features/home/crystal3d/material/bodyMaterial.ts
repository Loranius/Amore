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
import { DEFAULT_GFX, type GfxProfile } from '../render/gfxProfile';

export interface BodyMaterialProps {
  roughness: number;
  metalness: number;
  clearcoat: number;
  clearcoatRoughness: number;
  ior: number;
  reflectivity: number;
  emissive: string;
  emissiveIntensity: number;
  /** Іризація (`MeshPhysicalMaterial.iridescence`) — тонкоплівковий перелив
   *  по гранях. Чистий шейдер: ані render target, ані текстури. */
  iridescence: number;
  iridescenceIOR: number;
  /** Товщина плівки в нм — визначає, ЯКИЙ саме колір дає перелив. */
  iridescenceThickness: number;
  /** Сила відбиття КАРТИ оточення. Має сенс лише під `?gfx=env`; без мапи
   *  three це поле просто ігнорує. */
  envMapIntensity: number;
  // ── Відбиття без карти оточення (render/skyReflection.ts) ───────
  /** Сила френелівського краю. */
  rimStrength: number;
  /** Сила підмішаного «неба/землі». */
  skyStrength: number;
  skyColor: string;
  groundColor: string;
  rimColor: string;
}

/**
 * Оптика одного тіла. Ієрархія композиції читається не лише в розмірах:
 * монарх — найчистіший (найглибший clearcoat, найнижчий roughness),
 * milestone — золоте світіння вехи, мікрошар — матовіший «пил».
 */
export function bodyMaterialProps(
  branch: ClusterBranch,
  material: ClusterMaterial,
  gfx: GfxProfile = DEFAULT_GFX,
): BodyMaterialProps {
  // «Чим більше фільмів, тим яскравіший кристал». Світіння ядра росло лише
  // від спогадів (Luminosity), а фільми міняли самий ТОН (`movieMix`) —
  // тобто прохання власника не виконувалось узагалі. Тепер спільно
  // переглянуте додає СИЛИ тому самому світлу: множник, а не новий колір,
  // щоб дві грані матеріалу не сперечались за одне й те саме.
  const coreGlow = branch.kind === 'core' ? material.glow * 0.5 * (1 + material.brilliance * 0.8) : 0;
  // Монарх друзи: скляна чистота без transmission (заборонений — див. вище)
  // і без opacity (перетинні мешi без сортування артефачать).
  const primary = branch.primary && !branch.emissive;
  const micro = branch.tier === 'micro';
  const support = branch.tier === 'support' && !branch.emissive;

  // Іризація — «полірований» бік матеріалу, тож іде від Refinement (фото),
  // разом із roughness/clearcoat і гамуванням джиттера граней. Мікрошар
  // лишається матовим пилом, віхи — золотими, а не веселковими.
  // За замовчуванням ВИМКНЕНА (gfx.iridescence === false): заміряно, що в
  // цій сцені вона невидима — див. render/gfxProfile.ts.
  const iridescence = gfx.iridescence && !branch.emissive && !micro ? 0.15 + material.polish * 0.5 : 0;
  // Товщина плівки зсувається від тону фільмів: холодніша палітра —
  // товща плівка (синьо-зелений перелив), тепла — тонша (бурштиновий).
  const iridescenceThickness = 260 + material.movieMix * 180;

  // Небо у відбитті: холодне згори, тепле знизу. Рецепти (Warmth) роблять
  // «землю» теплішою, фільми (movieMix) — «небо» холоднішим. Це не декор:
  // ті самі два тиски вже фарбують саме тіло (crystalMaterial.ts), тож
  // оточення й мінерал лишаються однією палітрою.
  const warm = material.warmthMix;
  const cool = material.movieMix;
  const skyColor = cool > 0.25 ? '#e4f0ff' : '#f2f6ff';
  const groundColor = warm > 0.3 ? '#f2c2a6' : '#f6cbd8';
  const rimColor = branch.emissive ? '#ffe0a3' : '#ffeef5';
  // Пил не має світитись краями — інакше мікрошар перетворюється на туман.
  // Коли ввімкнена СПРАВЖНЯ карта оточення, підробку прибираємо: інакше
  // відбиття наклалося б саме на себе й тіла пересвітились би.
  const glass = gfx.glass && !gfx.env;
  // Заміряно на рендерах: карта оточення з інтенсивністю 1 заливає масу
  // майже білим і з'їдає кольори, якими закодована історія пари
  // (meanDelta 39.8 проти 4.3 у шейдерного скла). Тому відбиття стоїть
  // помітно нижче одиниці — воно має ДОДАВАТИ блиску, а не підміняти
  // собою власний колір мінералу.
  const envMapIntensity = gfx.env ? (micro ? 0.18 : primary ? 0.45 : 0.32) : 0;
  const rimStrength = glass ? (micro ? 0.08 : primary ? 0.5 : 0.38) : 0;
  const skyStrength = glass ? (micro ? 0.05 : 0.15) : 0;

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
    envMapIntensity,
    iridescence,
    iridescenceIOR: 1.3,
    iridescenceThickness,
    rimStrength,
    skyStrength,
    skyColor,
    groundColor,
    rimColor,
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
