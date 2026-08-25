import type { HomeArtifact } from './homeArtifact';
import type { SceneFailureReason } from './crystal3d/sceneFailure';
import './homeArtifactSwitcher.css';

/**
 * Що бачить пара, коли артефакт не піднявся.
 *
 * Тут стояло одне пояснення на всі випадки — «На цьому пристрої браузер
 * не надав 3D-контекст для актуального renderer», — і воно було
 * неправдою двічі: «на цьому пристрої» звучить як вирок пристрою, а
 * речення нічого не пропонує зробити.
 *
 * Перше виправлення переписало текст, але лишило одну причину на всі
 * падіння. Другий знімок із того самого телефона показав, чого це
 * коштує: на екрані «WebGL недоступний», а в консолі — **404 на моделі
 * руїни**. WebGL працював. Пара читала про причину, якої не було, і не
 * мала жодного способу здогадатись, що допомогло б оновлення сторінки.
 *
 * Тому причин тепер три, і кожна каже те, що з нею робити:
 *
 * - `webgl`  — браузер не дав полотно (вкладки, економія заряду);
 * - `asset`  — файл сцени не доїхав (зв'язок), допомагає оновлення;
 * - `scene`  — усе інше; тут чесніше не вигадувати причину зовсім.
 */
export function HomeArtifactWebglFallback({
  artifact,
  reason = 'webgl',
  onRetry,
}: {
  artifact: HomeArtifact;
  reason?: SceneFailureReason | 'webgl';
  onRetry?: () => void;
}) {
  const name = artifact === 'tree' ? 'Дерево' : artifact === 'reef' ? 'Риф' : 'Кристал';

  const copy = reason === 'asset'
    ? {
      kicker: 'Сцена не доїхала',
      body: 'Файл сцени не завантажився — найчастіше через нестійкий зв’язок.'
        + ' Допомагає оновити сторінку.',
      action: 'Оновити сторінку',
    }
    : reason === 'scene'
      ? {
        kicker: 'Сцена не піднялась',
        body: 'Щось завадило зібрати тривимірну сцену. Спробуйте оновити'
          + ' сторінку — решта порталу працює як завжди.',
        action: 'Оновити сторінку',
      }
      : {
        kicker: 'Немає місця для 3D',
        body: 'Браузер не дав полотно для тривимірної сцени. Найчастіше через'
          + ' відкриті вкладки або режим економії заряду — тоді допомагає'
          + ' закрити зайві вкладки чи вимкнути економію.',
        action: 'Спробувати ще раз',
      };

  // Для WebGL є що перепробувати всередині сторінки; для сцени, яка вже
  // впала, єдине, що справді допомагає, — перезавантаження.
  const act = reason === 'webgl' ? onRetry : () => window.location.reload();

  return (
    <div
      className="home-artifact-preview-fallback"
      data-home-artifact-preview={artifact}
      data-home-artifact-webgl={reason === 'webgl' ? 'unavailable' : reason}
    >
      <div className="home-artifact-preview-message">
        <span className="home-artifact-preview-kicker">{copy.kicker}</span>
        <h2>{`${name} не вдалося відкрити`}</h2>
        <p>{copy.body}</p>
        {act && (
          <button type="button" className="btn" onClick={act}>
            {copy.action}
          </button>
        )}
      </div>
    </div>
  );
}
