import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { OrbitControls } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import type { WorldCameraPose } from '@/features/world/crystalAtlas';
import type { WorldMotionMode } from '@/features/world/sceneDirector';
import { PortalCameraRig } from '../scene/PortalEnvironment';
import { portalCameraFrame } from '../scene/portalScene';
import { useTreeEnvironmentTextures } from './TreeEnvironmentTextures';
import { metres } from './sceneScale';
import {
  GRASS_CARD_BASE,
  GRASS_CARD_HEIGHT,
  buildGrassInstances,
  buildRockInstances,
  clamp01,
  treeMeadowRadius,
  hash2,
  terrainHeight,
  treeMeadowShadows,
} from './meadow';

type TreeTexturedStageProps = {
  theme: 'light' | 'dark';
  reduceMotion: boolean;
  soilRadius: number;
  crownRadius: number;
  treeHeight: number;
  groundY: number;
  pose?: WorldCameraPose | undefined;
  motionMode?: { current: Exclude<WorldMotionMode, 'navigation'> } | undefined;
  allowOrbit?: boolean | undefined;
  children: ReactNode;
};


const PALETTE = {
  light: {
    sky: '#8fc6e6', fog: '#a9d4ea', distantGrass: '#829d66',
    stoneA: '#858a7f', stoneB: '#687066', hazeHill: '#91aa91', hazeHillFar: '#adbfba',
    shadow: '#263527', sun: '#fff2bd', sunHalo: '#fff4c7', sunLight: '#ffe8bd',
    skyLight: '#d8ecff', groundLight: '#73845a', rim: '#c8ddff',
  },
  dark: {
    sky: '#78b7d7', fog: '#96c9df', distantGrass: '#6c8755',
    stoneA: '#737a70', stoneB: '#596159', hazeHill: '#78947f', hazeHillFar: '#9aafa2',
    shadow: '#1f2b22', sun: '#ffe9a8', sunHalo: '#ffedb8', sunLight: '#ffdfad',
    skyLight: '#c8e2f3', groundLight: '#5b704f', rim: '#bdd8f6',
  },
} as const;

function buildTerrainGeometry(radius: number) {
  /*
   * 18×56, а було 28×88 — тобто 1 960 трикутників замість 4 840.
   *
   * Числа не з голови: розклад живої сцени (`npm run live -- … --breakdown`)
   * показав, що терен — третя за вагою річ у кадрі, 13.2% усіх трикутників,
   * і йде вона на пагорб, який на телефоні майже весь перекритий травою,
   * камінням і самим деревом. Рельєф тут — плавна купольна функція з
   * ридж-шумом; 56 сегментів по колу дають крок 6.4° замість 4.1°, і на
   * силуеті це не читається, бо силует пагорба закриває передній план.
   */
  const rings = 18;
  const segments = 56;
  const positions: number[] = [0, 0, 0];
  const uvs: number[] = [0.5, 0.5];
  const indices: number[] = [];

  for (let ring = 1; ring <= rings; ring += 1) {
    const ringT = ring / rings;
    for (let segment = 0; segment < segments; segment += 1) {
      const angle = (segment / segments) * Math.PI * 2;
      const edgeJitter = ringT * (hash2(ring, segment, 41) - 0.5) * radius * 0.022;
      const rr = radius * ringT + edgeJitter;
      const x = Math.cos(angle) * rr;
      const z = Math.sin(angle) * rr;
      positions.push(x, terrainHeight(x, z, radius), z);
      uvs.push(clamp01(x / (radius * 2) + 0.5), clamp01(z / (radius * 2) + 0.5));
    }
  }

  for (let segment = 0; segment < segments; segment += 1) {
    const next = (segment + 1) % segments;
    indices.push(0, 1 + next, 1 + segment);
  }

  for (let ring = 1; ring < rings; ring += 1) {
    const currentStart = 1 + (ring - 1) * segments;
    const nextStart = 1 + ring * segments;
    for (let segment = 0; segment < segments; segment += 1) {
      const next = (segment + 1) % segments;
      const a = currentStart + segment;
      const b = currentStart + next;
      const c = nextStart + segment;
      const d = nextStart + next;
      indices.push(a, d, c, a, b, d);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

function buildGrassTuftGeometry() {
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  /*
   * КАРТКА ШИРША, НІЖ ВИЩА — жмуток, а не голка.
   *
   * Було 0.13 на 0.42, тобто втричі вища за власну ширину; разом із
   * текстурою в одну билину це давало зірку зі шпичаків. Виміряно на
   * екрані: пропорція плями трави мала медіану 4.38.
   *
   * Тепер текстура несе сім билин віялом (`createGrassBladeTexture`), тож
   * картці треба ширини, щоб те віяло було видно.
   *
   * РОЗМІРИ В МЕТРАХ (`sceneScale.ts`). Було 0.30×0.25 одиниці — тобто
   * жмуток метр тридцять заввишки при дереві 4.9 м. Тепер картка описана
   * тим, чим вона є: сорок сантиметрів лугової трави.
   */
  const cards = [
    { yaw: 0, width: metres(0.34), height: GRASS_CARD_HEIGHT, x: 0, z: 0 },
    { yaw: 1.08, width: metres(0.30), height: metres(0.32), x: metres(0.035), z: metres(0.011) },
    { yaw: -1.02, width: metres(0.28), height: metres(0.30), x: metres(-0.031), z: metres(0.026) },
    { yaw: 2.06, width: metres(0.24), height: metres(0.26), x: metres(0.021), z: metres(-0.026) },
    { yaw: -2.14, width: metres(0.22), height: metres(0.24), x: metres(-0.026), z: metres(-0.017) },
  ] as const;
  const baseY = -GRASS_CARD_BASE;

  cards.forEach((card) => {
    const start = positions.length / 3;
    const rx = Math.cos(card.yaw) * card.width * 0.5;
    const rz = -Math.sin(card.yaw) * card.width * 0.5;
    const topY = baseY + card.height;
    positions.push(
      card.x - rx, baseY, card.z - rz,
      card.x + rx, baseY, card.z + rz,
      card.x + rx, topY, card.z + rz,
      card.x - rx, topY, card.z - rz,
    );
    uvs.push(0, 0, 1, 0, 1, 1, 0, 1);
    indices.push(start, start + 1, start + 2, start, start + 2, start + 3);
  });

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);

  /*
   * НОРМАЛЬ УГОРУ, А НЕ ВБІК — і без цього трава темніє плямами.
   *
   * Кущик — це п'ять вертикальних карток, схрещених навхрест.
   * `computeVertexNormals` дав би кожній нормаль ПЕРПЕНДИКУЛЯРНО до її
   * площини, тобто вбік; отже картка, відвернута від сонця, почорніла б, а
   * сусідня в тому ж кущику світилась би. Кущик замигтів би гранями, як
   * зім'ятий папір.
   *
   * Жива трава так не поводиться: вона розсіює світло всім пучком і
   * читається як м'який об'єм, освітлений згори. Тому нормаль тут спільна й
   * спрямована вгору — той самий прийом, яким саджають траву в іграх, і
   * саме він садить кущик у те саме світло, що й землю під ним.
   */
  const upward = new Float32Array((positions.length / 3) * 3);
  for (let index = 1; index < upward.length; index += 3) upward[index] = 1;
  geometry.setAttribute('normal', new THREE.BufferAttribute(upward, 3));
  geometry.computeBoundingSphere();
  return geometry;
}


export function TreeTexturedStage({
  theme,
  reduceMotion,
  soilRadius,
  crownRadius,
  treeHeight,
  groundY,
  pose,
  motionMode,
  allowOrbit = true,
  children,
}: TreeTexturedStageProps) {
  const size = useThree((state) => state.size);
  const controls = useRef<OrbitControlsImpl>(null);
  const grassRef = useRef<THREE.InstancedMesh>(null);
  const rocksRef = useRef<THREE.InstancedMesh>(null);
  const aspect = size.height > 0 ? size.width / size.height : 1;
  const frame = useMemo(() => portalCameraFrame(aspect, crownRadius, treeHeight), [aspect, crownRadius, treeHeight]);
  const palette = PALETTE[theme];
  const hillRadius = useMemo(
    () => treeMeadowRadius(soilRadius, crownRadius, treeHeight),
    [soilRadius, crownRadius, treeHeight],
  );
  const terrainGeometry = useMemo(() => buildTerrainGeometry(hillRadius), [hillRadius]);
  const grassGeometry = useMemo(() => buildGrassTuftGeometry(), []);
  const grassInstances = useMemo(() => buildGrassInstances(hillRadius, soilRadius, groundY), [hillRadius, soilRadius, groundY]);
  const rockInstances = useMemo(() => buildRockInstances(hillRadius, soilRadius, groundY), [hillRadius, soilRadius, groundY]);
  const textures = useTreeEnvironmentTextures(theme, hillRadius, soilRadius);

  useEffect(() => () => terrainGeometry.dispose(), [terrainGeometry]);
  useEffect(() => () => grassGeometry.dispose(), [grassGeometry]);

  useEffect(() => {
    const mesh = grassRef.current;
    if (!mesh) return;
    const dummy = new THREE.Object3D();
    grassInstances.forEach((instance, index) => {
      dummy.position.set(instance.x, instance.y, instance.z);
      dummy.rotation.set(instance.rotationX, instance.rotationY, instance.rotationZ);
      dummy.scale.set(instance.scaleX, instance.scaleY, instance.scaleZ);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    /*
     * СФЕРА ВІДСІКАННЯ — ПІСЛЯ ЗАПИСУ МАТРИЦЬ, А НЕ ДО НЬОГО.
     *
     * `InstancedMesh` рахує свою сферу ОДИН раз, під час першого кадру, і
     * далі не перераховує. Матриці ж пишуться тут, у ефекті, тобто ПІСЛЯ
     * першого кадру: на той момент усі інстанси стоять в одній точці, і
     * сфера виходить завбільшки з одну травинку в центрі сцени. Далі
     * `Frustum.intersectsObject` міряє нею весь луг.
     *
     * ВИМІРЯНО НА ЖИВІЙ СЦЕНІ (`data-evolution-rendered-triangles`):
     * перший рік — 9 499 трикутників і 18 викликів малювання, 3.68 року —
     * 28 742 і 24. Шість викликів зникали: трава, квіти (стебла й
     * голівки), опад (листя й гілочки). На знімку першого року пагорб
     * стояв ЛИСИЙ, і виглядало це як «трави замало», а не як помилка.
     *
     * Вік тут ні до чого — до кадру потрапляє чи ні та сама точка y=0,
     * бо кадр молодого дерева менший. Саме тому вада ховалась: доти
     * предмети лугу були втричі більші, і їхня початкова сфера частіше
     * зачіпала кадр.
     */
    mesh.computeBoundingSphere();
  }, [grassInstances]);

  useEffect(() => {
    const mesh = rocksRef.current;
    if (!mesh) return;
    const dummy = new THREE.Object3D();
    const dark = new THREE.Color(palette.stoneB);
    const light = new THREE.Color(palette.stoneA);
    const color = new THREE.Color();
    rockInstances.forEach((instance, index) => {
      dummy.position.set(instance.x, instance.y, instance.z);
      dummy.rotation.set(instance.rotationX, instance.rotationY, instance.rotationZ);
      dummy.scale.set(instance.scaleX, instance.scaleY, instance.scaleZ);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
      color.copy(dark).lerp(light, instance.tone);
      mesh.setColorAt(index, color);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [rockInstances, palette.stoneA, palette.stoneB]);

  const shadows = treeMeadowShadows(soilRadius, crownRadius);
  const skyRadius = Math.max(52, frame.distance + 30);


  return (
    <>
      <color attach="background" args={[palette.sky]} />
      {/*
        * ТУМАН МАЄ АДРЕСУ: далекий край лугу.
        *
        * Обрій був ТВЕРДОЮ ЛІНІЄЮ, і причина не в небі, а в геометрії:
        * горизонт у цьому кадрі — це буквально КРАЙ ТЕРЕНУ, коло радіусом
        * `hillRadius`, за яким одразу небо. Виміряно на знімку 1280×800:
        * над лінією яскравість 184, під нею 151 — тридцять три рівні
        * стрибком, а найбільший крок між сусідніми рядками 15.6.
        *
        * Старий туман до того краю не діставав: `far` стояв на
        * `distance + 32`, тобто 41 одиниця, а край лугу лежить на
        * `distance + hillRadius` — 17.3. Луг на обрії був затуманений на
        * 28% і кінчався ребром.
        *
        * Тепер `far` СТОЇТЬ НА ТОМУ КРАЮ, а колір туману дорівнює кольору
        * неба біля обрію (`skyMid` із `TreeEnvironmentTextures`). Отже луг
        * доходить до краю вже небом і ребра не лишає.
        *
        * Розгортка смуги (перепад через обрій / зеленість далини / середини):
        *
        *   без туману на краю      33 рівні / 27.7 / 30.4
        *   0.00..1.00 hillRadius   11 рівнів / 13.2 / 26.5
        *   0.40..1.00 hillRadius    2 рівні  / 13.2 / 26.9
        *   0.55..1.06 hillRadius    2 рівні  / 13.1 / 27.4
        *
        * Взято останнє: обрій уже м'який, а серпанок починається аж за
        * половиною лугу, тож середина кадру лишається зеленою, а не сивіє
        * одразу за деревом.
        */}
      <fog
        attach="fog"
        args={[palette.fog, frame.distance + hillRadius * 0.55, frame.distance + hillRadius * 1.06]}
      />

      <mesh frustumCulled={false}>
        {/*
          * 32×16 замість 48×24: 960 трикутників замість 2 208.
          *
          * Небо — це ТЕКСТУРА на сфері, тож щільність сітки не має стосунку
          * до плавності градієнта: вона впливає лише на те, наскільки
          * спотворяться UV біля полюсів. Камера дивиться майже в горизонт,
          * де спотворення найменше.
          */}
        <sphereGeometry args={[skyRadius, 32, 16]} />
        <meshBasicMaterial map={textures.sky} side={THREE.BackSide} depthWrite={false} fog={false} />
      </mesh>

      <ambientLight intensity={0.22} />
      <hemisphereLight args={[palette.skyLight, palette.groundLight, 1.05]} />
      <directionalLight position={[-7, 10, 5]} intensity={2.25} color={palette.sunLight} />
      <directionalLight position={[5, 4, -6]} intensity={0.3} color={palette.rim} />

      <mesh geometry={terrainGeometry} position={[0, groundY, 0]} receiveShadow>
        <meshStandardMaterial map={textures.ground} roughness={0.96} metalness={0} />
      </mesh>

      {/*
        * ДВІ ТІНІ, ОБИДВІ З М'ЯКИМ КРАЄМ. Тінь від контакту тримає дерево на
        * землі, тінь крони кладе на луг пляму від того, що над ним.
        *
        * Було: рівна непрозорість 0.10 і 0.04 на диску з різким краєм. На
        * ґрунті яскравістю 85 це різниця в кілька рівнів — виміряно, що
        * затемнення під деревом не було взагалі. Тепер спад радіальний
        * (`contactShadow`), а сила така, щоб її було видно числом, а не
        * тільки в коді.
        */}
      <mesh position={[metres(0.35), groundY + 0.018, metres(-0.18)]} rotation={[-Math.PI / 2, 0, 0]} scale={[shadows.rootScaleX, shadows.rootScaleZ, 1]}>
        <circleGeometry args={[1, 40]} />
        <meshBasicMaterial
          map={textures.contactShadow}
          color={palette.shadow}
          transparent
          opacity={0.55}
          depthWrite={false}
          polygonOffset
          polygonOffsetFactor={-1}
        />
      </mesh>
      <mesh position={[shadows.crownOffsetX, groundY + 0.014, shadows.crownOffsetZ]} rotation={[-Math.PI / 2, 0, -0.18]} scale={[shadows.crownScaleX, shadows.crownScaleZ, 1]}>
        <circleGeometry args={[1, 48]} />
        <meshBasicMaterial
          map={textures.contactShadow}
          color={palette.shadow}
          transparent
          opacity={0.3}
          depthWrite={false}
          polygonOffset
          polygonOffsetFactor={-1}
        />
      </mesh>

      <instancedMesh ref={grassRef} args={[undefined, undefined, grassInstances.length]} geometry={grassGeometry}>
        {/*
          * Ламберт, а не `basic`: трава стояла НЕОСВІТЛЕНА на освітленій
          * землі й через це читалась наліпкою — пласкими темними шпичаками,
          * що не належать сцені. Помітно це стало аж тоді, коли землю
          * полагодили: доти обидві були однаково темні, і різниці не було
          * видно.
          *
          * Ламберт дорожчий за `basic` рівно на розсіяне світло — ні
          * дзеркального відблиску, ні шорсткості тут не треба, бо трава
          * матова.
          */}
        <meshLambertMaterial
          map={textures.grassBlade}
          color="#ffffff"
          side={THREE.FrontSide}
          transparent
          alphaTest={0.16}
          depthWrite
        />
      </instancedMesh>

      <instancedMesh ref={rocksRef} args={[undefined, undefined, rockInstances.length]}>
        <icosahedronGeometry args={[1, 0]} />
        <meshStandardMaterial color="#ffffff" roughness={0.94} metalness={0} />
      </instancedMesh>

      {/*
        * ТУТ СТОЯЛИ ТРИ ПАГОРБИ Й СОНЦЕ — 1 678 трикутників, яких більше
        * НЕ ВИДНО.
        *
        * Пагорби сиділи на 19.9, 26.2 і 33.7 одиниці від камери, сонце на
        * 29.1, а туман тепер насичується на 17.3 — на далекому краї лугу.
        * Отже всі шість тіл малювались рівно кольором туману, тобто кольором
        * неба. Перевірено попіксельним порівнянням знімків із ними й без них
        * (`npm run live:diff`): різниця нижча за власний шум сцени.
        *
        * Сонце до того ж СПЕРЕЧАЛОСЬ зі світлом: диск стояв ліворуч-ЗА
        * деревом (-9.5, 8.5, -17), а промінь, що ліпить форму, йде
        * ліворуч-ПЕРЕД ним (-7, 10, 5). Тінь на лузі падала від променя, і
        * намальоване сонце їй суперечило. Прибрано те, що суперечило й було
        * невидиме, а не пересунуто те, що працює.
        */}

      <PortalCameraRig frame={frame} controls={controls} pose={pose} mode={motionMode} />
      {children}
      <OrbitControls
        ref={controls}
        enablePan={false}
        enableZoom={false}
        enableRotate={allowOrbit}
        enableDamping={!reduceMotion}
        dampingFactor={0.08}
        minPolarAngle={Math.PI * 0.2}
        maxPolarAngle={Math.PI * 0.48}
      />
    </>
  );
}
