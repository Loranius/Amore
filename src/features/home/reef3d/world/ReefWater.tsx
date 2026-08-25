// ============================================================
// Шар 1 — вода й світло.
// ------------------------------------------------------------
// Стара сцена мала шістнадцять шарів середовища: атмосфера, далека
// екосистема, щільність, мікрожиття, біоплівка, водорості, кит… Кожен
// сам по собі був невеликий, разом вони давали каламуть, у якій риф не
// читався.
//
// Тут середовище робить рівно три речі, і кожна названа:
//   — колір води за глибиною (туман, а не тло: далеке тане, близьке ні);
//   — сонце крізь товщу зверху, трохи збоку;
//   — заповнювальне світло знизу, від піску, щоб низ рифа не був чорним.
// ============================================================
import { Color, FogExp2 } from 'three';
import { useThree } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import type { ReefTheme } from '@/engine/species/reef/coralPalette';

/**
 * Вода двох тем.
 *
 * Темна — глибина, куди дійшло мало світла. Світла — мілина в полудень.
 * Це не «та сама сцена, тільки світліша»: у мілини інший колір, бо там
 * вода ще не з'їла червоне.
 */
const WATER: Readonly<Record<ReefTheme, {
  /** Колір ВОДИ: туман і тло. Що далі, то більше його. */
  deep: string;
  /** Колір СВІТЛА, а не води. Це різні речі, і плутати їх дорого. */
  sun: string;
  sunPower: number;
  /** Відбите від піску знизу. */
  bounce: string;
  bouncePower: number;
  density: number;
}>> = {
  /*
   * ЧОМУ КОЛІР СВІТЛА ОКРЕМО ВІД КОЛЬОРУ ВОДИ.
   *
   * Перша редакція світила самою водою: `#0d3350` як колір
   * спрямованого світла. На знімку риф вийшов чорним силуетом —
   * і правильно, бо (13, 51, 80) при силі 1.35 дає приблизно чверть
   * яскравості, ще й синьою. Вода темна ЗАВЖДИ; світло, що крізь неї
   * пройшло, — ні, інакше під водою нічого не було б видно взагалі.
   */
  dark: {
    deep: '#04121f',
    sun: '#d8f2ff', sunPower: 2.4,
    bounce: '#5f93ad', bouncePower: 0.85,
    density: 0.115,
  },
  light: {
    deep: '#7fc2d8',
    sun: '#ffffff', sunPower: 2.9,
    bounce: '#cfe6d8', bouncePower: 1.15,
    density: 0.075,
  },
};

interface ReefWaterProps {
  theme: ReefTheme;
  /** Найбільша відстань у сцені — туман міряється нею, а не числом зі стелі. */
  sceneRadius: number;
}

export function ReefWater({ theme, sceneRadius }: ReefWaterProps): React.JSX.Element {
  const scene = useThree((state) => state.scene);
  const water = WATER[theme];

  const fog = useMemo(
    // Щільність рахується від розміру сцени: на рифі двадцятип'ятирічної
    // пари стала щільність з'їла б дальні колонії, а на однорічному
    // рифі не робила б нічого.
    () => new FogExp2(new Color(water.deep).getHex(), water.density / Math.max(0.35, sceneRadius)),
    [water.deep, water.density, sceneRadius],
  );

  useEffect(() => {
    const previousFog = scene.fog;
    const previousBackground = scene.background;
    scene.fog = fog;
    scene.background = new Color(water.deep);
    return () => {
      scene.fog = previousFog;
      scene.background = previousBackground;
    };
  }, [fog, scene, water.deep]);

  return (
    <>
      {/* Сонце крізь товщу: майже згори, трохи збоку — тіні від колоній
          мають лягати на голову, інакше рельєф зникає. */}
      <directionalLight
        position={[sceneRadius * 0.6, sceneRadius * 1.9, sceneRadius * 0.9]}
        intensity={water.sunPower}
        color={water.sun}
      />
      {/* Відбите від піску. Без нього низ голови глухо чорний, і риф
          читається вирізаним із паперу. */}
      <hemisphereLight args={[water.sun, water.bounce, water.bouncePower]} />
      <ambientLight intensity={water.bouncePower * 0.45} color={water.bounce} />
    </>
  );
}
