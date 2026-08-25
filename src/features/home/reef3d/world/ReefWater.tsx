// ============================================================
// Шар 1 — вода й світло.
// ------------------------------------------------------------
// Стара сцена мала шістнадцять шарів середовища: атмосфера, далека
// екосистема, щільність, мікрожиття, біоплівка, водорості, кит… Кожен
// сам по собі був невеликий, разом вони давали каламуть, у якій риф не
// читався.
//
// Тут середовище робить п'ять речей, і кожна названа:
//   — колір води за глибиною (туман, а не тло: далеке тане, близьке ні);
//   — сонце крізь товщу зверху, трохи збоку;
//   — заповнювальне світло знизу, від піску, щоб низ рифа не був чорним;
//   — ПОВЕРХНЯ високо вгорі, яку видно знизу як світлу стелю;
//   — СОНЯЧНІ ПРОМЕНІ крізь товщу.
//
// Останні дві додано за референсами власника. Спільне в усіх п'яти
// кадрів — не корал і не риба, а світло: похилі стовпи від поверхні,
// що тануть, не діставши дна, і яскрава стеля над ними. Без них вода
// читається кольоровим тлом, а не товщею, крізь яку дивишся.
// ============================================================
import { AdditiveBlending, Color, DoubleSide, FogExp2 } from 'three';
import { useThree } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import type { ReefTheme } from '@/engine/species/reef/coralPalette';
import { buildReefShaftGeometry } from './reefShafts';

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
  /** Поверхня, якою її видно знизу. */
  ceiling: string;
  /** Колір самих променів. */
  shaft: string;
  shaftPower: number;
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
    /*
     * Не чорнота, а СИНЯ ГЛИБИНА. Було `#04121f` — майже чорне, і риф
     * стояв у порожнечі. На референсах навіть найтемніша вода лишається
     * синьою: чорніє не вода, чорніють тіні в ній.
     */
    deep: '#072c47',
    ceiling: '#2f86b4',
    sun: '#dff4ff', sunPower: 2.6,
    bounce: '#6ea8c4', bouncePower: 0.95,
    density: 0.105,
    shaft: '#bfe6ff', shaftPower: 0.7,
  },
  light: {
    deep: '#63b6d4',
    ceiling: '#dff6fb',
    sun: '#ffffff', sunPower: 3.0,
    bounce: '#d6ecdf', bouncePower: 1.2,
    density: 0.062,
    shaft: '#ffffff', shaftPower: 0.5,
  },
};

/** Де стоїть поверхня води, у радіусах сцени. */
const CEILING_AT = 7.5;

interface ReefWaterProps {
  theme: ReefTheme;
  /** Найбільша відстань у сцені — туман міряється нею, а не числом зі стелі. */
  sceneRadius: number;
  /** Насіння пари: промені стоять у неї по-своєму й не рухаються між візитами. */
  seed: number;
}

export function ReefWater({ theme, sceneRadius, seed }: ReefWaterProps): React.JSX.Element {
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

  const shafts = useMemo(
    () => buildReefShaftGeometry(sceneRadius, sceneRadius * CEILING_AT * 0.62, seed),
    [sceneRadius, seed],
  );
  useEffect(() => () => shafts.dispose(), [shafts]);

  return (
    <>
      {/*
        * Поверхня — одна площина високо вгорі. Її не роздивляються: вона
        * дає верхньому краю кадру світло, від якого низ читається
        * глибиною. Без неї над рифом рівний колір, і глибина зникає.
        */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, sceneRadius * CEILING_AT, 0]}>
        <circleGeometry args={[sceneRadius * CEILING_AT * 2.4, 24]} />
        <meshBasicMaterial color={water.ceiling} fog={false} />
      </mesh>
      <mesh geometry={shafts} renderOrder={2}>
        {/*
          * Додавання, без запису глибини: промінь СВІТИТЬ, а не
          * заступає. Із записом глибини риба за ним зникала б, і це
          * читалось би вадою, а не світлом.
          */}
        <meshBasicMaterial
          color={water.shaft}
          vertexColors
          transparent
          opacity={water.shaftPower}
          depthWrite={false}
          blending={AdditiveBlending}
          side={DoubleSide}
          fog={false}
        />
      </mesh>
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
