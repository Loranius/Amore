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
  portalCameraFrame,
  portalHalfWidthAt,
  portalPillarInstances,
} from './portalScene';

/** Аспекти реальних кадрів: вузький телефон, Pixel 8 Pro, планшет, ноутбук. */
const ASPECTS = [0.42, 0.46, 0.62, 0.75, 1.33, 1.9];

/**
 * Найширший і найвищий, що дав справжній пайплайн (20 років, 90 подій):
 * радіус друзи ≈0.68, висота ≈2.98 світових одиниць після fit-масштабу.
 * Кадр мусить вміщати саме це, а не абстрактну «одиницю».
 */
const WIDEST_ARTIFACT_RADIUS = 0.68;
const TALLEST_ARTIFACT_HEIGHT = 2.98;

describe('portal camera frame', () => {
  it('stands on the same plane the renderer puts the artifact on', () => {
    // Подіум узгоджений із fit-трансформом рендерера через один експорт.
    // Розійдуться — і кристал або зависне над каменем, або втопиться в ньому.
    expect(PORTAL_GROUND_Y).toBe(CRYSTAL_GROUND_BASELINE);
  });

  it('keeps the whole artifact inside the frame at every real aspect', () => {
    for (const aspect of ASPECTS) {
      const frame = portalCameraFrame(aspect);
      const halfHeight = frame.distance * Math.tan((frame.fov / 2) * (Math.PI / 180));
      const halfWidth = portalHalfWidthAt(frame.distance, aspect);

      expect(halfWidth).toBeGreaterThan(WIDEST_ARTIFACT_RADIUS);
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
      expect(frame.fogNear).toBeGreaterThan(frame.distance - WIDEST_ARTIFACT_RADIUS * 2);
      expect(frame.fogFar).toBeGreaterThan(frame.fogNear);
    }
  });
});

describe('portal pillars', () => {
  it('stays at the frame edge on every aspect instead of drifting inward', () => {
    // Це і є причина рахувати x із кадру: прибиті координати, підібрані на
    // телефоні, на ноутбуці опинились би впритул до кристала.
    for (const aspect of ASPECTS) {
      const frame = portalCameraFrame(aspect);
      const instances = portalPillarInstances(frame, aspect);
      expect(instances).toHaveLength(PORTAL_PILLARS.length * 2);

      for (let index = 0; index < instances.length; index += 1) {
        const instance = instances[index]!;
        const placement = PORTAL_PILLARS[Math.floor(index / 2)]!;
        const depth = frame.distance + Math.abs(placement.z);
        const halfWidth = portalHalfWidthAt(depth, aspect);
        const ratio = Math.abs(instance.position[0]) / halfWidth;

        expect(ratio).toBeCloseTo(placement.edgeFraction, 6);
        // Колона поза кристалом: інакше вона перекрила б артефакт.
        expect(Math.abs(instance.position[0])).toBeGreaterThan(WIDEST_ARTIFACT_RADIUS * 1.5);
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

  it('stands behind the artifact so the druse is never occluded', () => {
    for (const placement of PORTAL_PILLARS) {
      expect(placement.z).toBeLessThan(-PORTAL_DAIS_TOP_RADIUS);
    }
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

  it('keeps the dais top wider than the druse it carries', () => {
    expect(PORTAL_DAIS_TOP_RADIUS).toBeGreaterThan(WIDEST_ARTIFACT_RADIUS * 1.5);
  });

  it('merges the inlay and the pillar into one buffer each', () => {
    // Бюджет draw call'ів у приймальному тесті рахує саме це: інкрустація
    // з двох кілець і колона з трьох частин мусять лишитись одним мешем.
    const inlay = buildPortalInlayGeometry();
    const pillar = buildPortalPillarGeometry();

    expect(inlay.groups.length).toBeLessThanOrEqual(1);
    expect(pillar.groups.length).toBeLessThanOrEqual(1);
    expect(inlay.getAttribute('position').count).toBeGreaterThan(0);
    expect(pillar.getAttribute('position').count).toBeGreaterThan(0);

    inlay.computeBoundingBox();
    // Кільця лежать у площині подіуму, а не стоять вертикально.
    expect(Math.abs(inlay.boundingBox!.max.y - inlay.boundingBox!.min.y)).toBeLessThan(1e-6);

    pillar.computeBoundingBox();
    // Базова колона нормалізована: висота 1, радіус 1 — інакше scale в
    // InstancedMesh означав би не те, що написано в PORTAL_PILLARS.
    expect(pillar.boundingBox!.min.y).toBeCloseTo(0, 6);
    expect(pillar.boundingBox!.max.y).toBeCloseTo(1, 2);
    expect(pillar.boundingBox!.max.x).toBeLessThanOrEqual(1.01);

    inlay.dispose();
    pillar.dispose();
  });

  it('accounts for every object the environment draws', () => {
    // Поле, подіум, інкрустація, колони (один InstancedMesh) і зорі.
    expect(PORTAL_ENVIRONMENT_DRAW_CALLS).toBe(5);
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
