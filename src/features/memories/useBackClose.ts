// ============================================================
// Системне «назад» закриває шар поверх сторінки, а не саму сторінку.
// ------------------------------------------------------------
// На телефоні «назад» — жест, а не кнопка в кутку. Композер і повний
// екран фото — шари поверх маршруту, і без цього хука жест проходив КРІЗЬ
// них: пара, що роздивлялась фото, вилітала зі спогаду зовсім, а
// недописаний спогад зникав без питання (критика 2026-10-12).
//
// Механіка: поки шар відкритий, у історії є зайвий запис із нашою
// міткою. «Назад» знімає саме його — тоді ми повертаємо запис і просимо
// шар закритись тим самим шляхом, що й хрестик (`requestClose`), тож
// питання «викинути чернетку?» спрацьовує й тут. Шар закрився сам —
// прибираємо свій запис.
//
// Запис кладеться в наступній макрозадачі, а не одразу: `StrictMode`
// у розробці монтує ефект двічі, і синхронний запис лишав би в історії
// осиротілий другий.
// ============================================================
import { useEffect, useRef } from 'react';

const MARK = '__amoreLayer';

export function useBackClose(requestClose: () => void): void {
  const requestRef = useRef(requestClose);
  requestRef.current = requestClose;

  useEffect(() => {
    const token = `${Date.now()}-${performance.now()}`;
    let armed = false;
    const arm = () => {
      window.history.pushState({ ...(window.history.state ?? {}), [MARK]: token }, '');
      armed = true;
    };
    const timer = window.setTimeout(arm, 0);

    const onPop = (event: PopStateEvent) => {
      if (!armed) return;
      const state = event.state as Record<string, unknown> | null;
      if (state?.[MARK] === token) return;
      // Наш запис знято жестом: повертаємо його, а рішення — за шаром.
      arm();
      requestRef.current();
    };
    window.addEventListener('popstate', onPop);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('popstate', onPop);
      const state = window.history.state as Record<string, unknown> | null;
      if (armed && state?.[MARK] === token) window.history.back();
    };
  }, []);
}
