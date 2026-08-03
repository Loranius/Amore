import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { CRYSTAL_GROUND_BASELINE } from '@/engine/renderer/three';
import {
  PORTAL_DAIS_TOP_RADIUS,
  PORTAL_ENVIRONMENT_DRAW_CALLS,
  PORTAL_ENVIRONMENT_TRIANGLES,
  PORTAL_FIELD_DROP,
  PORTAL_GROUND_Y,
  PORTAL_PILLARS,
  buildPortalDaisGeometry,
  buildPortalInlayGeometry,
  buildPortalPillarGeometry,
  buildPortalStarField,
  measurePortalEnvironmentTriangles,
  PORTAL_INLAY_CLEARANCE,
  portalCameraFrame,
  portalCrackAngles,
  portalDaisScale,
  portalSlabSurfaceY,
  portalHalfWidthAt,
  portalPillarInstances,
} from './portalScene';

/** Насіння артефакта для сцени; будь-яке стале підійде. */
const SEED = 4242;

/** Аспекти реальних кадрів: вузький телефон, Pixel 8 Pro, планшет, ноутбук. */
const ASPECTS = [0.42, 0.46, 0.62, 0.75, 1.33, 1.9];

/**
 * Виміряно на справжньому пайплайні через `crystalSceneRadius` — в
 * одиницях сцени, тобто вже після fit-масштабу рендерера:
 *
 * | вік | кристали | камінь | висота |
 * |---|---:|---:|---:|
 * | 1 рік | 0.88 | 1.26 | 1.91 |
 * | 4 роки | 1.00 | 1.49 | 2.50 |
 * | 10 років | 1.42 | 2.39 | 3.19 |
 * | 20 років | 1.50 | 2.50 | 2.71 |
 *
 * Попередні константи (радіус 0.68) були зняті ще до ADR-0004 і
 * занижували ширину друзи більш ніж удвічі, тож перевірка «артефакт
 * влазить у кадр» проходила на числі, якого артефакт ніколи не мав.
 *
 * Кадр мусить вміщати кристали. Камінь і подіум — підлога: їм дозволено
 * виходити за край, і саме тому в таблиці два різні радіуси.
 */
const WIDEST_CRYSTAL_RADIUS = 1.5;
const WIDEST_ROCK_RADIUS = 2.5;
const TALLEST_ARTIFACT_HEIGHT = 3.19;

describe('portal camera frame', () => {
  it('stands on the same plane the renderer puts the artifact on', () => {
    // Подіум узгоджений із fit-трансформом рендерера через один експорт.
    // Розійдуться — і кристал або зависне над каменем, або втопиться в ньому.
    expect(PORTAL_GROUND_Y).toBe(CRYSTAL_GROUND_BASELINE);
  });

  it('keeps every crystal inside the frame at every real aspect and age', () => {
    for (const aspect of ASPECTS) {
      for (const radius of [0, 0.88, 1.0, 1.42, WIDEST_CRYSTAL_RADIUS]) {
        const frame = portalCameraFrame(aspect, radius);
        expect(portalHalfWidthAt(frame.distance, aspect)).toBeGreaterThan(radius);
      }
    }
  });

  it('only ever backs the camera off, never pulls it in', () => {
    // Кадр без артефакта — це нижня межа. Якби більший артефакт міг
    // *наблизити* камеру, зростання читалось би задом наперед.
    for (const aspect of ASPECTS) {
      const base = portalCameraFrame(aspect).distance;
      let previous = base;
      for (const radius of [0.5, 0.88, 1.0, 1.42, 1.5, 3]) {
        const distance = portalCameraFrame(aspect, radius).distance;
        expect(distance).toBeGreaterThanOrEqual(previous - 1e-9);
        expect(distance).toBeGreaterThanOrEqual(base - 1e-9);
        previous = distance;
      }
    }
  });

  it('survives a degenerate artifact radius', () => {
    for (const radius of [Number.NaN, Number.POSITIVE_INFINITY, -5]) {
      const frame = portalCameraFrame(0.46, radius);
      expect(frame.position.every(Number.isFinite)).toBe(true);
      expect(frame.distance).toBe(portalCameraFrame(0.46).distance);
    }
  });

  it('keeps the whole artifact inside the frame at every real aspect', () => {
    for (const aspect of ASPECTS) {
      const frame = portalCameraFrame(aspect, WIDEST_CRYSTAL_RADIUS);
      const halfHeight = frame.distance * Math.tan((frame.fov / 2) * (Math.PI / 180));
      const halfWidth = portalHalfWidthAt(frame.distance, aspect);

      expect(halfWidth).toBeGreaterThan(WIDEST_CRYSTAL_RADIUS);
      // Артефакт стоїть на землі, тож по висоті його тримає не половина
      // кадру, а відрізок від нижнього краю до верхівки.
      const frameTop = frame.target[1] + halfHeight;
      expect(frameTop).toBeGreaterThan(PORTAL_GROUND_Y + TALLEST_ARTIFACT_HEIGHT);
      const frameBottom = frame.target[1] - halfHeight;
      expect(frameBottom).toBeLessThan(PORTAL_GROUND_Y);
    }
  });

  it('backs off on narrow screens instead of cropping the scene', () => {
    // Кадр по висоті фіксований; ширину рятує тільки відхід камери.
    const narrow = portalCameraFrame(0.4);
    const wide = portalCameraFrame(1.6);
    expect(narrow.distance).toBeGreaterThan(wide.distance);
  });

  it('looks down at the platform rather than along it', () => {
    const frame = portalCameraFrame(0.46);
    const elevation = frame.position[1] - PORTAL_GROUND_Y;
    expect(elevation).toBeGreaterThan(0);
    const grazing = Math.atan(elevation / frame.position[2]) * (180 / Math.PI);
    // Надто полого — підлога вироджується в лінію; надто згори — сцена
    // перетворюється на макет, у якому не видно ні неба, ні колон.
    expect(grazing).toBeGreaterThan(10);
    expect(grazing).toBeLessThan(28);
  });

  it('survives a degenerate aspect without producing a broken camera', () => {
    for (const aspect of [0, Number.NaN, Number.POSITIVE_INFINITY, -3]) {
      const frame = portalCameraFrame(aspect);
      expect(frame.position.every(Number.isFinite)).toBe(true);
      expect(Number.isFinite(frame.distance)).toBe(true);
      expect(frame.distance).toBeGreaterThan(0);
    }
  });

  it('starts fog behind the artifact, not on it', () => {
    for (const aspect of ASPECTS) {
      const frame = portalCameraFrame(aspect);
      expect(frame.fogNear).toBeGreaterThan(frame.distance - WIDEST_CRYSTAL_RADIUS * 2);
      expect(frame.fogFar).toBeGreaterThan(frame.fogNear);
    }
  });
});

describe('portal pillars', () => {
  it('stays at the frame edge on every aspect instead of drifting inward', () => {
    // Це і є причина рахувати x із кадру: прибиті координати, підібрані на
    // телефоні, на ноутбуці опинились би впритул до кристала.
    for (const aspect of ASPECTS) {
      // Разом із найширшою друзою: колони мусять відійти разом із камерою,
      // інакше найстарша пара отримала б колону впритул до кристала.
      const frame = portalCameraFrame(aspect, WIDEST_CRYSTAL_RADIUS);
      const instances = portalPillarInstances(frame, aspect);
      expect(instances).toHaveLength(PORTAL_PILLARS.length * 2);

      for (let index = 0; index < instances.length; index += 1) {
        const instance = instances[index]!;
        const placement = PORTAL_PILLARS[Math.floor(index / 2)]!;
        const depth = frame.distance - placement.z;
        const halfWidth = portalHalfWidthAt(depth, aspect);
        // edgeFraction places the pillar's inner *face*, not its axis — the
        // difference is negligible far away and decides the whole frame up
        // close, where the radius is comparable to the frame half-width.
        const inner = (Math.abs(instance.position[0]) - placement.radius) / halfWidth;

        expect(inner).toBeCloseTo(placement.edgeFraction, 6);
        // Whether a pillar clears the artifact is a screen-space question and
        // lives in its own test. Comparing world-space |x| against the
        // artifact's radius, as this line used to, compares two distances at
        // different depths — it only ever agreed with the truth because every
        // pillar sat behind the crystal.
      }
    }
  });

  it('mirrors each pair across the axis and stands it on the field', () => {
    const frame = portalCameraFrame(0.46);
    const instances = portalPillarInstances(frame, 0.46);
    for (let index = 0; index < instances.length; index += 2) {
      const left = instances[index]!;
      const right = instances[index + 1]!;
      expect(left.position[0]).toBeCloseTo(-right.position[0], 9);
      expect(left.position[2]).toBe(right.position[2]);
      expect(left.position[1]).toBeCloseTo(PORTAL_GROUND_Y - PORTAL_FIELD_DROP, 9);
    }
  });

  it('never lets a pillar stand in front of the druse', () => {
    // Was `z < -daisTopRadius` for every pillar, which held only while the
    // whole colonnade stood behind the artifact. A sanctuary has a near side
    // too, so the real rule is stated instead: a pillar may occlude nothing
    // either because it is behind the artifact, or because it projects clear
    // of it on screen.
    //
    // Screen fraction of a pillar is exactly its edgeFraction, by construction
    // — that is what edgeFraction means. The artifact's screen fraction is its
    // radius over the frame half-width, and the camera guarantees a margin
    // (FRAME_MARGIN), so anything at or beyond 1.0 is clear of it at every
    // aspect and every age.
    for (const aspect of ASPECTS) {
      const frame = portalCameraFrame(aspect, WIDEST_CRYSTAL_RADIUS);
      const artifactFraction = WIDEST_CRYSTAL_RADIUS / portalHalfWidthAt(frame.distance, aspect);

      for (const placement of PORTAL_PILLARS) {
        const behind = placement.z < -PORTAL_DAIS_TOP_RADIUS;
        const clearOnScreen = placement.edgeFraction > artifactFraction;
        expect(behind || clearOnScreen, `z=${placement.z}`).toBe(true);
      }
    }
  });

  it('closes the hall on the near side', () => {
    // The crystal used to stand in front of the colonnade, like a prop before
    // a backdrop. A sanctuary is a room: something has to be nearer than the
    // artifact, or the viewer is outside looking in.
    expect(PORTAL_PILLARS.some((placement) => placement.z > 0)).toBe(true);
    expect(PORTAL_PILLARS.some((placement) => placement.z < 0)).toBe(true);
  });

  it('measures depth from the camera rather than from the axis', () => {
    // `frame.distance + Math.abs(z)` matches the correct formula exactly for
    // pillars behind the artifact, which is why it survived. For one in front
    // it returns a larger depth instead of a smaller one, and the pillar drifts
    // toward the centre of the frame — straight across the crystal.
    const frame = portalCameraFrame(0.46, 1);
    const instances = portalPillarInstances(frame, 0.46);
    const front = PORTAL_PILLARS.findIndex((placement) => placement.z > 0);

    expect(front).toBeGreaterThanOrEqual(0);
    const near = instances[front * 2]!;
    const placement = PORTAL_PILLARS[front]!;
    const at = (depth: number): number =>
      portalHalfWidthAt(depth, 0.46) * placement.edgeFraction + placement.radius;
    const correct = at(frame.distance - placement.z);
    const mirrored = at(frame.distance + placement.z);

    expect(Math.abs(near.position[0])).toBeCloseTo(correct, 6);
    expect(correct).toBeLessThan(mirrored);
  });
});

describe('portal geometry', () => {
  it('caps the dais exactly on the artifact ground plane', () => {
    // Верхня площина подіуму — контракт із субстратом кристала: він
    // заглиблений приблизно на 0.14 і розрахований на те, що камінь його
    // накриває, а не що він стирчить із порожнечі.
    const geometry = buildPortalDaisGeometry();
    geometry.computeBoundingBox();
    const bounds = geometry.boundingBox!;

    expect(bounds.max.y).toBeCloseTo(0, 9);
    expect(bounds.min.y).toBeLessThan(-PORTAL_FIELD_DROP);
    expect(bounds.max.x).toBeGreaterThan(PORTAL_DAIS_TOP_RADIUS);
    geometry.dispose();
  });

  it('grows the dais top to stay wider than the rock it carries', () => {
    // Це і є причина, з якої подіум перестав бути константою: камінь
    // розростається з місцями, де пара була (ADR-0004), а плита — ні, тож
    // друза вилазила за обвід і ховала інкрустацію під собою.
    for (const rock of [0.9, 1.1, 1.315, 1.6, 2.0]) {
      const top = PORTAL_DAIS_TOP_RADIUS * portalDaisScale(rock);
      expect(top).toBeGreaterThan(rock);
      // Інкрустація лежить на 1.19 з 1.3 — вона мусить лишатись видимою.
      expect(top * (1.19 / 1.3)).toBeGreaterThan(rock);
    }
  });

  it('never shrinks the dais below the designed scene', () => {
    for (const rock of [0, 0.2, 0.9, Number.NaN, -4, Number.POSITIVE_INFINITY]) {
      const scale = portalDaisScale(rock);
      expect(Number.isFinite(scale)).toBe(true);
      expect(scale).toBeGreaterThanOrEqual(1);
    }
  });

  it('stops the dais before it reaches the pillars', () => {
    // Стеля DAIS_MAX_SCALE існує рівно заради цього: колони стоять на полі,
    // і плита, що доросла до них, проткнулась би їхніми цоколями.
    const maxScale = portalDaisScale(Number.MAX_SAFE_INTEGER);
    // Радіус подіуму на висоті, де стоять колони.
    const daisAtPillarHeight = 1.66 * maxScale;
    for (const aspect of ASPECTS) {
      const frame = portalCameraFrame(aspect);
      for (const instance of portalPillarInstances(frame, aspect)) {
        const axisDistance = Math.hypot(instance.position[0], instance.position[2]);
        expect(axisDistance).toBeGreaterThan(daisAtPillarHeight);
      }
    }
  });

  it('carries the widest rock the pipeline produces, or says where it stops', () => {
    // Чесна межа, а не обіцянка: на дуже старій друзі стеля з'їдає запас.
    const top = PORTAL_DAIS_TOP_RADIUS * portalDaisScale(WIDEST_ROCK_RADIUS);
    expect(top).toBeGreaterThan(WIDEST_ROCK_RADIUS * 0.9);
  });

  it('merges the inlay and the pillar into one buffer each', () => {
    // Бюджет draw call'ів у приймальному тесті рахує саме це: інкрустація
    // з двох кілець і колона з трьох частин мусять лишитись одним мешем.
    const inlay = buildPortalInlayGeometry(1);
    const pillar = buildPortalPillarGeometry();

    expect(inlay.groups.length).toBeLessThanOrEqual(1);
    expect(pillar.groups.length).toBeLessThanOrEqual(1);
    expect(inlay.getAttribute('position').count).toBeGreaterThan(0);
    expect(pillar.getAttribute('position').count).toBeGreaterThan(0);

    inlay.computeBoundingBox();
    // Кільця більше не пласкі: вони повторюють вигин плити. Але вигин лишається
    // вигином, а не стінкою — по вертикалі вони мусять бути на порядок нижчі
    // за власну ширину.
    const inlayHeight = inlay.boundingBox!.max.y - inlay.boundingBox!.min.y;
    expect(inlayHeight).toBeGreaterThan(0);
    expect(inlayHeight).toBeLessThan(0.2);

    pillar.computeBoundingBox();
    // Базова колона нормалізована: висота 1, радіус 1 — інакше scale в
    // InstancedMesh означав би не те, що написано в PORTAL_PILLARS.
    expect(pillar.boundingBox!.min.y).toBeCloseTo(0, 6);
    expect(pillar.boundingBox!.max.y).toBeCloseTo(1, 2);
    expect(pillar.boundingBox!.max.x).toBeLessThanOrEqual(1.01);

    inlay.dispose();
    pillar.dispose();
  });

  it('never buries the inlay in the slab it is set into', () => {
    // This has now bitten twice. First the heaved rim covered the gold by the
    // arc and drew it as a dashed line; then the plate started bowing along the
    // cracks and covered it outright, because the inlay was a flat ring at a
    // constant height. Gold set into stone has to follow the stone.
    const inlay = buildPortalInlayGeometry(SEED);
    const position = inlay.getAttribute('position');

    for (let index = 0; index < position.count; index += 1) {
      const x = position.getX(index);
      const y = position.getY(index);
      const z = position.getZ(index);
      const angle = Math.atan2(x, z);
      const radius = Math.hypot(x, z);
      const stone = portalSlabSurfaceY(angle, radius, SEED);

      expect(y).toBeGreaterThan(stone);
      // And it is inlaid, not floating: the clearance is a hair, not a gap.
      expect(y - stone).toBeCloseTo(PORTAL_INLAY_CLEARANCE, 5);
    }

    inlay.dispose();
  });

  it('bows the plate where it cracked, and nowhere else', () => {
    // The plate is not merely split — something pushed it up from below, and
    // the push is strongest along the cracks. Between them the stone has to
    // stay flat, or the bows merge into a dome and the fracture stops reading
    // as a fracture.
    const cracks = portalCrackAngles(SEED);
    const onCrack = portalSlabSurfaceY(cracks[0]!, 1.1, SEED);

    // Furthest point from any crack, sampled coarsely.
    let flattest = Number.POSITIVE_INFINITY;
    for (let step = 0; step < 360; step += 1) {
      const angle = (step / 360) * Math.PI * 2;
      flattest = Math.min(flattest, portalSlabSurfaceY(angle, 1.1, SEED));
    }

    expect(onCrack).toBeGreaterThan(flattest);
    // The bow fades outward: the force came from the middle.
    expect(portalSlabSurfaceY(cracks[0]!, 1.26, SEED))
      .toBeLessThan(portalSlabSurfaceY(cracks[0]!, 1.06, SEED));
  });

  it('accounts for every object the environment draws', () => {
    // Поле, подіум, ритуальна плита, тріщини, інкрустація, колони (один
    // InstancedMesh на всі три пари) і зорі.
    expect(PORTAL_ENVIRONMENT_DRAW_CALLS).toBe(7);
  });

  it('costs the same for every couple', () => {
    // The slab's fracture and the cracks are seeded per artifact, so their
    // shape differs between couples — but the triangle budget is a constant
    // the acceptance test subtracts, and a count that moved with the seed
    // would make it a lie for everyone but the couple it was measured on.
    const counts = [1, 77, 4242, 999_999].map((seed) => measurePortalEnvironmentTriangles(seed));
    expect(new Set(counts).size).toBe(1);
  });
});

describe('portal star field', () => {
  it('is deterministic for the same couple and different across couples', () => {
    const first = buildPortalStarField(1234, 64);
    const again = buildPortalStarField(1234, 64);
    const other = buildPortalStarField(4321, 64);

    expect(Array.from(first.positions)).toEqual(Array.from(again.positions));
    expect(Array.from(first.positions)).not.toEqual(Array.from(other.positions));
  });

  it('puts every star above the horizon and off the artifact', () => {
    const field = buildPortalStarField(99, 400);
    const vector = new THREE.Vector3();
    for (let index = 0; index < field.count; index += 1) {
      vector.fromArray(field.positions, index * 3);
      expect(Number.isFinite(vector.x)).toBe(true);
      // Нижче горизонту зорі опинились би під підлогою — крізь неї їх не
      // видно, і поле витратило б на них половину точок.
      expect(vector.y).toBeGreaterThan(0);
      // Далеко за колонами й туманом: зоря поруч із кристалом читалась би
      // як частинка, а не як небо.
      expect(vector.length()).toBeGreaterThan(20);
    }
  });

  it('spreads brightness instead of drawing every star the same', () => {
    const field = buildPortalStarField(7, 300);
    let min = Number.POSITIVE_INFINITY;
    let max = Number.NEGATIVE_INFINITY;
    for (let index = 0; index < field.count; index += 1) {
      const red = field.colors[index * 3]!;
      min = Math.min(min, red);
      max = Math.max(max, red);
    }
    expect(min).toBeGreaterThan(0);
    expect(max - min).toBeGreaterThan(0.5);
  });
});

describe('portal environment cost', () => {
  it('publishes the triangle count it actually draws', () => {
    // Приймальний тест віднімає це число від намальованих трикутників, щоб
    // звірити решту з бюджетом геометрії кристала. Розійдеться з реальними
    // буферами — і перевірка бюджету почне брехати.
    expect(PORTAL_ENVIRONMENT_TRIANGLES).toBe(measurePortalEnvironmentTriangles());
  });
});
