import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { CRYSTAL_GROUND_BASELINE } from '@/engine/renderer/three';
import {
  PORTAL_DAIS_TOP_RADIUS,
  PORTAL_ENVIRONMENT_DRAW_CALLS,
  PORTAL_ENVIRONMENT_TRIANGLES,
  PORTAL_FIELD_DROP,
  PORTAL_GROUND_Y,
  PORTAL_COLONNADE_COUNT,
  PORTAL_COLONNADE_RADIUS,
  buildPortalDaisGeometry,
  buildPortalInlayGeometry,
  buildPortalRitualSlabGeometry,
  buildPortalPillarGeometry,
  buildPortalStarField,
  measurePortalEnvironmentTriangles,
  portalArchInstances,
  PORTAL_INLAY_CLEARANCE,
  portalCameraFrame,
  portalCrackAngles,
  portalDaisScale,
  portalSlabSurfaceY,
  portalHalfWidthAt,
  portalLampInstances,
  portalPillarInstances,
  PORTAL_LAMP_LIGHT_COUNT,
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
  it('stands as a ring around the podium rather than two rows at the frame edge', () => {
    // The rows were a layout keyed on the *screen*: the pillars slid with
    // aspect to hold its edges, and on a wide monitor they slid so far apart
    // that no hall was left between them — two posts either side. A ring has
    // its own shape and the frame merely crops it, which is how the reference
    // hall is built and the whole reason this was rewritten.
    for (const aspect of ASPECTS) {
      const frame = portalCameraFrame(aspect, WIDEST_CRYSTAL_RADIUS);
      const pillars = portalPillarInstances(frame, aspect);
      expect(pillars.length).toBeGreaterThan(4);
      for (const pillar of pillars) {
        const radius = Math.hypot(pillar.position[0], pillar.position[2]);
        expect(radius).toBeCloseTo(PORTAL_COLONNADE_RADIUS, 6);
        expect(pillar.position[1]).toBeCloseTo(PORTAL_GROUND_Y - PORTAL_FIELD_DROP, 6);
      }
    }
  });

  it('does not move with the aspect at all', () => {
    // The point of the ring: the colonnade is a thing in the world, not a
    // decoration fitted to the window. Two very different windows must see the
    // same hall from the same place.
    const narrow = portalCameraFrame(0.45, WIDEST_CRYSTAL_RADIUS);
    const wide = portalCameraFrame(1.6, WIDEST_CRYSTAL_RADIUS);

    expect(portalPillarInstances(narrow, 0.45)).toEqual(portalPillarInstances(wide, 1.6));
  });

  it('runs the whole way round, one unbroken row', () => {
    // Arch after arch, all the circle. One row and one only — nothing stacked
    // on the columns and nothing above the arcade.
    const frame = portalCameraFrame(0.45, WIDEST_CRYSTAL_RADIUS);
    const pillars = portalPillarInstances(frame, 0.45);
    expect(pillars).toHaveLength(PORTAL_COLONNADE_COUNT);

    const step = (Math.PI * 2) / PORTAL_COLONNADE_COUNT;
    const azimuths = pillars
      .map((pillar) => Math.atan2(pillar.position[0], pillar.position[2]))
      .map((angle) => (angle + Math.PI * 2) % (Math.PI * 2))
      .sort((left, right) => left - right);
    for (let index = 0; index < azimuths.length; index += 1) {
      const gap = ((azimuths[(index + 1) % azimuths.length]! - azimuths[index]!) + Math.PI * 2)
        % (Math.PI * 2);
      expect(gap).toBeCloseTo(step, 6);
    }
    // Every column stands on the same course: one row, one height.
    const heights = new Set(pillars.map((pillar) => pillar.scale[1]));
    expect(heights.size).toBe(1);
  });

  it('never lets a pillar stand in front of the druse', () => {
    // Kept from the row layout, because the property is the same one however
    // the colonnade is arranged: a pillar whose screen projection overlaps the
    // artifact stops framing it and starts hiding it.
    for (const aspect of ASPECTS) {
      const frame = portalCameraFrame(aspect, WIDEST_CRYSTAL_RADIUS);
      for (const pillar of portalPillarInstances(frame, aspect)) {
        if (pillar.position[2] <= 0) continue;
        const depth = frame.distance - pillar.position[2];
        if (depth <= 0.1) continue;
        const inner = Math.abs(pillar.position[0]) - pillar.scale[0];
        const artifactHalfWidth = WIDEST_CRYSTAL_RADIUS * (depth / frame.distance);
        expect(inner).toBeGreaterThan(artifactHalfWidth);
      }
    }
  });
});

describe('portal geometry', () => {
  it('puts the platform`s stone surface exactly on the artifact ground plane', () => {
    // The bug this exists for, and it shipped: the dais capped at 0 and the
    // stone slab was then stacked *on top* of it, so the surface the crystals
    // supposedly grow out of stood 0.075 above the plane the engine actually
    // stands them on. Measured in scene units, the quartz vein rises 0.024
    // above that plane — so the seam was 0.05 under the stone and invisible
    // from every angle, and every crystal met the platform 0.075 up its own
    // shaft. The dais is recessed by the slab's thickness now; the slab's top
    // face is the contract.
    const dais = buildPortalDaisGeometry();
    const slab = buildPortalRitualSlabGeometry(SEED);
    dais.computeBoundingBox();
    slab.computeBoundingBox();

    // The stone the eye sees is the slab. Its surface *at the seam* is the
    // plane — outside the seam it bows up, which is the whole point of the
    // bow, so the bounding box is not what carries this.
    expect(portalSlabSurfaceY(0, 0, SEED, [0.4, 2.1], 0.4)).toBeCloseTo(0, 9);
    // Float32 in the buffer attribute, hence 6 places rather than 9.
    expect(slab.boundingBox!.min.y).toBeCloseTo(-0.075, 6);
    // The dais is below it by exactly one slab, so there is neither a gap nor
    // an overlap between the two.
    expect(dais.boundingBox!.max.y).toBeCloseTo(slab.boundingBox!.min.y, 6);
    expect(dais.boundingBox!.min.y).toBeLessThan(-PORTAL_FIELD_DROP);
    expect(dais.boundingBox!.max.x).toBeGreaterThan(PORTAL_DAIS_TOP_RADIUS);

    dais.dispose();
    slab.dispose();
  });

  it('leaves the stone flat wherever the quartz vein runs under it', () => {
    // The other half of the same bug. Even with the slab on the right plane,
    // a bow that starts at the axis rises over the vein and hides it: the
    // stone reached 0.118 while the vein topped out at 0.048. The bow has to
    // begin outside the seam's own footprint, whatever that footprint is for
    // this couple.
    const bearings = [0.4, 2.1, 4.7];
    for (const reach of [0.2, 0.45, 0.8]) {
      for (let step = 0; step < 48; step += 1) {
        const angle = (step / 48) * Math.PI * 2;
        for (const radius of [0, reach * 0.5, reach * 0.99]) {
          expect(portalSlabSurfaceY(angle, radius, SEED, bearings, reach)).toBeCloseTo(0, 9);
        }
      }
      // ...and it does still bow, outside the seam.
      let highest = 0;
      for (let step = 0; step < 48; step += 1) {
        highest = Math.max(highest, portalSlabSurfaceY(
          (step / 48) * Math.PI * 2,
          reach + (1.27 - reach) * 0.4,
          SEED,
          bearings,
          reach,
        ));
      }
      expect(highest).toBeGreaterThan(0);
    }
  });

  it('grows the dais top to stay wider than the rock it carries', () => {
    // Це і є причина, з якої подіум перестав бути константою: камінь
    // розростається з місцями, де пара була (ADR-0004), а плита — ні, тож
    // друза вилазила за обвід і ховала інкрустацію під собою.
    // Up to the ceiling only. Past it the podium stops growing on purpose —
    // the front pillars stand on the field and a plinth that reached them
    // would be pierced by their bases — and the next test states what happens
    // there instead of pretending it does not.
    const carried = PORTAL_DAIS_TOP_RADIUS * portalDaisScale(Number.MAX_SAFE_INTEGER) / 1.34;
    for (const rock of [0.9, 1.1, 1.315, carried * 0.99]) {
      const top = PORTAL_DAIS_TOP_RADIUS * portalDaisScale(rock);
      expect(top).toBeGreaterThan(rock);
      // Найзовнішнє золоте кільце лежить на 1.235 з 1.3 — воно мусить
      // лишатись видимим.
      expect(top * (1.235 / 1.3)).toBeGreaterThan(rock);
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

  it('says where it stops carrying the rock', () => {
    // The bound used to be an honest apology: the ceiling bit at roughly a
    // fifteen-year druse and the rock reached the rim, accepted because the
    // alternative was a plinth grown out to the pillars and pierced by their
    // bases. That constraint is gone — the colonnade is a ring several podium
    // widths out — so the ceiling could be lifted, and the widest druse the
    // pipeline produces is now carried with room to spare.
    //
    // It still exists, because a podium that grows without limit stops being a
    // podium and becomes the floor.
    const carried = PORTAL_DAIS_TOP_RADIUS * portalDaisScale(Number.MAX_SAFE_INTEGER);

    expect(carried).toBeGreaterThan(WIDEST_ROCK_RADIUS);
    expect(PORTAL_DAIS_TOP_RADIUS * portalDaisScale(WIDEST_ROCK_RADIUS))
      .toBeGreaterThan(WIDEST_ROCK_RADIUS);
    // And well inside the colonnade, which is the thing it must not reach.
    expect(carried).toBeLessThan(PORTAL_COLONNADE_RADIUS * 0.6);
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

  it('follows the quartz vein rather than opening its own cracks', () => {
    // "Існуючі зовнішні тріщини мають стати стриманим продовженням жили, а не
    // другою системою розломів." The platform used to bow in nine directions of
    // its own, seeded independently of the artifact — two unrelated fracture
    // systems on one podium. Given the vein's branch bearings it takes them
    // instead, and takes no more of them than the vein has main branches.
    const bearings = [0.4, 2.1, 4.7, 5.9, 6.2];
    const followed = portalCrackAngles(SEED, bearings);

    expect(followed.length).toBeLessThanOrEqual(3);
    for (const angle of followed) expect(bearings).toContain(angle);
    // The stone really is higher over a branch than between branches.
    const overBranch = portalSlabSurfaceY(followed[0]!, 0.5, SEED, bearings);
    let between = Number.POSITIVE_INFINITY;
    for (let step = 0; step < 360; step += 1) {
      between = Math.min(
        between,
        portalSlabSurfaceY((step / 360) * Math.PI * 2, 0.5, SEED, bearings),
      );
    }
    expect(overBranch).toBeGreaterThan(between);

    // No bearings — an older persisted profile — still gets a restrained bow
    // rather than a flat plate.
    expect(portalCrackAngles(SEED).length).toBe(3);
  });

  it('keeps one continuous top surface with no hole under the druse', () => {
    // The ritual slab was an annulus: inside its broken inner rim the surface
    // dropped a plate-thickness to the bare dais, and the crystals stood in a
    // circular pit. Visual review (2026-08-03) rejected it — the crystals grow
    // straight out of the stone now, through the quartz vein, and the only
    // fracture in the platform is that vein.
    const bearings = [0.4, 2.1, 4.7];
    const slab = buildPortalRitualSlabGeometry(SEED, bearings);
    const position = slab.getAttribute('position');

    // Every vertex is either on the top surface — at the artifact's ground
    // plane or bowed above it — or on the floor of the podium's recess. There
    // is no intermediate height for a pit or a step to live at.
    let reachedAxis = false;
    for (let index = 0; index < position.count; index += 1) {
      const y = position.getY(index);
      const radius = Math.hypot(position.getX(index), position.getZ(index));
      if (radius < 1e-6) reachedAxis = true;
      const onFloor = Math.abs(y + 0.075) < 1e-6;
      if (onFloor) continue;
      expect(y).toBeGreaterThanOrEqual(-1e-6);
    }
    // ...and the surface is genuinely closed to the axis, not merely deep.
    expect(reachedAxis).toBe(true);

    // The centre is flat: the bow is a ridge that rises past the seam, so the
    // axis — where every segment meets — cannot be a peak of differing slopes.
    const axis = portalSlabSurfaceY(0, 0, SEED, bearings);
    expect(axis).toBeCloseTo(0, 9);
    for (let step = 0; step < 32; step += 1) {
      expect(portalSlabSurfaceY((step / 32) * Math.PI * 2, 0, SEED, bearings))
        .toBeCloseTo(axis, 9);
    }

    slab.dispose();
  });

  it('accounts for every object the environment draws', () => {
    // Поле, підлога храму, подіум, колони (один InstancedMesh на все кільце),
    // вогні на них (так само один), арки (так само один) і зорі.
    expect(PORTAL_ENVIRONMENT_DRAW_CALLS).toBe(7);
  });

  it('lights the crystal from the colonnade without lighting the whole field', () => {
    // Вогонь горить на кожній колоні — геометрія майже безкоштовна, — але
    // справжнє джерело світла запалює лише передня пара: кожен point light
    // коштує роботи в кожному фрагменті кожного матеріалу сцени.
    for (const aspect of ASPECTS) {
      const frame = portalCameraFrame(aspect, WIDEST_CRYSTAL_RADIUS);
      const lamps = portalLampInstances(frame, aspect);
      const pillars = portalPillarInstances(frame, aspect);

      expect(lamps).toHaveLength(pillars.length);
      expect(lamps.filter((lamp) => lamp.lit)).toHaveLength(PORTAL_LAMP_LIGHT_COUNT);

      for (let index = 0; index < lamps.length; index += 1) {
        const lamp = lamps[index]!;
        const pillar = pillars[index]!;
        // Вогонь стоїть на своїй колоні, під капітеллю, і винесений **усередину
        // кільця** — до кристала, а не назовні від нього. «Вліво/вправо» мало
        // сенс, поки колони стояли двома рядами; на кільці внутрішнє — це до
        // осі, тобто на меншому радіусі.
        expect(lamp.position[1]).toBeGreaterThan(pillar.position[1]);
        expect(lamp.position[1]).toBeLessThan(pillar.position[1] + pillar.scale[1]);
        expect(Math.hypot(lamp.position[0], lamp.position[2]))
          .toBeLessThan(Math.hypot(pillar.position[0], pillar.position[2]));
      }

      // Запалені — ті, що стоять по краях розриву аркади, тобто найближчі до
      // глядача: саме з того боку на кристал і дивляться. Задній підсвіт у
      // сцені вже є від directionalLight.
      const lit = lamps.filter((lamp) => lamp.lit);
      const azimuthOf = (lamp: typeof lit[number]): number =>
        Math.abs(Math.atan2(lamp.position[0], lamp.position[2]));
      const widestLit = Math.max(...lit.map(azimuthOf));
      for (const lamp of lamps) {
        if (lamp.lit) continue;
        expect(azimuthOf(lamp)).toBeGreaterThan(widestLit - 1e-9);
      }
    }
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

describe('portal arches', () => {
  /**
   * Арки взято з референсної зали (Sketchfab «Cloud palace column Hall»): саме
   * вони перетворюють колони на **залу**, а не на набір стовпів, і кадрують
   * небо у високі прорізи, що ведуть око вниз до подіуму. Реалізація власна —
   * ассет не завантажується й позначений автором як AI-restricted.
   */
  it('spans between neighbouring columns of the ring', () => {
    // This is what the row layout could not give. There the columns stood in
    // pairs at the frame edges, so an arch between a pair reached across the
    // whole width of the picture — a lintel over the scene rather than a bay of
    // an arcade. On a ring the neighbours sit on a chord, and an arch over a
    // chord is a bay.
    for (const aspect of ASPECTS) {
      const frame = portalCameraFrame(aspect, WIDEST_CRYSTAL_RADIUS);
      const arches = portalArchInstances(frame, aspect);
      const pillars = portalPillarInstances(frame, aspect);
      expect(arches.length).toBeGreaterThan(0);
      // A closed ring: one bay per column, the last one closing back onto the
      // first. Anything less means the arcade has a gap in it.
      expect(arches.length).toBe(pillars.length);

      const step = (Math.PI * 2) / PORTAL_COLONNADE_COUNT;
      const spacing = 2 * PORTAL_COLONNADE_RADIUS * Math.sin(step * 0.5);
      for (const arch of arches) {
        // Half a chord, so a bay never spans more than one gap.
        expect(arch.scale[0] * 2).toBeLessThan(spacing * 1.45);
        // Standing on the ring, not drifting inside or outside it.
        const radius = Math.hypot(arch.position[0], arch.position[2]);
        expect(radius).toBeLessThan(PORTAL_COLONNADE_RADIUS + 1e-6);
        expect(radius).toBeGreaterThan(PORTAL_COLONNADE_RADIUS * 0.9);
      }
    }
  });

  it('closes the ring without putting anything in front of the crystal', () => {
    // The ring used to be cut open in front, for fear a closed one would stand
    // a column between the viewer and the crystal. It does not: the ring's
    // radius is larger than the camera's distance, so the near side of it is
    // *behind* the viewer and never enters the frame. The gap was protecting
    // nothing and left the arcade broken exactly where it could not be seen.
    const frame = portalCameraFrame(0.45, WIDEST_CRYSTAL_RADIUS);
    expect(PORTAL_COLONNADE_RADIUS).toBeGreaterThan(frame.distance);

    // Stated over the ring rather than over individual columns: a column at a
    // wide azimuth sits nearer than the camera in z and still never crosses the
    // artifact, because it is far out to the side. Which column is safe is what
    // the projection test above already decides; what this one fixes is that
    // the ring's near arc passes behind the viewer at all.
    for (const aspect of ASPECTS) {
      expect(PORTAL_COLONNADE_RADIUS)
        .toBeGreaterThan(portalCameraFrame(aspect, WIDEST_CRYSTAL_RADIUS).distance);
    }
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
