// ============================================================
// useWebglSupport — чи дасть браузер 3D-контекст, і чи дасть ЩЕ РАЗ
// ------------------------------------------------------------
// Привід переписати: власник відкрив портал на своєму телефоні й
// побачив «WebGL недоступний / 3D-кристал не вдалося відкрити». На
// знімку поруч видно дві обставини, які пояснюють усе: **53 вкладки** й
// **12% заряду**. Chrome на Android тримає жорстку стелю живих
// WebGL-контекстів і відмовляє новим, коли їх забагато; режим економії
// енергії відмовляє й поготів.
//
// Але сам код робив цю відмову набагато ймовірнішою і незворотною —
// двома способами.
//
// **Перший: проба з'їдала контекст і не віддавала.** Детект створював
// `webgl2`-контекст, питав «вийшло?» і кидав полотно збирачеві сміття.
// Контекст при цьому лишався живим до GC, тобто займав один зі скупих
// слотів браузера. На пристрої, який уже стоїть на стелі, проба
// **сама** могла стати тією краплею, через яку справжній сцені слота
// вже не лишалось. Тепер контекст звільняється явно через
// `WEBGL_lose_context` одразу після відповіді.
//
// **Другий: відповідь латалась назавжди.** `useState(detectWebgl)`
// рахує один раз за монтування. Пара, у якої проба не вдалась через
// тимчасову обставину — зайняті вкладки, економія енергії, зайнятий
// GPU-процес, — бачила заглушку до перезавантаження сторінки, навіть
// коли обставина вже минула. Тепер портал пробує знову, коли вкладка
// повертається на очі, і коли пара просить руками.
// ============================================================
import { useCallback, useEffect, useState } from 'react';

/**
 * Одна проба — і слот одразу повертається браузеру.
 *
 * `WEBGL_lose_context` є не скрізь; коли розширення немає, лишається
 * покластись на GC, і це не гірше, ніж було. Але там, де воно є (а це
 * весь Chromium і Safari), слот звільняється в ту саму мить.
 */
function detectWebgl(): boolean {
  if (typeof document === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
    if (!gl) return false;
    const lose = gl.getExtension('WEBGL_lose_context') as { loseContext?: () => void } | null;
    lose?.loseContext?.();
    return true;
  } catch {
    return false;
  }
}

export interface WebglSupport {
  supported: boolean;
  /** Спробувати ще раз — коли пара закрила вкладки або вимкнула економію. */
  retry: () => void;
}

export function useWebglSupport(): WebglSupport {
  const [supported, setSupported] = useState(detectWebgl);

  const retry = useCallback(() => {
    setSupported((current) => (current ? current : detectWebgl()));
  }, []);

  useEffect(() => {
    // Поки контекст є, перепитувати нема про що: повторна проба тут
    // коштувала б ще одного слота на кожне повернення на вкладку.
    if (supported) return;

    const recheck = () => {
      if (document.visibilityState === 'visible') retry();
    };
    document.addEventListener('visibilitychange', recheck);
    window.addEventListener('focus', recheck);
    return () => {
      document.removeEventListener('visibilitychange', recheck);
      window.removeEventListener('focus', recheck);
    };
  }, [supported, retry]);

  return { supported, retry };
}
