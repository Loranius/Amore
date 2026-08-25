import { describe, expect, it } from 'vitest';
import { DEFAULT_CRYSTAL_COMPOSITION_CONFIG, buildCrystalComposition } from '@/engine/composition';
import { buildArtifactBlueprint, type EvolutionEventInput } from '@/engine/evolution';
import { DEFAULT_GROWTH_ENGINE_CONFIG, buildGrowthState } from '@/engine/growth';
import { buildCrystalSpeciesBlueprint, crystalToGrowthBlueprint } from '@/engine/species/crystal';
import { DEFAULT_CRYSTAL_GEOMETRY_CONFIG } from '@/engine/geometry/config';
import { buildCrystalGeometry } from '@/engine/geometry/engine';
import { CRYSTAL_SUBSTRATE_BODY_ID } from '@/engine/geometry/substrate';
import { crystalSceneHeight, crystalSceneRadius } from '@/engine/renderer/three';
import { PORTAL_GROUND_Y, portalCameraFrame } from './portalScene';

const MODULES = ['memories', 'plans', 'wishlist', 'calendar', 'media', 'shopping'];

function build(years: number, perYear: number) {
  const events: EvolutionEventInput[] = [];
  const days = Math.round(years * 365.25);
  const step = Math.max(1, Math.round(365.25 / perYear));
  for (let day = 0; day < days; day += step) {
    const module = MODULES[day % MODULES.length]!;
    const date = new Date(Date.UTC(2000, 0, 1) + day * 86400000).toISOString().slice(0, 10);
    events.push({ id: `${module}:${day}`, occurredAt: date, source: `${module}@1`,
      evidence: 'verified', channels: { remembrance: 0.5, stability: 0.3, exploration: 0.2 }, portalActivity: 0.2 });
  }
  const asOf = new Date(Date.UTC(2000, 0, 1) + days * 86400000).toISOString().slice(0, 10);
  const artifact = buildArtifactBlueprint({ coupleId: 'frame', events,
    config: { engineVersion: '1.0.0', relationshipStartedAt: '2000-01-01', timeZone: 'Europe/Kyiv', leapDayPolicy: 'feb-28' } });
  const species = buildCrystalSpeciesBlueprint({ artifact, config: { asOf, rulesVersion: '1.0.0' } });
  const growth = buildGrowthState({ blueprint: crystalToGrowthBlueprint(species), config: DEFAULT_GROWTH_ENGINE_CONFIG });
  const composition = buildCrystalComposition({ growth, config: DEFAULT_CRYSTAL_COMPOSITION_CONFIG });
  return buildCrystalGeometry({ growth, composition, config: DEFAULT_CRYSTAL_GEOMETRY_CONFIG });
}

/** Частка ВИСОТИ екрана, яку займають кристали, через справжній кадр. */
function screenShare(geometry: ReturnType<typeof build>, aspect: number) {
  const radius = crystalSceneRadius(geometry, { includeSubstrate: false });
  const height = crystalSceneHeight(geometry);
  const frame = portalCameraFrame(aspect, radius, height);
  const [, eyeY, eyeZ] = frame.position;
  const [, targetY] = frame.target;
  const half = Math.tan((frame.fov * Math.PI) / 360);
  // Проєкція точки на осі, у частках половини висоти кадру.
  const project = (y: number, z: number): number => {
    const dy = y - eyeY!;
    const dz = z - eyeZ!;
    const dirY = targetY! - eyeY!;
    const dirZ = 0 - eyeZ!;
    const len = Math.hypot(dirY, dirZ);
    const fy = dirY / len, fz = dirZ / len;      // вперед
    const uy = -fz, uz = fy;                      // вгору, перпендикуляр
    const depth = dy * fy + dz * fz;
    const up = dy * uy + dz * uz;
    return up / (Math.max(1e-6, depth) * half);
  };
  const bodies = geometry.meshes.filter((m) => m.bodyId !== CRYSTAL_SUBSTRATE_BODY_ID);
  const fit = height / Math.max(...bodies.map((m) => m.bounds.max.y));
  let top = -Infinity, bottom = Infinity;
  for (const mesh of bodies) {
    for (let i = 0; i < mesh.positions.length; i += 3) {
      const y = PORTAL_GROUND_Y + mesh.positions[i + 1]! * fit;
      const z = mesh.positions[i + 2]! * fit;
      const p = project(y, z);
      if (p > top) top = p;
      if (p < bottom) bottom = p;
    }
  }
  return (top - bottom) / 2;   // одиниці = вся висота екрана
}

// ============================================================
// Вік пари має бути ВИДНО на екрані.
// ------------------------------------------------------------
// Власник: «кристал на три роки відносин має виглядати як кристал на
// три роки, зараз він занадто великий».
//
// Причина була не в кристалі, а в камері. Кадр будувався як
// `кристал / частка`, тобто відстань масштабувалась разом із
// артефактом, і той завжди займав ту саму частку екрана. Виміряно
// справжньою функцією на справжній геометрії, телефон 0.450:
//
//   1 рік 68.6% · 3 роки 68.9% · 5 років 69.5% · 10 років 69.6%
//
// Десять років — один пункт. Рушій при цьому ростив кристал у 3.4 раза.
//
// Тест міряє саме те, на що дивиться пара: частку ВИСОТИ ЕКРАНА, яку
// займає друза, спроєктовану через справжній кадр камери. Не висоту в
// одиницях сцени — вона й раніше росла чесно, і саме тому вада прожила
// стільки часу непоміченою.
// ============================================================
describe('кристал на екрані росте разом із парою', () => {
  const PHONE = 0.450;

  it('кожен наступний вік більший за попередній', () => {
    /*
     * Смуга 1–14 років — та, яку пара реально проживе на цьому порталі.
     * Далі на вузькому екрані зв'язує вже ШИРИНА колонії: тридцятирічна
     * друза ширша, тож камера мусить відійти, і частка висоти падає.
     * Це геометрія, а не вада: об'єкт, ширший за екран, не може
     * заповнити його висоту. Тому смуга названа, а не розтягнена до
     * тридцяти, щоб тест не стеріг неможливого.
     */
    const ages = [1, 3, 5, 10, 14];
    const shares = ages.map((years) => screenShare(build(years, 40), PHONE));
    for (let index = 1; index < shares.length; index += 1) {
      expect(
        shares[index]!,
        `${ages[index]}y (${(shares[index]! * 100).toFixed(1)}%) має бути більшим `
        + `за ${ages[index - 1]}y (${(shares[index - 1]! * 100).toFixed(1)}%)`,
      ).toBeGreaterThan(shares[index - 1]!);
    }
  });

  it('різниця між трьома й десятьма роками помітна оком', () => {
    /*
     * Монотонності мало: вона трималась би й на різниці в один пункт,
     * тобто рівно на тій ваді, через яку цей тест написано. Виміряно
     * після правки: 51.1% проти 63.1%, тобто дванадцять пунктів.
     */
    const three = screenShare(build(3, 40), PHONE);
    const ten = screenShare(build(10, 40), PHONE);
    expect(ten - three).toBeGreaterThan(0.08);
  });

  it('молодий кристал не губиться в залі', () => {
    // Межа з іншого боку, і вона теж із історії: стала висота кадру вже
    // була, і трирічна пара займала 23% екрана. Тому висота кадру
    // афінна, а не стала.
    expect(screenShare(build(1, 40), PHONE)).toBeGreaterThan(0.35);
  });
});
