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
import { useMemo } from 'react';
import { buildReefHeadMesh } from '@/engine/species/reef/headMesh';
import type { ReefStanding } from '@/engine/species/reef/reefStaging';
import type { ReefTheme } from '@/engine/species/reef/coralPalette';
import { reefGeometryOf } from './reefGeometry';

/*
 * ПІСОК СВІТЛИЙ, і це половина атмосфери референсів.
 *
 * Було `#16303f` у темній темі — темніше за саму воду. Через це риф
 * стояв ніби в ямі: дно поглинало світло, замість відбивати його. На
 * всіх п'яти кадрах власника дно СВІТЛІШЕ за воду над ним, і саме воно
 * підсвічує риф знизу — тому й камінь на них не має чорного боку.
 */
const ROCK: Readonly<Record<ReefTheme, { stone: string; sand: string }>> = {
  dark: { stone: '#4a5a63', sand: '#a9bcbd' },
  light: { stone: '#b3bdb9', sand: '#eef2e6' },
};

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
  const sandRadius = standing.rock.radius * 30;

  return (
    <group>
      <mesh geometry={geometry} castShadow={false} receiveShadow>
        <meshStandardMaterial color={palette.stone} roughness={0.95} metalness={0} flatShading />
      </mesh>
      {/*
        * Пісок має бути ВЕЛИКИЙ і світлий. Перша редакція давала диск на
        * шість радіусів каменя: у кадрі він читався пласкою тарілкою з
        * видимим краєм, на якій лежить риф. Чотирнадцяти теж не
        * вистачило — рівний край далі було видно. Тридцять радіусів
        * означає, що на тій відстані туман уже щільніший за 0.999, тобто
        * краю немає взагалі: горизонт тут робить вода, а не геометрія.
        */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.001, 0]} receiveShadow>
        <circleGeometry args={[sandRadius, 48]} />
        <meshStandardMaterial color={palette.sand} roughness={1} metalness={0} />
      </mesh>
    </group>
  );
}
