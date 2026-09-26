// ============================================================
// ArtifactWorld — the world the couple navigates around.
// ------------------------------------------------------------
// Mounted by `Layout`, which is the parent route under `RequireAuth` and is
// therefore mounted once for the whole authenticated session. That is the whole
// point: the WebGL context, its warmed shaders and the published artifact all
// survive a route change, so walking from Home to the shopping list and back is
// movement inside one place rather than two page loads (ADR-0020).
//
// It sits *behind* the application's content and *outside* its scroll
// container. Both deliberate: the scene must not travel with a shopping list,
// and must not catch its scroll.
// ============================================================
import { lazy, Suspense, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { CrystalPlaceholder } from '../home/CrystalPlaceholder';
import { CrystalErrorBoundary } from '../home/crystal3d/CrystalErrorBoundary';
import { sceneFailureReason } from '../home/crystal3d/sceneFailure';
import { useWebglSupport } from '../home/crystal3d/useWebglSupport';
import { HomeArtifactWebglFallback } from '../home/HomeArtifactPreviewFallback';
import { PortalBackdrop } from '../home/PortalBackdrop';
import {
  HOME_ARTIFACT_QUERY_KEY,
  resolveHomeArtifact,
  withHomeArtifactSearch,
  type HomeArtifact,
} from '../home/homeArtifact';
import {
  ArtifactWorldContext,
  useArtifactWorld,
  type ArtifactWorldValue,
} from './artifactWorldContext';
import {
  WorldGrowthContext,
  WorldGrowthReportContext,
  type GrowthReporter,
  type WorldGrowth,
} from './growthChannel';
import {
  cachedArtifact,
  useSaveSharedArtifact,
  useSharedArtifact,
} from './sharedArtifact';
import './artifactWorld.css';

const CrystalScene = lazy(() => import('../home/crystal3d/CrystalSceneEntry'));
const ReefScene = lazy(() => import('../home/reef3d/world/ReefWorldScene'));

/*
 * ТУТ ЖИЛИ `storedArtifact` І `persistArtifact` — читання й запис у
 * `localStorage`. Вибір виду переїхав у `settings` і став спільним для
 * пари (ADR-0209 §17, рішення власника), тож обидві функції переїхали в
 * `sharedArtifact.ts` разом із ним. Місцеве сховище не зникло — воно
 * стало КЕШЕМ першого кадру, і саме тому лишилось під тим самим ключем:
 * пара, яка вже обрала вид, не побачить стрибка з кристала.
 */

export function ArtifactWorldProvider({ children }: { children: ReactNode }) {
  const { supported: webglSupported, retry: retryWebgl } = useWebglSupport();
  const [artifact, setArtifact] = useState<HomeArtifact>(() => resolveHomeArtifact(
    typeof window === 'undefined' ? '' : window.location.search,
    cachedArtifact(),
  ));

  const shared = useSharedArtifact();
  const saveShared = useSaveSharedArtifact();

  /*
   * Спільний вибір переймається, КОЛИ приїхав, — і лише якщо адреса не
   * називає вид явно.
   *
   * Виняток із адресою не з обережності: `?artifact=` і `?engine=` — це
   * ручки лабораторії (`resolveHomeArtifact`), і знімок, зроблений із
   * ними, мусить показувати те, що просили, а не те, що обрала пара.
   * Без цієї умови будь-який прогін лабораторії тихо повертався б до
   * спільного виду — рівно та пастка, за яку `scripts/live/README.md`
   * тримає пункт №9.
   */
  useEffect(() => {
    const value = shared.data;
    if (value === undefined || value === null) return;
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get(HOME_ARTIFACT_QUERY_KEY) !== null || params.get('engine') !== null) return;
    }
    setArtifact((current) => (current === value ? current : value));
  }, [shared.data]);

  const selectArtifact = useCallback((next: HomeArtifact) => {
    /*
     * Запис іде «у фоні», а сцена перемикається одразу: кеш і стан
     * оновлюються синхронно всередині `saveShared`, тож дотик не чекає
     * на мережу. Помилка запису не ковтається — вона потрапляє в консоль
     * із причиною, а вибір лишається чинним на цьому пристрої.
     */
    void saveShared(next);
    if (typeof window !== 'undefined') {
      const search = withHomeArtifactSearch(window.location.search, next);
      window.history.replaceState(
        window.history.state,
        '',
        `${window.location.pathname}${search}${window.location.hash}`,
      );
    }
    setArtifact(next);
  }, []);

  /*
   * Обраний артефакт оголошується на КОРЕНІ, поруч із `data-theme`.
   *
   * Не заради симетрії. Чорнило тексту на сцені (`--scene-ink*`) досі
   *вибиралось лише за темою, і для кристала це працювало: його небо
   * теж іде за темою. Небо дерева — НІ. Воно денне завжди, і в темній
   * темі майже біле чорнило лягало на світле небо.
   *
   * Виміряно на живому екрані (412×915@2, тема dark, світ «Дерево»):
   *   `.home-title`      15.16 → **1.52**   (треба 4.5)
   *   лічильник днів      9.54 → **1.35**   (треба 3.0)
   *   підпис під ним     11.11 → **1.59**   (треба 4.5)
   *   привітання         17.36 → **3.41**   (треба 4.5)
   * Тобто заголовок і число ставали фактично невидимими. У СВІТЛІЙ темі
   * ті самі елементи читаються бездоганно — темне чорнило випадково
   * збігалося з денним небом дерева.
   *
   * Атрибут стоїть на `<html>`, бо текст шапки (`.home-*`) лежить у
   * `.home`, а не всередині `.artifact-world`: вони СУСІДИ, тож
   * `data-artifact-world` на самому світі до них не дістає.
   */
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-artifact', artifact);
    return () => root.removeAttribute('data-artifact');
  }, [artifact]);

  const value = useMemo<ArtifactWorldValue>(
    () => ({ artifact, selectArtifact, webglSupported, retryWebgl }),
    [artifact, selectArtifact, webglSupported, retryWebgl],
  );

  /*
   * Приріст живе ТУТ, а не в `ArtifactWorldValue`, і канал розділено на
   * значення й передавач — див. `growthChannel.ts`. Коротко: сцена
   * підписана лише на передавач, тож поява підпису не перемальовує
   * полотно.
   *
   * Скидається при зміні артефакта: конвеєр дерева ще не звітує, і
   * підпис від кристала, що лишився б висіти над деревом, був би
   * рядком про об'єкт, якого на екрані немає.
   */
  const [growth, setGrowth] = useState<WorldGrowth | null>(null);
  const reportGrowth = useCallback<GrowthReporter>((next) => setGrowth(next), []);
  useEffect(() => {
    setGrowth(null);
  }, [artifact]);

  return (
    <ArtifactWorldContext.Provider value={value}>
      <WorldGrowthReportContext.Provider value={reportGrowth}>
        <WorldGrowthContext.Provider value={growth}>
          {children}
        </WorldGrowthContext.Provider>
      </WorldGrowthReportContext.Provider>
    </ArtifactWorldContext.Provider>
  );
}

/**
 * The scene layer.
 *
 * Split from the provider because the context has to wrap the whole shell —
 * the bottom navigation and the "More" sheet belong to the world even though
 * they are drawn over it — while the canvas stays exactly one element in
 * exactly one place.
 *
 * `aria-hidden`, and that is not an oversight. The world carries no
 * information a screen reader can use, and the brief requires the application
 * to remain fully usable without any understanding of the 3D at all (§48).
 * Everything a couple needs to read lives in the foreground.
 */
export function ArtifactWorld() {
  const { artifact, webglSupported, retryWebgl } = useArtifactWorld();

  // Never substitute another artifact's silhouette for the selected one. If
  // WebGL is unavailable or the renderer throws, the world keeps its sky and
  // shows a neutral explanation rather than a stand-in object.
  //
  // Кнопка «спробувати ще раз» лише там, де пробувати є що. Для відсутнього
  // WebGL це повторна проба контексту; для сцени, яка впала після
  // монтування, повторна проба сказала б «контекст є» і нічого не
  // полагодила — там єдине, що допомагає, це перезавантажити сторінку, і
  // саме це заглушка й пропонує, коли причина в ненавантаженому файлі.
  const webglFallback = (
    <HomeArtifactWebglFallback artifact={artifact} onRetry={retryWebgl} />
  );

  return (
    <div className="artifact-world" data-artifact-world={artifact} aria-hidden="true">
      <PortalBackdrop />
      <div className="artifact-world__scene">
        {webglSupported ? (
          <CrystalErrorBoundary
            key={artifact}
            fallback={(error) => (
              <HomeArtifactWebglFallback
                artifact={artifact}
                reason={sceneFailureReason(error)}
              />
            )}
          >
            <Suspense fallback={<CrystalPlaceholder />}>
              {artifact === 'reef'
                ? <ReefScene />
                : <CrystalScene key={artifact} artifact={artifact} />}
            </Suspense>
          </CrystalErrorBoundary>
        ) : webglFallback}
      </div>
    </div>
  );
}
