// ============================================================
// Лабораторія рифа — той самий вхід, що в кристала й дерева.
// ------------------------------------------------------------
// ЧОМУ ВОНА З'ЯВИЛАСЬ ТІЛЬКИ ЗАРАЗ, І ЧОМУ ЦЕ БУЛО ДОРОГО. ADR-0182 дав
// рифові лінійку й знайшов нею дві межі: покриття купола мізерне в перші
// роки, а з ШОСТОГО року шапки колоній перетинаються. Обидва числа —
// правда, і обидва ніхто не міг ПОБАЧИТИ: єдиний спосіб подивитись на
// риф був через живий портал, тобто на віці цієї пари й тільки на ньому.
// Рішення про те, чим жертвувати на двадцятому році, довелось приймати
// за таблицею.
//
// Тут немає ані Supabase, ані входу. Пара синтетична, вік і наповненість
// задаються рядком запиту, а сцена та сама — `ReefWorld` той самий, що
// малює портал, тож лабораторія показує ТОЙ САМИЙ риф, а не схожий.
//
//   /reef-lab.html?years=10
//   /reef-lab.html?years=25&fill=повна
//   /reef-lab.html?years=1&theme=light
//   /reef-lab.html?modules=2
//
// `modules` з'явився разом із прив'язкою кольору дрібноти до прожитих
// частин порталу. Без нього лабораторія завжди живе ВСІМА шістьма —
// історія тут синтетична й рівна, — тобто показує єдиний із семи
// можливих рифів, і саме той, на якому прив'язку не видно. Це пастка №8
// зі `scripts/live/README.md` у чистому вигляді: кадр, який не може з
// тобою не погодитись.
//
// Сторінка не входить у збірку продукту: лише dev-сервер.
// ============================================================
import { useCallback, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Vector3 } from 'three';
import { REEF_CAMERA_FOV_DEG } from '@/engine/species/reef/reefStaging';
import {
  buildReefPlan,
  type ReefHistoryEvent,
  type ReefPlan,
} from '@/engine/species/reef/reefAssembly';
import { reefSilhouetteProfile } from '@/engine/species/reef/reefProfile';
import { reefStanding } from '@/engine/species/reef/reefStaging';
import { PORTAL_MODULES } from '@/engine/species/shared/relationshipYear';
import { reefLifePalette } from '@/engine/species/reef/undergrowth';
import type { ReefTheme } from '@/engine/species/reef/coralPalette';
import { ReefWorld } from '@/features/home/reef3d/world/ReefWorld';
import { useReefMeshes } from '@/features/home/reef3d/world/useReefMeshes';
import '@/index.css';

/**
 * Дата початку СТАЛА, а рухається «сьогодні».
 *
 * Інакше кожен вік був би іншою парою з іншим насінням — саме на цьому
 * вже вийшов хибний вимір пропорції кристала (ADR-0089 §1), і повторювати
 * його в рифі немає за що.
 */
const STARTED_AT = '1990-01-01';

/**
 * Скільки подій на рік у кожному модулі порталу.
 *
 * Наповненість веде і розмір колонії, і — від ADR-0183 — її колір: бідний
 * рік вибілюється. Тобто одного профілю тут мало: «порожня» і «повна»
 * пари дають не просто різні розміри, а різні КАДРИ, і дивитись треба на
 * обидва.
 */
const FILL_PROFILES = {
  порожня: 0,
  рідка: 1,
  середня: 4,
  повна: 12,
} as const;

type FillProfile = keyof typeof FILL_PROFILES;

const THEMES: readonly ReefTheme[] = ['dark', 'light'];

/**
 * Історія синтетичної пари: рівні події в перших `moduleCount` модулях,
 * кожен рік.
 *
 * Модулі беруться з початку `PORTAL_MODULES`, а не випадкові: ручка має
 * давати ТОЙ САМИЙ риф на тому самому числі, інакше два знімки поспіль
 * порівнювати нема з чим.
 */
function historyFor(
  years: number, perModulePerYear: number, moduleCount: number,
): ReefHistoryEvent[] {
  const events: ReefHistoryEvent[] = [];
  if (perModulePerYear <= 0 || moduleCount <= 0) return events;
  const startYear = Number(STARTED_AT.slice(0, 4));
  for (let year = 0; year < years; year += 1) {
    for (let module = 0; module < moduleCount; module += 1) {
      for (let index = 0; index < perModulePerYear; index += 1) {
        /*
         * Дні розкидані по місяцях, а не складені в один: `yearFill`
         * дивиться й на те, скільки РІЗНИХ модулів жило, і на обсяг, тож
         * купа подій в один день дала б не ту наповненість, яку видно з
         * числа подій.
         */
        const month = String(1 + ((module * 3 + index) % 12)).padStart(2, '0');
        const day = String(2 + ((index * 7) % 26)).padStart(2, '0');
        /*
         * `+ year`, а НЕ `+ year + 1`.
         *
         * Другий зсув на одиницю в цьому ж файлі, і знайшов його не тест,
         * а кадр: на `--years=1 --fill=рідка` лабораторія показала широту
         * НУЛЬ. Події лягали в 1991-й, тоді як перший рік стосунків — це
         * 1990-й, тож усі вони опинялись у майбутньому щодо `asOf`, і
         * ручка `fill` на першому році не робила нічого.
         *
         * Це рівно пастка №9 зі `scripts/live/README.md`: «три однакові
         * числа — не доказ, що ручка не працює; спершу перевір, що ручку
         * взагалі повернули». Тут ручку не повертали.
         */
        events.push({
          occurredAt: `${startYear + year}-${month}-${day}`,
          module: PORTAL_MODULES[module]!,
        });
      }
    }
  }
  return events;
}

function planFor(
  years: number, fill: FillProfile, theme: ReefTheme, moduleCount: number,
): ReefPlan {
  return buildReefPlan({
    relationshipStartedAt: STARTED_AT,
    /*
     * `years=N` мусить дати РІВНО N колоній, і це виправлення зсуву на
     * одиницю, знайденого першим же прогоном: `+ years` давало на
     * четвертому році п'ять колоній, бо рік початку теж рахується.
     *
     * Зсув такого роду отруює не один знімок, а кожен наступний вимір:
     * таблиця, підписана «рік 4», описувала б п'ятирічну пару, і жодне
     * число в ній не було б хибним само по собі.
     *
     * Листопад, а не грудень: останній рік має лишатись ПОТОЧНИМ —
     * саме він показує, як виглядає незавершене.
     */
    asOf: `${Number(STARTED_AT.slice(0, 4)) + years - 1}-11-20`,
    leapDayPolicy: 'feb-28',
    seed: 4242,
    events: historyFor(years, FILL_PROFILES[fill], moduleCount),
    sharedDaysOff: [],
    theme,
  });
}

function ReefLab(): React.JSX.Element | null {
  const params = new URLSearchParams(window.location.search);

  const years = Math.max(1, Math.min(40, Number(params.get('years') ?? '4') || 4));
  const fillParam = params.get('fill') ?? '';
  const fill: FillProfile = (Object.keys(FILL_PROFILES) as FillProfile[])
    .includes(fillParam as FillProfile) ? (fillParam as FillProfile) : 'середня';
  /*
   * Скільки РІЗНИХ частин порталу пара веде, 0..6. Нуль — законне
   * значення й окремий кадр: `PRODUCT.md` §8 обіцяє живий риф і парі,
   * яка ще нічого не додала.
   */
  const moduleCount = Math.max(0, Math.min(
    PORTAL_MODULES.length,
    Number(params.get('modules') ?? String(PORTAL_MODULES.length)) || 0,
  ));
  const themeParam = params.get('theme') ?? '';
  const theme: ReefTheme = THEMES.includes(themeParam as ReefTheme)
    ? (themeParam as ReefTheme)
    : 'dark';

  const [error, setError] = useState<string | null>(null);
  const plan = useMemo(() => {
    try {
      return planFor(years, fill, theme, moduleCount);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
      return null;
    }
  }, [years, fill, theme, moduleCount]);

  if (error !== null) return <pre style={{ color: '#f88', padding: 16 }}>{error}</pre>;
  if (plan === null) return null;
  return <ReefLabScene plan={plan} theme={theme} />;
}

/*
 * `data-reef-modules` і `data-reef-life-hues` стоять поруч із
 * `data-reef-breadth`, бо це РІЗНІ числа, які дуже легко сплутати на
 * знімку: широта веде розмір купола, а палітра — колір дрібноти.
 */

/**
 * Рамка купола НА ЕКРАНІ, у частках кадру.
 *
 * ЧОМУ ЦЕ ТУТ, А НЕ В МІРЦІ ПО ПІКСЕЛЯХ. Будь-яке вимірювання кольору
 * впирається в те саме питання: які пікселі належать артефакту, а які —
 * воді, піску й туману. Кристал відповідав на нього двічі й обидва рази
 * помилився — спершу контрольним кадром (камера вписує коробку ВСІХ
 * мешів, тож без артефакта вона під'їжджає, і «тілом» стала половина
 * острова), потім вікном відтінку (воно ламається, щойно тіло змінює
 * колір). Обидві історії записані в ADR-0174.
 *
 * Тут маска БЕРЕТЬСЯ З ПРАВДИ: вісім кутів коробки купола проєктуються
 * тією самою камерою, якою малюється кадр. Здогадуватись більше нема про
 * що — ні про колір, ні про те, куди поїхала камера.
 *
 * Рахується щокадру, бо камера ще їде зі згасанням, і знімок роблять
 * через дев'ять секунд після готовності. Вісім точок на кадр — ціна, про
 * яку нема що казати.
 */
function ReefScreenBox({
  radius,
  rise,
  lift,
  onBox,
}: {
  radius: number;
  rise: number;
  lift: number;
  onBox: (box: readonly [number, number, number, number]) => void;
}): null {
  const camera = useThree((state) => state.camera);
  useFrame(() => {
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (let corner = 0; corner < 8; corner += 1) {
      const point = new Vector3(
        (corner & 1 ? 1 : -1) * radius,
        lift + (corner & 2 ? rise : 0),
        (corner & 4 ? 1 : -1) * radius,
      ).project(camera);
      // NDC (−1..1, вгору) → частка кадру (0..1, униз).
      const x = (point.x + 1) / 2;
      const y = (1 - point.y) / 2;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
    onBox([minX, minY, maxX, maxY]);
  });
  return null;
}

/**
 * Готовий риф — окремим компонентом, як і в порталі.
 *
 * `useReefMeshes` не можна кликати після раннього повернення: гак,
 * викликаний не на кожному рендері, — це рівно та помилка, яку правило
 * гаків і забороняє.
 */
function ReefLabScene({ plan, theme }: { plan: ReefPlan; theme: ReefTheme }): React.JSX.Element {
  const meshes = useReefMeshes(plan);
  const profile = useMemo(() => reefSilhouetteProfile(plan), [plan]);
  const standing = useMemo(() => reefStanding(plan.head), [plan.head]);
  const [box, setBox] = useState<readonly [number, number, number, number] | null>(null);
  const onBox = useCallback((next: readonly [number, number, number, number]) => {
    setBox((current) => {
      // Оновлюємо лише тоді, коли камера справді зрушила: інакше кожен
      // кадр давав би новий стан і перемальовував би обгортку вічно.
      if (current && current.every((value, index) => Math.abs(value - next[index]!) < 1e-4)) {
        return current;
      }
      return next;
    });
  }, []);

  /*
   * Числа лінійки їдуть в АТРИБУТИ, а не на екран.
   *
   * Серед них `data-reef-screen-box` — рамка купола в частках кадру
   * (`x0,y0,x1,y1`, початок у лівому верхньому куті). Саме вона й дає
   * мірці по пікселях точну маску: без здогадів про колір і без
   * контрольного кадру, на яких кристал обпікся двічі (ADR-0174).
   *
   * Напис поверх сцени потрапив би в кожен знімок і в кожен вимір
   * яскравості — саме тому `tree-lab.html` і пише «жодного інтерфейсу».
   * Атрибути читає живий стенд (`--probe`), а око бачить чистий кадр.
   */
  return (
    <div
      className="crystal-wrap evolution-preview-wrap"
      data-home-artifact-preview="reef"
      data-reef-preview="ready"
      data-evolution-preview="ready"
      data-evolution-renderer="three"
      data-evolution-quality="high"
      data-evolution-bodies={meshes.bodyCount}
      data-evolution-meshes={meshes.meshCount}
      data-evolution-vertices={meshes.vertices}
      data-evolution-triangles={meshes.triangles}
      data-reef-years={plan.colonies.length}
      data-reef-breadth={plan.breadth}
      data-reef-modules={plan.livedModules.join(',')}
      data-reef-life-hues={reefLifePalette(plan.livedModules).length}
      data-reef-days-together={plan.daysTogether}
      data-reef-coverage={profile.coverage.toFixed(4)}
      data-reef-coral-share={profile.coralSilhouetteShare.toFixed(4)}
      data-reef-coral-coverage={profile.coralCoverage.toFixed(4)}
      data-reef-body-aspect={profile.bodyAspect.toFixed(4)}
      data-reef-dome-aspect={profile.domeAspect.toFixed(4)}
      data-reef-size-spread={profile.sizeSpread.toFixed(4)}
      data-reef-screen-box={box ? box.map((value) => value.toFixed(4)).join(',') : ''}
    >
      <Canvas
        camera={{ position: [0, 1.2, 4.2], fov: REEF_CAMERA_FOV_DEG }}
        gl={{ alpha: false, antialias: true }}
      >
        {/*
          * `reduceMotion` вимкнено: лабораторія існує, щоб дивитись на
          * форму, а завмерла сцена порівнюється між прогонами, тоді як
          * жива — ні.
          */}
        <ReefWorld plan={plan} meshes={meshes} theme={theme} reduceMotion />
        <ReefScreenBox
          radius={plan.head.radius}
          rise={plan.head.rise}
          lift={standing.headLift}
          onBox={onBox}
        />
      </Canvas>
    </div>
  );
}

const host = document.getElementById('root');
if (host) {
  const params = new URLSearchParams(window.location.search);
  document.documentElement.dataset['artifact'] = 'reef';
  document.documentElement.dataset['theme'] = params.get('theme') === 'light' ? 'light' : 'dark';
  createRoot(host).render(<ReefLab />);
}
