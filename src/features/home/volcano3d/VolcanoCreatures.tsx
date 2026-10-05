// ============================================================
// Морські мешканці вулкана — виконані бажання (власник, 2026-10-05).
// ------------------------------------------------------------
// 1 бажання — рибка, 2 — медуза, 3 — устриця з перлиною, 4 — більша риба,
// 5 — кит, що пропливає на тлі, 6 — дельфін, що кружляє над вулканом;
// далі — рибка нового кольору за кожне бажання. Хто й де — у моделі
// (`volcanoCreatures`, детерміновано); тут лише low-poly тіла й рух.
//
// Тіла пофарбовані світлом заздалегідь (верх світліший, низ темніший):
// сцена вулкана не має джерел світла three, а простий фарбований меш
// читається так само, як решта гранчастого світу.
// ============================================================
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { VolcanoCreature, VolcanoCreatureKind } from '@/engine/species/volcano/model';

type V3 = [number, number, number];

/** Тіло з трикутників і кольором на вершину, з «запеченим» світлом. */
class Body {
  readonly pos: number[] = [];
  readonly col: number[] = [];
  tri(a: V3, b: V3, c: V3, colour: THREE.Color): this {
    const u = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    const v = new THREE.Vector3(c[0] - a[0], c[1] - a[1], c[2] - a[2]);
    const n = u.cross(v).normalize();
    // Світло згори-спереду: верхні грані світліші, черевце темніше.
    const light = 0.62 + 0.3 * Math.abs(n.y) * (n.y > 0 ? 1 : 0.4) + 0.12 * Math.abs(n.z);
    const shaded = colour.clone().multiplyScalar(light);
    for (const p of [a, b, c]) {
      this.pos.push(p[0], p[1], p[2]);
      this.col.push(shaded.r, shaded.g, shaded.b);
    }
    return this;
  }
  geometry(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.computeBoundingSphere();
    return g;
  }
}

/** Риба носом уздовж +x: ромбове тіло, хвіст і плавець. */
function fishBody(len: number, colour: THREE.Color, belly: THREE.Color, opts: { flukes?: boolean; dorsal?: boolean; beak?: boolean } = {}): THREE.BufferGeometry {
  const b = new Body();
  // Кит — товстий, риби — пласкіші з боків.
  const h = len * (opts.flukes ? 0.22 : 0.26);
  const w = len * (opts.flukes ? 0.22 : 0.16);
  const nose: V3 = [len * (opts.beak ? 0.62 : 0.5), opts.beak ? -h * 0.15 : 0, 0];
  const top: V3 = [len * 0.05, h, 0];
  const bottom: V3 = [len * 0.05, -h * 0.8, 0];
  const left: V3 = [len * 0.08, 0, -w];
  const right: V3 = [len * 0.08, 0, w];
  const tail: V3 = [-len * 0.36, 0, 0];
  const ring: V3[] = [top, right, bottom, left];
  for (let i = 0; i < 4; i += 1) {
    const a = ring[i]!;
    const c = ring[(i + 1) % 4]!;
    const lower = a === bottom || c === bottom;
    b.tri(nose, c, a, lower ? belly : colour);
    b.tri(tail, a, c, lower ? belly : colour);
  }
  if (opts.flukes) {
    // Кит: хвіст горизонтальний.
    b.tri(tail, [-len * 0.56, 0, -h * 1.1], [-len * 0.48, 0, 0], colour);
    b.tri(tail, [-len * 0.48, 0, 0], [-len * 0.56, 0, h * 1.1], colour);
    b.tri(tail, [-len * 0.48, 0, 0], [-len * 0.56, 0, -h * 1.1], colour);
    b.tri(tail, [-len * 0.56, 0, h * 1.1], [-len * 0.48, 0, 0], colour);
  } else {
    b.tri(tail, [-len * 0.56, h * 0.9, 0], [-len * 0.5, 0, 0], colour);
    b.tri(tail, [-len * 0.5, 0, 0], [-len * 0.56, -h * 0.9, 0], colour);
    b.tri(tail, [-len * 0.5, 0, 0], [-len * 0.56, h * 0.9, 0], colour);
    b.tri(tail, [-len * 0.56, -h * 0.9, 0], [-len * 0.5, 0, 0], colour);
  }
  if (opts.dorsal) {
    b.tri(top, [-len * 0.12, h * 0.4, 0], [-len * 0.04, h * 1.7, 0], colour);
    b.tri(top, [-len * 0.04, h * 1.7, 0], [-len * 0.12, h * 0.4, 0], colour);
  }
  // Очі — білі цятки з боків біля носа.
  const eye = new THREE.Color('#ffffff');
  for (const s of [-1, 1]) {
    const e: V3 = [len * 0.3, h * 0.25, s * w * 0.62];
    b.tri(e, [e[0] + len * 0.05, e[1], e[2] + s * 0.001], [e[0], e[1] + len * 0.05, e[2] + s * 0.001], eye);
  }
  return b.geometry();
}

/** Медуза: купол із двох кілець і щупальця. */
function jellyBody(r: number): THREE.BufferGeometry {
  const b = new Body();
  const dome = new THREE.Color('#ff9ed2');
  const rim = new THREE.Color('#ffd0ec');
  const N = 8;
  const apex: V3 = [0, r * 0.9, 0];
  const mid = (i: number): V3 => [Math.cos((i / N) * Math.PI * 2) * r * 0.75, r * 0.55, Math.sin((i / N) * Math.PI * 2) * r * 0.75];
  const low = (i: number): V3 => [Math.cos((i / N) * Math.PI * 2) * r, 0, Math.sin((i / N) * Math.PI * 2) * r];
  for (let i = 0; i < N; i += 1) {
    b.tri(apex, mid(i + 1), mid(i), dome);
    b.tri(mid(i), mid(i + 1), low(i + 1), dome);
    b.tri(mid(i), low(i + 1), low(i), rim);
    b.tri(low(i), low(i + 1), [0, r * 0.15, 0], rim);
  }
  // Щупальця — тонкі хвилясті стрічки.
  for (let k = 0; k < 6; k += 1) {
    const a = (k / 6) * Math.PI * 2;
    const x = Math.cos(a) * r * 0.55;
    const z = Math.sin(a) * r * 0.55;
    const len = r * (1.4 + 0.4 * (k % 2));
    b.tri([x - r * 0.06, 0, z], [x + r * 0.06, 0, z], [x + r * 0.12, -len, z], rim);
    b.tri([x + r * 0.06, 0, z], [x - r * 0.06, 0, z], [x + r * 0.12, -len, z], rim);
  }
  return b.geometry();
}

/** Половинка мушлі устриці: віяло з ребрами. */
function shellBody(r: number, colour: THREE.Color): THREE.BufferGeometry {
  const b = new Body();
  const N = 7;
  const hinge: V3 = [0, 0, 0];
  for (let i = 0; i < N; i += 1) {
    const a0 = Math.PI * (i / N);
    const a1 = Math.PI * ((i + 1) / N);
    const p0: V3 = [Math.sin(a0) * r, 0.04 * r, -Math.cos(a0) * r];
    const p1: V3 = [Math.sin(a1) * r, 0.04 * r, -Math.cos(a1) * r];
    const crest: V3 = [Math.sin((a0 + a1) / 2) * r * 0.6, r * 0.22, -Math.cos((a0 + a1) / 2) * r * 0.6];
    const tone = colour.clone().multiplyScalar(i % 2 ? 0.92 : 1.06);
    b.tri(hinge, p1, crest, tone);
    b.tri(crest, p1, p0, tone);
    b.tri(hinge, crest, p0, tone);
    b.tri(hinge, p0, p1, tone.clone().multiplyScalar(0.8));
  }
  return b.geometry();
}

const KIND_SIZE: Record<VolcanoCreatureKind, number> = { fish: 0.26, jellyfish: 0.16, oyster: 0.3, bigFish: 0.46, whale: 1.6, dolphin: 0.5 };

function bodyFor(c: VolcanoCreature): THREE.BufferGeometry[] {
  const size = KIND_SIZE[c.kind];
  switch (c.kind) {
    case 'fish': {
      const colour = new THREE.Color().setHSL(c.hue, 0.85, 0.58);
      return [fishBody(size, colour, colour.clone().offsetHSL(0, -0.2, 0.18))];
    }
    case 'bigFish': return [fishBody(size, new THREE.Color('#3a7fd8'), new THREE.Color('#f2e6b8'), { dorsal: true })];
    case 'whale': return [fishBody(size, new THREE.Color('#46628f'), new THREE.Color('#c8d6e8'), { flukes: true, dorsal: false })];
    case 'dolphin': return [fishBody(size, new THREE.Color('#7d9ab8'), new THREE.Color('#e8eef4'), { dorsal: true, beak: true })];
    case 'jellyfish': return [jellyBody(size)];
    case 'oyster': {
      const shell = new THREE.Color('#c8b8a8');
      const pearl = new THREE.IcosahedronGeometry(size * 0.22, 1);
      return [shellBody(size, shell), shellBody(size, shell.clone().multiplyScalar(1.1)), pearl];
    }
  }
}

export function VolcanoCreatures({ creatures, reduceMotion }: { creatures: readonly VolcanoCreature[]; reduceMotion: boolean }) {
  const bodies = useMemo(() => creatures.map(bodyFor), [creatures]);
  const materials = useMemo(() => ({
    body: new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }),
    jelly: new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, transparent: true, opacity: 0.78, depthWrite: false }),
    // Перлина світиться сама.
    pearl: new THREE.MeshBasicMaterial({ color: new THREE.Color('#fff6fb').multiplyScalar(1.3), toneMapped: false }),
  }), []);
  useEffect(() => () => { for (const list of bodies) for (const g of list) g.dispose(); }, [bodies]);
  useEffect(() => () => { materials.body.dispose(); materials.jelly.dispose(); materials.pearl.dispose(); }, [materials]);
  const refs = useRef<(THREE.Group | null)[]>([]);
  const lids = useRef<(THREE.Mesh | null)[]>([]);

  useFrame(({ clock }) => {
    const t = reduceMotion ? 0 : clock.getElapsedTime();
    creatures.forEach((c, i) => {
      const g = refs.current[i];
      if (!g) return;
      const a = (c.phase * Math.PI) / 180 + t * c.speed;
      const x = Math.cos(a) * c.orbit;
      const z = Math.sin(a) * c.orbit;
      let y = c.height;
      // Напрям руху — дотична до кола (проти годинникової стрілки).
      g.rotation.set(0, Math.atan2(-Math.cos(a), -Math.sin(a)), 0);
      if (c.kind === 'jellyfish') {
        y += 0.12 * Math.sin(t * 0.7 + c.phase);
        const pulse = 1 + 0.12 * Math.sin(t * 2.2 + c.phase);
        g.scale.set(pulse, 2 - pulse, pulse);
        g.rotation.set(0, t * 0.2, 0);
      } else if (c.kind === 'dolphin') {
        // Дельфін пірнає дугами над кратером.
        const arc = Math.sin(t * 1.4 + c.phase);
        y += 0.22 * arc;
        g.rotation.z = 0.55 * Math.cos(t * 1.4 + c.phase);
      } else if (c.kind === 'oyster') {
        g.rotation.set(0, (c.phase * Math.PI) / 180, 0);
        const lid = lids.current[i];
        if (lid) lid.rotation.x = -(0.45 + 0.25 * Math.sin(t * 0.6 + c.phase));
      } else {
        y += 0.04 * Math.sin(t * 1.3 + c.phase);
        // Хвіст хитає все тіло — ледь-ледь.
        g.rotation.y += 0.12 * Math.sin(t * (c.kind === 'whale' ? 1 : 7) + c.phase);
      }
      g.position.set(x, y, z);
    });
  });

  return (
    <>
      {creatures.map((c, i) => {
        const parts = bodies[i]!;
        return (
          <group key={`${c.wishId}:${c.index}`} ref={(el) => { refs.current[i] = el; }}>
            {c.kind === 'oyster' ? (
              <>
                <mesh geometry={parts[0]!} material={materials.body} />
                <mesh geometry={parts[1]!} material={materials.body} ref={(el) => { lids.current[i] = el; }} />
                <mesh geometry={parts[2]!} material={materials.pearl} position={[KIND_SIZE.oyster * 0.42, KIND_SIZE.oyster * 0.22, 0]} />
              </>
            ) : (
              <mesh geometry={parts[0]!} material={c.kind === 'jellyfish' ? materials.jelly : materials.body} />
            )}
          </group>
        );
      })}
    </>
  );
}
