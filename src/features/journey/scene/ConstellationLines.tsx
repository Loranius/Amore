import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { AdditiveBlending, BufferAttribute, BufferGeometry, type LineSegments } from 'three';
import type { Edge3D } from '../constellation3d';
import type { JourneyPalette } from '../journeyPalette';
import { birthProgress } from './JourneyConstellation';

// ============================================================
// Промені між подіями.
// ------------------------------------------------------------
// Кожна зірка, крім найпершої за датою, тягне рівно один промінь до
// попередньої. Отже рівно n−1 променів на n зірок — ланцюг, а не павутина.
//
// Це справжні лінії у сцені, а не накладений SVG. Різниця не декоративна:
// накладений шар не має глибини, тож промінь, який мав би пройти ЗА зіркою,
// малювався б поверх неї, і сузір'я миттєво читалось би пласким.
//
// Поява йде тим самим годинником, що й зірки, але керується `drawRange`:
// перебудовувати геометрію щокадру заради шести відрізків було б дорожче за
// саме малювання.
// ============================================================

export interface ConstellationLinesProps {
  edges: readonly Edge3D[];
  /** Порядок появи зірки, за її `id` — промінь чекає на власний кінець. */
  orderById: ReadonlyMap<number, number>;
  palette: JourneyPalette;
  /** Секунди від початку сцени. Реф, а не значення: див. шапку `JourneyScene`. */
  clock: { current: number };
  reducedMotion: boolean;
}

export function ConstellationLines({
  edges,
  orderById,
  palette,
  clock,
  reducedMotion,
}: ConstellationLinesProps) {
  const linesRef = useRef<LineSegments>(null);

  const geometry = useMemo(() => {
    const positions = new Float32Array(edges.length * 6);
    edges.forEach((edge, index) => {
      positions.set(
        [edge.from.x, edge.from.y, edge.from.z, edge.to.x, edge.to.y, edge.to.z],
        index * 6,
      );
    });
    const next = new BufferGeometry();
    next.setAttribute('position', new BufferAttribute(positions, 3));
    next.setDrawRange(0, 0);
    return next;
  }, [edges]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  useFrame(() => {
    const lines = linesRef.current;
    if (!lines) return;
    if (reducedMotion) {
      lines.geometry.setDrawRange(0, edges.length * 2);
      return;
    }
    // Промінь з'являється, коли народилась зірка на його ДАЛЬНЬОМУ кінці:
    // інакше він на мить висів би в порожнечі.
    let visible = 0;
    for (const edge of edges) {
      const order = orderById.get(edge.toId) ?? 0;
      if (birthProgress(order, clock.current) <= 0) break;
      visible += 1;
    }
    lines.geometry.setDrawRange(0, visible * 2);
  });

  if (edges.length === 0) return null;

  return (
    <lineSegments ref={linesRef} geometry={geometry} frustumCulled={false} renderOrder={0}>
      <lineBasicMaterial
        color={palette.key}
        transparent
        // Промінь — це зв'язок, а не подія. Він мусить читатись, лишаючись
        // тихішим за будь-яку зірку, інакше сузір'я перетворюється на схему.
        opacity={0.34}
        depthWrite={false}
        blending={AdditiveBlending}
        toneMapped={false}
      />
    </lineSegments>
  );
}
