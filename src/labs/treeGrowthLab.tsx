// ============================================================
// Лабораторія росту дерева (ADR-0237) — справжня модель і світ.
// ------------------------------------------------------------
// Та сама пара на кількох віках поруч: видно, як гілки років стають
// ярусами по 3–4 і як стовбур витягується, коли ярус повний. Сцена —
// `TreeV2World` без неба (`bare`), як на екрані входу.
//
//   /tree-growth-lab.html                         — 1, 4, 5, 8, 15, 30 років
//   /tree-growth-lab.html?years=4,8&hot=2         — рік 2 насичений: його гілка довша й горизонтальніша
//   /tree-growth-lab.html?fill=0&theme=light      — порожня історія: росте лише час
//   /tree-growth-lab.html?form=spruce             — ялина (oak | spruce | sakura, ADR-0237)
//
// Сторінка не входить у збірку продукту: лише dev-сервер.
// ============================================================
import { useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { Canvas } from '@react-three/fiber';
import { TREE_FORMS, buildTreeV2Geometry, type TreeForm } from '@/engine/species/treeV2/geometry';
import { buildTreeV2Model } from '@/engine/species/treeV2/model';
import { PORTAL_GROUND_Y } from '@/features/home/crystal3d/scene/portalScene';
import { TreeV2World } from '@/features/home/crystal3d/treeV2/TreeV2World';
import { treeV2Frame } from '@/features/home/crystal3d/treeV2/treeV2Frame';
import { dioramaIslandRadius } from '@/features/home/diorama/dioramaStyle';
import { yearsWord } from '@/features/auth/newCouple';
import { labSnapshot } from './labSnapshot';
import '@/index.css';

function Island({ years, fill, hot, theme, x, form }: { years: number; fill: number; hot: number[]; theme: 'light' | 'dark'; x: number; form: TreeForm }) {
  const built = useMemo(() => {
    const base = labSnapshot(years, fill);
    const startYear = Number(base.startDate.slice(0, 4));
    // Насичений рік: сорок спогадів у травні цього року.
    const extra = hot.filter((y) => y < years).flatMap((y) =>
      Array.from({ length: 40 }, (_, k) => ({ id: 500_000 + y * 100 + k, date: `${startYear + y}-05-${String(1 + (k % 28)).padStart(2, '0')}` })));
    const model = buildTreeV2Model({ ...base, memories: [...(base.memories ?? []), ...extra] });
    const geometry = buildTreeV2Geometry(model, form);
    const frame = treeV2Frame(geometry);
    return { model, geometry, frame, island: dioramaIslandRadius(frame.reach * 0.9) };
  }, [years, fill, hot, form]);
  const k = 1 / 2.6;
  return (
    <group position={[x, 0, 0]} scale={k}>
      <group position={[0, -PORTAL_GROUND_Y, 0]}>
        <TreeV2World bare seed={built.model.startDate} geometry={built.geometry} scale={built.frame.scale} theme={theme} reduceMotion island={built.island} form={form} />
      </group>
    </group>
  );
}

function Lab() {
  const params = new URLSearchParams(window.location.search);
  const ages = (params.get('years') ?? '1,4,5,8,15,30').split(',').map(Number).filter((n) => Number.isFinite(n) && n >= 0);
  const fill = Number(params.get('fill') ?? 4);
  const hot = (params.get('hot') ?? '').split(',').filter(Boolean).map(Number);
  const theme = params.get('theme') === 'dark' ? 'dark' : 'light';
  const asked = params.get('form');
  const form: TreeForm = TREE_FORMS.includes(asked as TreeForm) ? (asked as TreeForm) : 'oak';
  const gap = 2.1;
  const sky = theme === 'light' ? '#bfe3f2' : '#1b2a4a';
  return (
    <>
      <Canvas
        dpr={[1, 2]}
        camera={{ position: [0, 1.2, 3.6 + ages.length * 1.3], fov: 34 }}
        onCreated={({ camera }) => camera.lookAt(0, 0.45, 0)}
        gl={{ alpha: false }}
        style={{ position: 'fixed', inset: 0, background: sky }}
      >
        <color attach="background" args={[sky]} />
        {ages.map((years, i) => (
          <Island key={years} years={years} fill={fill} hot={hot} theme={theme} form={form} x={(i - (ages.length - 1) / 2) * gap} />
        ))}
      </Canvas>
      <div style={{ position: 'fixed', left: 0, right: 0, bottom: 24, display: 'flex', justifyContent: 'space-around', pointerEvents: 'none' }}>
        {ages.map((years) => (
          <span key={years} style={{ color: '#12324a', font: '700 17px system-ui' }}>
            {years} {yearsWord(years)}
          </span>
        ))}
      </div>
    </>
  );
}

createRoot(document.getElementById('root')!).render(<Lab />);
