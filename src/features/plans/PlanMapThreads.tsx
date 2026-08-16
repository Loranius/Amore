// ============================================================
// Світні нитки між блоками карти плану.
// ------------------------------------------------------------
// Нитки малюються ПІСЛЯ розкладки, по справжніх прямокутниках блоків. Крива,
// порахована наперед, розійшлася б із текстом: назва плану переноситься на
// другий рядок, блок росте — і нитка лишається висіти в порожнечі.
//
// SVG лежить ПІД блоками (`z-index` у `plansMap.css`). Там, де крива входить
// у блок, вона зникає, і виходить те саме, що на референсі: нитка тримає
// блок, а не перекреслює його.
// ============================================================
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { threadBetween, type MapRect, type MapThread } from './planMapLayout';

/** Пара блоків за їхніми `data-map-block`. */
export type ThreadPair = readonly [string, string];

const toRect = (element: Element): MapRect => {
  const box = element.getBoundingClientRect();
  return { left: box.left, top: box.top, width: box.width, height: box.height };
};

/**
 * Полотно карти приходить елементом, а не ref-ом, і це не стиль.
 *
 * React чіпляє ref до вузла ПІСЛЯ того, як відпрацювали layout-ефекти його
 * дітей. Перша версія брала `RefObject`, і на першому вимірі він був `null`:
 * нитки не малювались зовсім, аж доки якийсь запит не приходив і не змушував
 * ефект перезапуститись. Виміряно на живому порталі — блоки стояли без ниток
 * приблизно дві секунди. Елемент, переданий через стан батька, такого вікна
 * не має.
 */
export function PlanMapThreads({ map, pairs, watch }: {
  map: HTMLElement;
  pairs: readonly ThreadPair[];
  /** Будь-що, що змінює розкладку: інший план, інша кількість пунктів. */
  watch?: unknown;
}) {
  const [threads, setThreads] = useState<MapThread[]>([]);
  const [frame, setFrame] = useState({ width: 0, height: 0 });
  const rafRef = useRef(0);

  const measure = useCallback(() => {
    const box = toRect(map);
    if (box.width < 1) return;

    const next: MapThread[] = [];
    for (const [fromKey, toKey] of pairs) {
      const from = map.querySelector(`[data-map-block="${fromKey}"]`);
      const to = map.querySelector(`[data-map-block="${toKey}"]`);
      if (!from || !to) continue;
      const thread = threadBetween(toRect(from), toRect(to), box);
      if (thread) next.push(thread);
    }

    setFrame({ width: box.width, height: box.height });
    setThreads(next);
  }, [map, pairs]);

  useLayoutEffect(() => {
    measure();
  }, [measure, watch]);

  useEffect(() => {
    if (typeof ResizeObserver === 'undefined') return;

    // Перемір іде в наступний кадр: ResizeObserver спрацьовує під час
    // розкладки, і синхронний `getBoundingClientRect` у ньому читав би розміри
    // на півдорозі — блоки вже нові, ряд ще старий.
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(measure);
    });
    observer.observe(map);
    for (const block of map.querySelectorAll('[data-map-block]')) observer.observe(block);

    return () => {
      cancelAnimationFrame(rafRef.current);
      observer.disconnect();
    };
  }, [map, measure, watch]);

  if (threads.length === 0 || frame.width < 1) return null;

  return (
    <svg
      className="pmap-threads"
      viewBox={`0 0 ${frame.width} ${frame.height}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <g className="pmap-threads-glow">
        {threads.map((thread) => <path key={thread.d} d={thread.d} />)}
      </g>
      <g className="pmap-threads-core">
        {threads.map((thread) => <path key={thread.d} d={thread.d} />)}
      </g>
      <g className="pmap-threads-nodes">
        {threads.map((thread) => (
          <g key={thread.d}>
            <circle cx={thread.from.x} cy={thread.from.y} r={2.6} />
            <circle cx={thread.to.x} cy={thread.to.y} r={2.6} />
          </g>
        ))}
      </g>
    </svg>
  );
}
