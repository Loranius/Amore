// ============================================================
// Шар 3 — сам риф: голова й річні колонії.
// ------------------------------------------------------------
// Тут не вирішується нічого. План уже готовий (`buildReefPlan`), меші
// теж (`headMesh`, `bodyMesh`) — цей файл лише кладе їх у сцену й дає
// матеріали.
//
// ОДИН МЕШ НА КОЛОНІЮ, а не на тіло: у повній історії тіл під чотири
// сотні, і чотириста викликів малювання коштували б дорожче за всю
// решту сцени разом. Голова — ще один. Тобто на двадцятип'ятирічний
// риф — двадцять шість викликів, а не чотириста.
// ============================================================
import { useEffect, useMemo } from 'react';
import { Color, MeshStandardMaterial } from 'three';
import type { ReefPlan } from '@/engine/species/reef/reefAssembly';
import { reefColonyTint, type ReefTheme } from '@/engine/species/reef/coralPalette';
import type { ReefMeshes } from './useReefMeshes';
import { applyReefStoneSurface } from './reefStoneSurface';

/**
 * Голова темніша й глухіша за колонії, і це не смак.
 *
 * Голова — старий вапняк, який колонії обросли зверху; живе на ній те,
 * що виросло за роки. Якби вони були одного тону, річні колонії зникли
 * б у ній, і літопис, заради якого все це будується, не читався б.
 */
const HEAD_DARKEN: Readonly<Record<ReefTheme, number>> = { dark: 0.34, light: 0.55 };

/**
 * І ЗНЕБАРВЛЕНА, а не просто темніша.
 *
 * Самого затемнення не вистачило: на знімку голова й колонії читались
 * одним запиленим тоном, бо однаковий відтінок при різній яскравості
 * око зчитує як тінь, а не як інший матеріал. Голова — камінь, і
 * кольору пари в ній має лишитись слід, а не повна міра.
 */
const HEAD_DRAIN = 0.55;

interface ReefColoniesProps {
  plan: ReefPlan;
  meshes: ReefMeshes;
  theme: ReefTheme;
  /** На яку висоту підняти риф, щоб основа голови сховалась у камені. */
  lift: number;
}

export function ReefColonies({ plan, meshes, theme, lift }: ReefColoniesProps): React.JSX.Element {
  /*
   * Палітра віддає 0..1, а не 0..255 — і цей рядок уже одного разу
   * ділив на 255. На знімку риф вийшов чорним силуетом: колір падав до
   * тисячних, і від тіла лишався тільки контур у тумані. Тип поля
   * діапазону не називав, і саме тому помилка була невидима — тепер
   * називає.
   */
  const tint = useMemo(
    () => new Color(plan.tint.rgb[0], plan.tint.rgb[1], plan.tint.rgb[2]),
    [plan.tint],
  );
  const headColour = useMemo(() => {
    const stone = tint.clone();
    const grey = (stone.r + stone.g + stone.b) / 3;
    stone.setRGB(
      stone.r + (grey - stone.r) * HEAD_DRAIN,
      stone.g + (grey - stone.g) * HEAD_DRAIN,
      stone.b + (grey - stone.b) * HEAD_DRAIN,
    );
    return stone.multiplyScalar(HEAD_DARKEN[theme]);
  }, [theme, tint]);

  /*
   * КУПОЛ — ТЕЖ КАМІНЬ (ADR-0195, крок 4).
   *
   * Він і доти будувався тією самою функцією, що й виступ під ним
   * (`buildReefHeadMesh`), бо це той самий обростений вапняк. Тепер він і
   * носить те саме зерно — з карт, які сім тижнів лежали в репозиторії
   * нечитаними.
   *
   * `vertexColors` лишається: у буфері сірий множник навколо 1.0, тобто
   * рельєф купола, сказаний кольором (крок 3). Карта дає дрібну
   * нерівність, якої геометрія не несе, і одне одному не заважає —
   * градієнт по вершині працює на масштабі тіла, зерно на масштабі
   * сантиметрів.
   */
  const headMaterial = useMemo(() => {
    const material = new MeshStandardMaterial({
      color: headColour, vertexColors: true, roughness: 0.92, metalness: 0,
    });
    applyReefStoneSurface(material, { scale: 6, strength: 0.85 });
    return material;
  }, [headColour]);
  useEffect(() => () => headMaterial.dispose(), [headMaterial]);

  /*
   * Колір колонії за наповненістю її року. `useCallback` тут зайвий:
   * колоній одиниці, а `Color` усе одно створюється новий на кожен
   * рендер — важить те, щоб арифметика була ОДНА й лежала в палітрі.
   */
  const colonyColour = (fill: number): Color => {
    const bleached = reefColonyTint(plan.tint, fill);
    return new Color(bleached.rgb[0], bleached.rgb[1], bleached.rgb[2]);
  };

  return (
    <group position={[0, lift, 0]}>
      {/*
        * `vertexColors` тут — ТОН ГРАНІ, а не другий колір: у буфері
        * лежить сірий множник навколо 1.0, тож основний колір лишається
        * тим самим, а грані навколо нього розходяться (ADR-0190).
        */}
      <mesh geometry={meshes.head} castShadow receiveShadow>
        <primitive object={headMaterial} attach="material" />
      </mesh>
      {meshes.colonies.map((colony) => (
        <mesh key={colony.id} geometry={colony.geometry} castShadow receiveShadow>
          {/*
            * Наповненіший рік — насиченіший колір. Той самий відтінок
            * пари, але бідний рік читається ВИБІЛЕНИМ, як справжній корал
            * під стресом. Ще одна вісь, якою видно, що роки різні.
            *
            * Арифметика кольору живе в палітрі, а не тут, і це не
            * охайність. Доти цей рядок множив RGB на скаляр —
            * `multiplyScalar(0.55 + 0.45 * fill)`, — що лишає насиченість
            * недоторканою й знижує лише яскравість. Тобто бідний рік
            * ставав ТЕМНИМ, а не блідим, і зливався з головою, яка теж
            * темна: контраст 1.58 у темній темі й 1.06 у світлій. Числа
            * й спосіб вибілювання — у шапці `reefColonyTint`.
            */}
          <meshStandardMaterial
            color={colonyColour(colony.fill)}
            vertexColors
            roughness={0.78}
            metalness={0}
          />
        </mesh>
      ))}
    </group>
  );
}
