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
import { useMemo } from 'react';
import { Color } from 'three';
import type { ReefPlan } from '@/engine/species/reef/reefAssembly';
import type { ReefTheme } from '@/engine/species/reef/coralPalette';
import type { ReefMeshes } from './useReefMeshes';

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

  return (
    <group position={[0, lift, 0]}>
      <mesh geometry={meshes.head} castShadow receiveShadow>
        <meshStandardMaterial color={headColour} roughness={0.92} metalness={0} flatShading />
      </mesh>
      {meshes.colonies.map((colony) => (
        <mesh key={colony.id} geometry={colony.geometry} castShadow receiveShadow>
          {/*
            * Наповненіший рік — насиченіший колір. Той самий відтінок
            * пари, але бідний рік читається вибіленим, як справжній
            * корал під стресом. Ще одна вісь, якою видно, що роки різні.
            */}
          <meshStandardMaterial
            color={tint.clone().multiplyScalar(0.55 + 0.45 * colony.fill)}
            roughness={0.78}
            metalness={0}
            flatShading
          />
        </mesh>
      ))}
    </group>
  );
}
