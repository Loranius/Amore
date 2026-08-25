// ============================================================
// Шар 2 — камінь.
// ------------------------------------------------------------
// На чому риф стоїть. Дві речі й нічого більше: виступ під головою і
// пісок під ним.
//
// Виступ будується ТИМ САМИМ куполом, що й голова, тільки ширшим,
// пласкішим і з іншим насінням. Це не економія: камінь під кораловим
// масивом — то і є старий, обростений вапняк, а не інша порода. Спільна
// побудова означає ще й спільну перевірку: усе, що доведено про купол
// (замкнений, без вироджених трикутників, з невидимою кришкою),
// доведено й про камінь.
// ============================================================
import { useEffect, useMemo, useRef } from 'react';
import { AdditiveBlending, type MeshBasicMaterial } from 'three';
import { useFrame } from '@react-three/fiber';
import { buildReefHeadMesh } from '@/engine/species/reef/headMesh';
import type { ReefStanding } from '@/engine/species/reef/reefStaging';
import type { ReefTheme } from '@/engine/species/reef/coralPalette';
import { reefGeometryOf } from './reefGeometry';
import { buildReefSeabed } from './reefSeabed';
import { buildReefCausticsTexture } from './reefCaustics';

/*
 * ПІСОК СВІТЛИЙ, і це половина атмосфери референсів.
 *
 * Було `#16303f` у темній темі — темніше за саму воду. Через це риф
 * стояв ніби в ямі: дно поглинало світло, замість відбивати його. На
 * всіх п'яти кадрах власника дно СВІТЛІШЕ за воду над ним, і саме воно
 * підсвічує риф знизу — тому й камінь на них не має чорного боку.
 */
/*
 * КАМІНЬ СВІТЛІШАЄ РАЗОМ ІЗ ДНОМ.
 *
 * Коли пісок став світлим, камінь `#4a5a63` перетворився на чорну діру
 * посеред нього: різниця яскравості вийшла втричі. Виступ рифа — це
 * той самий вапняк, присипаний тим самим піском, і читатись він має
 * породою, а не проваллям.
 *
 * Пісок — теплий. Під водою його тягне в сірий, і перша редакція
 * зробила його сіро-зеленим одразу; на референсах він лишається
 * піщаним, а синім його робить товща води, тобто туман, а не колір.
 */
const ROCK: Readonly<Record<ReefTheme, { stone: string; sand: string; caustic: string }>> = {
  dark: { stone: '#78827c', sand: '#b8ae95', caustic: '#9fe4ff' },
  light: { stone: '#c0c3b6', sand: '#e8dfc4', caustic: '#ffffff' },
};

/** Наскільки яскрава сітка світла на дні. */
const CAUSTIC_STRENGTH: Readonly<Record<ReefTheme, number>> = { dark: 0.55, light: 0.38 };

/** Скільки разів каустика вкладається в дно і як швидко пливе. */
const CAUSTIC_TILES = 13;
const CAUSTIC_DRIFT = 0.012;

interface ReefRockProps {
  standing: ReefStanding;
  seed: number;
  theme: ReefTheme;
}

export function ReefRock({ standing, seed, theme }: ReefRockProps): React.JSX.Element {
  // Насіння каменя — не насіння голови: інакше горби каменя повторювали
  // б горби голови, і з-під неї стирчала б її ж копія.
  const geometry = useMemo(
    () => reefGeometryOf(buildReefHeadMesh(standing.rock, seed ^ 0x5eaf10c)),
    [seed, standing.rock],
  );
  const palette = ROCK[theme];

  /*
   * Дно — сітка з рельєфом, а не коло.
   *
   * Тридцять радіусів каменя, але сітка згущується до центру: далеке
   * однаково з'їдає туман, і рівномірна сітка витратила б туди
   * дев'ять десятих вершин.
   */
  const seabed = useMemo(
    () => buildReefSeabed(standing.rock.radius, standing.rock.radius * 13),
    [standing.rock.radius],
  );
  useEffect(() => () => seabed.geometry.dispose(), [seabed]);

  const caustics = useMemo(() => {
    const texture = buildReefCausticsTexture();
    if (texture) texture.repeat.set(CAUSTIC_TILES, CAUSTIC_TILES);
    return texture;
  }, []);
  useEffect(() => () => caustics?.dispose(), [caustics]);
  const causticsMaterial = useRef<MeshBasicMaterial>(null);

  /*
   * Сітка світла ПЛИВЕ. Нерухома каустика — це візерунок на килимі;
   * рухома — поверхня води над головою. Рух повільний і в двох осях із
   * різною швидкістю, щоб не читався прокруткою шпалер.
   */
  useFrame((state) => {
    if (!caustics) return;
    const time = state.clock.elapsedTime;
    caustics.offset.set(time * CAUSTIC_DRIFT, time * CAUSTIC_DRIFT * 0.62);
    const material = causticsMaterial.current;
    if (material) {
      // Дихання яскравості: хвиля нагорі не стоїть на місці.
      material.opacity = CAUSTIC_STRENGTH[theme] * (0.78 + 0.22 * Math.sin(time * 0.45));
    }
  });

  return (
    <group>
      {/*
        * Камінь сідає НИЖЧЕ за найглибшу западину дна: інакше на
        * якомусь боці між ним і піском лишалась би щілина, крізь яку
        * видно порожнечу.
        */}
      <mesh geometry={geometry} position={[0, seabed.lowest - 0.001, 0]} receiveShadow>
        <meshStandardMaterial color={palette.stone} roughness={0.95} metalness={0} flatShading />
      </mesh>
      <mesh geometry={seabed.geometry} receiveShadow>
        <meshStandardMaterial
          color={palette.sand}
          vertexColors
          roughness={1}
          metalness={0}
        />
      </mesh>
      {/*
        * Каустика лягає на ТУ САМУ сітку, а не на площину над нею:
        * інакше вона висіла б над дюнами й читалась плівкою. Другий
        * прохід тією ж геометрією — один зайвий виклик малювання на
        * головну ознаку того, що це вода.
        */}
      {caustics ? (
        <mesh geometry={seabed.geometry} renderOrder={1}>
          <meshBasicMaterial
            ref={causticsMaterial}
            map={caustics}
            color={palette.caustic}
            /*
              * `vertexColors` тут гасить каустику вдалині тим самим
              * серпанком, що й пісок, а `fog={false}` — обов'язковий:
              * туман на ДОДАВАЛЬНОМУ шарі не гасить його, а додає свій
              * колір, і дно вдалині ставало білою стіною.
              */
            vertexColors
            fog={false}
            transparent
            opacity={CAUSTIC_STRENGTH[theme]}
            depthWrite={false}
            blending={AdditiveBlending}
            polygonOffset
            polygonOffsetFactor={-1}
          />
        </mesh>
      ) : null}
    </group>
  );
}
