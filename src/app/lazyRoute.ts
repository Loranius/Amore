// ============================================================
// Ліниві розділи, які вміють бути вже готовими.
// ------------------------------------------------------------
// `React.lazy` призупиняє рендер ПЕРШОГО показу компонента навіть тоді,
// коли модуль уже в пам'яті: обіцянка резолвиться в мікрозадачі, і
// `Suspense` встигає намалювати запасний екран. Виміряно на живому
// порталі, на продакшн-збірці з УЖЕ прогрітими чанками: `.page-skeleton`
// висів по ~300 мс на кожному з трьох розділів.
//
// Тобто прогрів (`routePrefetch.ts`) знімав очікування мережі, але
// перший із трьох екранів переходу лишався на місці — а власник скаржився
// саме на низку екранів, що змінюють один одного.
//
// Тому тут не просто `lazy`, а `lazy` з пам'яттю: коли модуль уже
// приїхав, компонент рендериться синхронно й `Suspense` не спрацьовує
// взагалі. Коли ще не приїхав — усе як було, з тим самим скелетом.
// ============================================================
import { lazy, useState, createElement, type ComponentType } from 'react';

/**
 * Розділ, який можна прогріти наперед.
 *
 * `preload()` повертає ту саму обіцянку, що й ліниве завантаження, тож
 * повторний виклик нічого не завантажує вдруге — модульний кеш ES у
 * браузері вже тримає результат.
 */
export interface PreloadableRoute<P extends object = Record<string, never>> {
  (props: P): ReturnType<typeof createElement>;
  preload: () => Promise<unknown>;
}

export function lazyRoute<M, P extends object = Record<string, never>>(
  load: () => Promise<M>,
  pick: (module: M) => ComponentType<P>,
): PreloadableRoute<P> {
  // Готовий компонент, коли модуль уже приїхав. `null` до того.
  let ready: ComponentType<P> | null = null;

  const resolve = () => load().then((module) => {
    ready = pick(module);
    return { default: ready };
  });

  const Lazy = lazy(resolve);

  const Route = (props: P) => {
    /*
     * Вибір робиться ОДИН раз на монтування, і це не оптимізація.
     *
     * Якби вибір перечитувався щорендеру, прогрів, що завершився вже
     * після монтування розділу, підмінив би тип елемента з `Lazy` на
     * `ready` — а зміна типу для React означає РОЗМОНТУВАННЯ піддерева.
     * Розділ смикнувся б і втратив увесь свій стан рівно посеред
     * перегляду.
     */
    const [Resolved] = useState(() => ready);
    return Resolved
      ? createElement(Resolved, props)
      : createElement(Lazy, props);
  };

  Route.preload = resolve;
  return Route as PreloadableRoute<P>;
}
