import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { createGrassBladeTexture } from './TreeEnvironmentTextures';
import { metres } from './sceneScale';
import { BUTTERFLY_WING_RADIUS, buildGroundItems, butterflyFlight } from './meadow';

type Props = {
  theme: 'light' | 'dark';
  hillRadius: number;
  soilRadius: number;
  groundY: number;
  /*
   * Крона й висота приходять сюди НЕ для того, щоб дрібниці росли з
   * деревом — вони лишаються свого розміру в метрах. Вони потрібні, щоб
   * знати, ДЕ дерево: опад має лежати під кроною, а метелики — літати
   * коло неї, а не за краєм кадру.
   */
  crownRadius: number;
  treeHeight: number;
  reducedMotion: boolean;
};


const PALETTE = {
  light: {
    stemA: '#67864a', stemB: '#85a55d',
    flowerA: '#f7f2df', flowerB: '#e7cc73', flowerC: '#aa9cc4',
    leafA: '#8a6944', leafB: '#b08b5e', twig: '#6a5037',
    cloud: '#f8faf5', butterflyA: '#e9c66f', butterflyB: '#f0dfbb',
  },
  dark: {
    stemA: '#587544', stemB: '#779451',
    flowerA: '#eeeadc', flowerB: '#d8bb62', flowerC: '#9587ae',
    leafA: '#765a3d', leafB: '#98744c', twig: '#58442f',
    cloud: '#edf2ea', butterflyA: '#d9b55e', butterflyB: '#e3d0a9',
  },
} as const;

function makeGrassTuftGeometry() {
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  /*
   * Ті самі пропорції, що й у статичної трави в `TreeTexturedStage`: жмуток
   * ширший за власну висоту. Було 0.10 на 0.48 — майже вп'ятеро вища за
   * ширину, і разом із текстурою в одну билину це давало голку.
   *
   * Тримати ці два набори однаковими важливо: обидві системи стоять на тій
   * самій галявині й беруть ту саму текстуру, тож розбіжність у пропорціях
   * читалась би як два різні види трави без причини.
   */
  const cards = [
    [0, metres(0.34), metres(0.36)], [1.05, metres(0.30), metres(0.32)],
    [-1.08, metres(0.28), metres(0.30)], [2.08, metres(0.24), metres(0.26)],
    [-2.1, metres(0.22), metres(0.25)],
  ] as const;
  cards.forEach(([yaw, width, height]) => {
    const start = positions.length / 3;
    const rx = Math.cos(yaw) * width * 0.5;
    const rz = -Math.sin(yaw) * width * 0.5;
    positions.push(-rx, 0, -rz, rx, 0, rz, rx, height, rz, -rx, height, -rz);
    uvs.push(0, 0, 1, 0, 1, 1, 0, 1);
    indices.push(start, start + 1, start + 2, start, start + 2, start + 3);
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);

  /*
   * НОРМАЛЬ УГОРУ — І БЕЗ ЦЬОГО ТРАВА БУЛА ЧОРНОЮ.
   *
   * Кущик — п'ять вертикальних карток навхрест. `computeVertexNormals` дає
   * кожній нормаль ПЕРПЕНДИКУЛЯРНО до площини, тобто вбік; на
   * `meshStandardMaterial` це означає, що картка, відвернута від сонця,
   * освітлення не дістає взагалі.
   *
   * ВИМІРЯНО НА ЖИВОМУ ЕКРАНІ: ці кущики малювались як rgb(1,1,3) — тобто
   * чорні шпичаки на освітленому лузі, схожі на дорожні фішки. Знайти їх
   * удалось лише вимкненням: коли з іншої системи прибрали всі 235 кущиків,
   * шпичаки лишились на місці, отже вони були не звідти.
   *
   * Жива трава так не поводиться: пучок розсіює світло й читається м'яким
   * об'ємом, освітленим згори. Тому нормаль тут спільна й спрямована вгору —
   * той самий прийом, що й у `TreeTexturedStage`, і саме він садить кущик у
   * те саме світло, що й землю під ним.
   */
  const upward = new Float32Array((positions.length / 3) * 3);
  for (let index = 1; index < upward.length; index += 3) upward[index] = 1;
  geometry.setAttribute('normal', new THREE.BufferAttribute(upward, 3));
  return geometry;
}

/*
 * ОПАЛИЙ ЛИСТОК — ДВАНАДЦЯТЬ САНТИМЕТРІВ.
 *
 * Обрис лишився той самий; змінилась лише одиниця, в якій він написаний.
 * Було 0.185 одиниці завдовжки — при метрі сцени це вісімдесят два
 * сантиметри, і на знімку трирічної пари ці листки лежали на лузі
 * рудими плитами з чверть крони завширшки. Саме вони, а не камені,
 * найгучніше казали «сцена завелика».
 */
const DRY_LEAF_LENGTH = metres(0.12);

function makeDryLeafGeometry() {
  const geometry = new THREE.BufferGeometry();
  // Обрис нормований на власну довжину, тож `DRY_LEAF_LENGTH` і є довжина.
  const k = DRY_LEAF_LENGTH / 0.185;
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([
    0, 0.005, 0.09,
    0.055, 0, 0.025,
    0.04, 0.004, -0.06,
    0, 0, -0.095,
    -0.045, 0.004, -0.052,
    -0.058, 0, 0.028,
  ].map((value) => value * k), 3));
  geometry.setIndex([0, 1, 2, 0, 2, 3, 0, 3, 4, 0, 4, 5]);
  geometry.computeVertexNormals();
  return geometry;
}


function BreezeGrass({ theme, hillRadius, soilRadius, groundY, reducedMotion }: Props) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const tick = useRef(0);
  const geometry = useMemo(() => makeGrassTuftGeometry(), []);
  const texture = useMemo(() => createGrassBladeTexture(theme), [theme]);
  const items = useMemo(
    () => buildGroundItems(130, Math.max(soilRadius * 1.5, metres(1.1)), hillRadius * 0.7, hillRadius, groundY, 101),
    [hillRadius, soilRadius, groundY],
  );

  useEffect(() => () => { geometry.dispose(); texture.dispose(); }, [geometry, texture]);

  useEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    const dummy = new THREE.Object3D();
    items.forEach((item, index) => {
      dummy.position.set(item.x, item.y, item.z);
      dummy.rotation.set(0, item.rotation, 0);
      dummy.scale.set(item.scale, THREE.MathUtils.lerp(0.72, 1.18, item.tone), item.scale);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    // Сфера відсікання — після запису матриць; див. `TreeTexturedStage`.
    mesh.computeBoundingSphere();
  }, [items]);

  useFrame((state, delta) => {
    if (reducedMotion) return;
    tick.current += delta;
    if (tick.current < 0.055) return;
    tick.current = 0;
    const mesh = ref.current;
    if (!mesh) return;
    const dummy = new THREE.Object3D();
    const time = state.clock.elapsedTime;
    items.forEach((item, index) => {
      const sway = Math.sin(time * 1.05 + item.phase) * 0.045;
      dummy.position.set(item.x, item.y, item.z);
      dummy.rotation.set(sway * 0.12, item.rotation, sway);
      dummy.scale.set(item.scale, THREE.MathUtils.lerp(0.72, 1.18, item.tone), item.scale);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={ref} args={[geometry, undefined, items.length]}>
      {/*
        * `FrontSide`, А НЕ `DoubleSide` — БЕЗ ЦЬОГО ПІВКАРТКИ ЧОРНІ.
        *
        * Нормаль кущика спрямована вгору (див. `makeGrassTuftGeometry`), але
        * three для двобічного матеріалу ПЕРЕВЕРТАЄ її на задніх гранях:
        * `normal *= faceDirection` у `normal_fragment_begin.glsl`. Отже задня
        * половина кожної картки діставала нормаль (0,-1,0), тобто світло лише
        * знизу, і малювалась як rgb(3,2,5) при лузі поруч rgb(64,73,41).
        *
        * На екрані це були чорні шпичаки, схожі на дорожні фішки. Вони
        * пережили і виправлення кольору землі, і саму нормаль угору — саме
        * тому, що причина була не в нормалі, а в тому, що її перевертають.
        *
        * Односторонні картки тут нічого не коштують: кущик складений із
        * п'яти, схрещених під різними кутами, тож із будь-якого боку видно
        * щонайменше дві. Це дешевше за подвоєння трикутників заради
        * зворотної намотки.
        */}
      <meshStandardMaterial
        map={texture}
        color="#ffffff"
        roughness={0.96}
        side={THREE.FrontSide}
        transparent
        alphaTest={0.2}
      />
    </instancedMesh>
  );
}

function DryLitter({ theme, hillRadius, soilRadius, crownRadius, groundY }: Props) {
  const leafRef = useRef<THREE.InstancedMesh>(null);
  const twigRef = useRef<THREE.InstancedMesh>(null);
  const palette = PALETTE[theme];
  const leafGeometry = useMemo(() => makeDryLeafGeometry(), []);
  const leaves = useMemo(
    () => buildGroundItems(44, Math.max(soilRadius * 0.5, metres(0.3)), Math.max(crownRadius * 1.1, soilRadius * 1.9, metres(1.4)), hillRadius, groundY, 151),
    [hillRadius, soilRadius, crownRadius, groundY],
  );
  const twigs = useMemo(
    () => buildGroundItems(18, Math.max(soilRadius * 0.6, metres(0.4)), Math.max(crownRadius * 1.2, soilRadius * 2, metres(1.6)), hillRadius, groundY, 181),
    [hillRadius, soilRadius, crownRadius, groundY],
  );

  useEffect(() => () => leafGeometry.dispose(), [leafGeometry]);
  useEffect(() => {
    const mesh = leafRef.current;
    if (!mesh) return;
    const dummy = new THREE.Object3D();
    const a = new THREE.Color(palette.leafA);
    const b = new THREE.Color(palette.leafB);
    const color = new THREE.Color();
    leaves.forEach((item, index) => {
      dummy.position.set(item.x, item.y + metres(0.01), item.z);
      dummy.rotation.set((item.tone - 0.5) * 0.08, item.rotation, (item.tone - 0.5) * 0.12);
      dummy.scale.setScalar(item.scale);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
      color.copy(a).lerp(b, item.tone);
      mesh.setColorAt(index, color);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [leaves, palette]);
  useEffect(() => {
    const mesh = twigRef.current;
    if (!mesh) return;
    const dummy = new THREE.Object3D();
    twigs.forEach((item, index) => {
      dummy.position.set(item.x, item.y + metres(0.015), item.z);
      dummy.rotation.set(Math.PI / 2, item.rotation, (item.tone - 0.5) * 0.18);
      dummy.scale.setScalar(item.scale);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [twigs]);

  return (
    <>
      <instancedMesh ref={leafRef} args={[leafGeometry, undefined, leaves.length]}>
        <meshStandardMaterial color="#ffffff" roughness={1} side={THREE.DoubleSide} />
      </instancedMesh>
      <instancedMesh ref={twigRef} args={[undefined, undefined, twigs.length]}>
        <cylinderGeometry args={[metres(0.006), metres(0.009), metres(0.3), 5]} />
        <meshStandardMaterial color={palette.twig} roughness={1} />
      </instancedMesh>
    </>
  );
}

/** Довжина стеблинки в геометрії — з неї рахується масштаб інстансу. */
const FLOWER_STEM_LENGTH = metres(0.3);

function Flowers({ theme, hillRadius, soilRadius, groundY }: Props) {
  const stemRef = useRef<THREE.InstancedMesh>(null);
  const headRef = useRef<THREE.InstancedMesh>(null);
  const palette = PALETTE[theme];
  const flowers = useMemo(
    () => buildGroundItems(46, Math.max(soilRadius * 1.65, metres(1.3)), hillRadius * 0.64, hillRadius, groundY, 211),
    [hillRadius, soilRadius, groundY],
  );
  useEffect(() => {
    const stems = stemRef.current;
    const heads = headRef.current;
    if (!stems || !heads) return;
    const dummy = new THREE.Object3D();
    const colors: readonly [THREE.Color, THREE.Color, THREE.Color] = [
      new THREE.Color(palette.flowerA),
      new THREE.Color(palette.flowerB),
      new THREE.Color(palette.flowerC),
    ];
    flowers.forEach((item, index) => {
      /*
       * КВІТКА В ТРАВІ, А НЕ ЛЕДЕНЕЦЬ НА ПАЛИЧЦІ.
       *
       * Перша метрична редакція дала стебло 26-48 см із голівкою ⌀10 см
       * зверху, і на знімку це читалось саме льодяником: гола зелена
       * паличка над стриженим лугом. Річ не в розмірі голівки, а в
       * ПРОПОРЦІЇ до трави: жмуток має 22-42 см, і квітка мусить сидіти в
       * ньому, а не стирчати над ним удвічі вище.
       *
       * 16-30 см ставить голівку на рівень верхівок трави — стебло
       * ховається між билинами, видно квітку.
       */
      const height = metres(0.16) + item.tone * metres(0.14);
      dummy.position.set(item.x, item.y + height * 0.5, item.z);
      dummy.rotation.set(0, item.rotation, 0);
      dummy.scale.set(item.scale, height / FLOWER_STEM_LENGTH, item.scale);
      dummy.updateMatrix();
      stems.setMatrixAt(index, dummy.matrix);
      dummy.position.set(item.x, item.y + height + metres(0.02), item.z);
      dummy.scale.setScalar(0.78 + item.scale * 0.25);
      dummy.updateMatrix();
      heads.setMatrixAt(index, dummy.matrix);
      const colorIndex = Math.min(2, Math.floor(item.tone * 3));
      heads.setColorAt(index, colors[colorIndex] ?? colors[0]);
    });
    stems.instanceMatrix.needsUpdate = true;
    heads.instanceMatrix.needsUpdate = true;
    stems.computeBoundingSphere();
    heads.computeBoundingSphere();
    if (heads.instanceColor) heads.instanceColor.needsUpdate = true;
  }, [flowers, palette]);
  return (
    <>
      <instancedMesh ref={stemRef} args={[undefined, undefined, flowers.length]}>
        <cylinderGeometry args={[metres(0.004), metres(0.006), FLOWER_STEM_LENGTH, 5]} />
        <meshStandardMaterial color={palette.stemA} roughness={1} />
      </instancedMesh>
      <instancedMesh ref={headRef} args={[undefined, undefined, flowers.length]}>
        <icosahedronGeometry args={[metres(0.035), 0]} />
        <meshStandardMaterial color="#ffffff" roughness={0.92} />
      </instancedMesh>
    </>
  );
}

/*
 * ТУТ СТОЯЛИ ТРИ ХМАРИ — 1 080 ТРИКУТНИКІВ, ЯКИХ НЕ БАЧИВ НІХТО.
 *
 * Дванадцять кульок сиділи на висоті 9.8-12.2 над землею, на z від -25 до
 * -30, і малювались `fog={false}`, тобто крізь туман. Порахувано по самій
 * камері (`portalCameraFrame`): камера дивиться в ціль, опущену на 8.05°
 * нижче горизонту, півкут кадру по вертикалі 21°.
 *
 *   вік пари  найближча хмара над віссю огляду
 *   3.7 року  23.6°  — за кадром
 *   12 років  22.4°  — за кадром
 *   20 років  21.6°  — за кадром
 *   40 років  21.1°  — на самому ребрі
 *
 * Тобто хмар не було видно ЖОДНОГО разу за перші тридцять з гаком років —
 * рівно та сама вада, через яку з `TreeTexturedStage` прибрали три пагорби
 * й сонце. Знімок трирічної пари це підтверджує прямо: небо чисте.
 *
 * Прибрано, а не пересунуто. Хмара на своєму місці — це хмара БІЛЯ
 * ГОРИЗОНТУ, а горизонт тут малює текстура неба (`createSkyTexture`);
 * дванадцять сфер, підвішених під верхнім ребром кадру, вигадували б
 * глибину, якої в цій сцені немає. Якщо хмари треба — їм місце в текстурі
 * неба, і це окреме рішення власника, а не побічний ефект зміни масштабу.
 */

/*
 * МЕТЕЛИК ЗАВБІЛЬШКИ З МЕТЕЛИКА, І ТАМ, ДЕ ЙОГО ВИДНО.
 *
 * Було двічі не так. Розмах крил 0.105 одиниці — це сорок сім сантиметрів,
 * тобто птах, а не метелик; і обидва сиділи на СТАЛИХ висотах 2.15 та 2.72
 * над землею, тоді як верхнє ребро кадру стоїть на `0.49 + 1.12 * висота
 * дерева`. У трирічної пари дерево має 1.10, ребро — 1.72, а метелики
 * літали на 2.15 і 2.72: обидва ПОВНІСТЮ за кадром, і разом із хмарами це
 * складало близько 1 200 трикутників, які малювались щокадру в нікуди.
 *
 * Тепер розмір у метрах (сім сантиметрів розмаху), а місце — від самого
 * дерева: коло крони, куди метелик і летить.
 */

function Butterfly({ base, phase, color, reducedMotion }: { base: [number, number, number]; phase: number; color: string; reducedMotion: boolean }) {
  const group = useRef<THREE.Group>(null);
  const left = useRef<THREE.Mesh>(null);
  const right = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (reducedMotion) return;
    const t = state.clock.elapsedTime + phase;
    if (group.current) {
      // Розліт теж у метрах: півметра вбік, а не два.
      group.current.position.set(
        base[0] + Math.sin(t * 0.5) * metres(0.5),
        base[1] + Math.sin(t * 0.8) * metres(0.18),
        base[2] + Math.cos(t * 0.45) * metres(0.35),
      );
      group.current.rotation.y = Math.sin(t * 0.38) * 0.55;
    }
    const flap = Math.sin(t * 8) * 0.7;
    if (left.current) left.current.rotation.y = 0.4 + flap;
    if (right.current) right.current.rotation.y = -0.4 - flap;
  });
  return (
    <group ref={group} position={base}>
      <mesh ref={left} position={[-BUTTERFLY_WING_RADIUS * 0.7, 0, 0]} rotation={[0.08, 0.4, 0.15]}>
        <circleGeometry args={[BUTTERFLY_WING_RADIUS, 6, 0, Math.PI]} />
        <meshBasicMaterial color={color} side={THREE.DoubleSide} transparent opacity={0.82} />
      </mesh>
      <mesh ref={right} position={[BUTTERFLY_WING_RADIUS * 0.7, 0, 0]} rotation={[0.08, -0.4, -0.15]}>
        <circleGeometry args={[BUTTERFLY_WING_RADIUS, 6, Math.PI, Math.PI]} />
        <meshBasicMaterial color={color} side={THREE.DoubleSide} transparent opacity={0.82} />
      </mesh>
      <mesh scale={[0.35, 1.1, 0.35]}>
        <sphereGeometry args={[BUTTERFLY_WING_RADIUS * 0.37, 6, 5]} />
        <meshBasicMaterial color="#40382f" />
      </mesh>
    </group>
  );
}

export function TreeLifeDetailsPolished(props: Props) {
  const palette = PALETTE[props.theme];
  const [first, second] = butterflyFlight(props.crownRadius, props.treeHeight);
  return (
    <>
      <BreezeGrass {...props} />
      <Flowers {...props} />
      <DryLitter {...props} />
      <Butterfly
        base={[first[0], props.groundY + first[1], first[2]]}
        phase={0.4}
        color={palette.butterflyA}
        reducedMotion={props.reducedMotion}
      />
      <Butterfly
        base={[second[0], props.groundY + second[1], second[2]]}
        phase={2.7}
        color={palette.butterflyB}
        reducedMotion={props.reducedMotion}
      />
    </>
  );
}