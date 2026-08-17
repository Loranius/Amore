import { useEffect, useSyncExternalStore } from 'react';

// ============================================================
// Режим занурення — маршрут забирає екран собі цілком.
// ------------------------------------------------------------
// Причина та сама, що в сусіднього `useWorldVisibleRoute`: хром живе поза
// сторінкою. Нижній док і бічна панель — сусіди `<Outlet/>`, тож із середини
// сторінки до них не дотягнутись ані токеном, ані класом. Кореневий атрибут —
// найменше, що дозволяє хрому піти з дороги, не відрощуючи кожній сторінці
// проп «сховай навігацію».
//
// **Це перший маршрут застосунку, який так робить.** Досі док ховали лише за
// станом — `:has()` на відкритій модалці у вішліста або клас на `body`. Обидва
// прийоми прив'язані до того, що щось відкрито, а не до того, куди перейшли, і
// для маршруту не годяться: сторінка не «відкрита поверх», вона і є екран.
//
// Атрибут навмисно не займається світом: маршрут, який хоче ще й показати
// кристал, додає `useWorldVisibleRoute` окремо.
//
// Тут же живе підписка на цей стан — заради єдиного споживача, який мусить
// знати про занурення зсередини сцени: полотно світу. Воно лишається живим
// (ADR-0020: світ переживає сторінку, шейдери прогріті, артефакт на місці),
// але кадрів йому не малюють, поки видно чужу сцену. Без цього телефон малює
// дві сцени, з яких одна невидима.
// ============================================================

let immersive = false;
const listeners = new Set<() => void>();

function setImmersive(next: boolean): void {
  if (immersive === next) return;
  immersive = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useImmersiveRoute(): void {
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-immersive', 'true');
    setImmersive(true);
    return () => {
      root.removeAttribute('data-immersive');
      setImmersive(false);
    };
  }, []);
}

/**
 * Чи малювати кадри полотну світу.
 *
 * `'never'` не звільняє контекст і не викидає сцену — воно лише зупиняє цикл.
 * Повернення на звичайний маршрут вмикає кадри назад тим самим станом, і
 * жодного перезбирання не відбувається.
 */
export function useWorldFrameloop(): 'always' | 'never' {
  const paused = useSyncExternalStore(subscribe, () => immersive, () => false);
  return paused ? 'never' : 'always';
}
