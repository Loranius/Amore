import type { HomeArtifact } from './homeArtifact';
import './homeArtifactSwitcher.css';

/**
 * Що бачить пара, коли браузер не дав 3D-контекст.
 *
 * Тут стояло «На цьому пристрої браузер не надав 3D-контекст для
 * актуального renderer» — і це неправда двічі. По-перше, «на цьому
 * пристрої» звучить як вирок пристрою, хоча найчастіша причина
 * тимчасова. По-друге, речення нічого не пропонує зробити.
 *
 * Власник упіймав саме такий екран на своєму телефоні. На знімку поруч
 * видно причину: **53 вкладки** й **12% заряду**. Chrome на Android
 * тримає стелю живих WebGL-контекстів і відмовляє новим, коли вкладок
 * забагато; режим економії енергії вимикає прискорення й поготів.
 *
 * Тобто кристал нікуди не подівся — його просто нема куди намалювати.
 * Пара має це почути такими словами, і мати кнопку.
 */
export function HomeArtifactWebglFallback({
  artifact,
  onRetry,
}: {
  artifact: HomeArtifact;
  onRetry?: () => void;
}) {
  const title = artifact === 'tree'
    ? 'Дерево не вдалося відкрити'
    : artifact === 'reef'
      ? 'Риф не вдалося відкрити'
      : 'Кристал не вдалося відкрити';

  return (
    <div
      className="home-artifact-preview-fallback"
      data-home-artifact-preview={artifact}
      data-home-artifact-webgl="unavailable"
    >
      <div className="home-artifact-preview-message">
        <span className="home-artifact-preview-kicker">Немає місця для 3D</span>
        <h2>{title}</h2>
        <p>
          Браузер не дав полотно для тривимірної сцени. Найчастіше через
          відкриті вкладки або режим економії заряду — тоді допомагає
          закрити зайві вкладки чи вимкнути економію.
        </p>
        {onRetry && (
          <button type="button" className="btn" onClick={onRetry}>
            Спробувати ще раз
          </button>
        )}
      </div>
    </div>
  );
}
