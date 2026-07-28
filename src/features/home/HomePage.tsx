// ============================================================
// HomePage — головна: Hero + Кристал Amore
// ------------------------------------------------------------
// 3D-рендер (crystal3d/CrystalScene.tsx, Three.js/React Three Fiber) —
// основний; SVG-версія (Crystal.tsx) — гарантований фолбек, якщо WebGL
// недоступний або 3D-сцена впаде при ініціалізації (CrystalErrorBoundary).
//
// На час ЗАВАНТАЖЕННЯ чанка сцени показується CrystalPlaceholder, а не
// Crystal: підставляти туди кристал першої версії означало показувати
// кожному холодному входу дизайн, від якого давно відмовились (див.
// коментар у CrystalPlaceholder.tsx).
// Обидва рендери читають ту саму useCrystalDNA(). Hero (привітання/
// лічильник/найближча подія) — над кристалом, не замість нього.
// ============================================================
import { lazy, Suspense } from 'react';
import { Hero } from './Hero';
import { Crystal } from './Crystal';
import { CrystalPlaceholder } from './CrystalPlaceholder';
import { CrystalErrorBoundary } from './crystal3d/CrystalErrorBoundary';
import { useWebglSupport } from './crystal3d/useWebglSupport';
import { PortalDecor } from '@/features/auth/PortalDecor';

const CrystalScene = lazy(() => import('./crystal3d/CrystalScene'));

export function HomePage() {
  const webglSupported = useWebglSupport();

  return (
    <section className="home">
      <PortalDecor density="light" parallax={false} />
      <Hero />
      <h1 className="home-title">Кристал Amore</h1>
      {webglSupported ? (
        <CrystalErrorBoundary fallback={<Crystal />}>
          <Suspense fallback={<CrystalPlaceholder />}>
            <CrystalScene />
          </Suspense>
        </CrystalErrorBoundary>
      ) : (
        <Crystal />
      )}
    </section>
  );
}
