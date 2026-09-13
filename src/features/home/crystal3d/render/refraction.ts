// ============================================================
// Заломлення — тіло стає справді прозорим (ADR-0178).
// ------------------------------------------------------------
// ТІЛЬКИ ЗА ПРАПОРЦЕМ `?gfx=refraction`. Опублікований матеріал рушія
// каже `transmission: 0` і `transmissionForcedOff: true`, і це лишається
// правдою: рушій нічого не знає про прапорець, а знімає заборону
// адаптер — так само, як він робить це з картою оточення (`?gfx=env`,
// ADR-0171).
//
// ЧОМУ ЗАБОРОНА ВЗАГАЛІ БУЛА. `WebGLRenderer::renderTransmissionPass`
// жорстко ставить `setClearColor(0xffffff, 0.5)`, щойно `clearAlpha < 1`,
// а полотно порталу прозоре — небо було CSS-градієнтом ПІД ним. Прозоре
// тіло через це малювало білий прямокутник на місці неба. Разом із цим
// прапорцем небо переїжджає в сцену (`PortalSky`), а полотно стає
// непрозорим, і буфер заломлення нарешті містить те, що має.
// ============================================================
import * as THREE from 'three';
import type { CrystalGeometryState } from '@/engine/geometry';

export const CRYSTAL_REFRACTION = Object.freeze({
  /**
   * Скільки світла проходить крізь тіло.
   *
   * Не одиниця. При 1.0 дифузна складова зникає цілком, і разом із нею —
   * заслужений колір пари (ADR-0004): лишається безбарвне скло з рожевим
   * поглинанням. 0.82 лишає видимою п'яту частину власного кольору тіла.
   */
  transmission: 0.82,
  /**
   * Товщина, у частках ширини монарха.
   *
   * `three` рахує промінь як `thickness * modelScale`, тобто число тут — у
   * ВЛАСНИХ одиницях меша, а не сцени. Промінь, що входить у призму й
   * виходить із неї, у середньому проходить близько половини її ширини;
   * 0.55 — це та середня хорда з невеликим запасом на вінець, де тіло
   * товще вздовж погляду, ніж поперек.
   */
  thicknessShare: 0.55,
  /**
   * Відстань поглинання (закон Бера), у тих самих частках.
   *
   * Це і є те, від чого камінь читається самоцвітом, а не кольоровим
   * склом: рожевий густішає там, де тіло товсте, і бліднішає на тонких
   * краях.
   *
   * ВТРИЧІ БІЛЬША ЗА ТОВЩИНУ, і це виміряно (ADR-0178). Стояло 1.15 —
   * тобто промінь проходив 0.48 відстані поглинання, і зелений канал
   * падав до третини. На живому кадрі темної теми стовбур від цього
   * потемнів на 30–40% по всій ширині: 153,76,136 → 112,47,98. Тіло
   * поглинало НЕ СВІТЛО ОСТРОВА, а темне нічне небо за собою, і прапорець
   * показував не заломлення, а затемнення — тобто відповідав не на те
   * питання, заради якого існує.
   *
   * При 3 промінь проходить 0.18 відстані, зелений тримається на 0.65, і
   * видно саме те, що мало бути видно: що крізь камінь щось є.
   */
  attenuationShare: 3,
  /**
   * Дисперсія вимкнена, і це вимірна вартість, а не смак: із нею `three`
   * бере ТРИ вибірки буфера заломлення замість однієї (`USE_DISPERSION`
   * у `transmission_pars_fragment`). Перш ніж її вмикати, треба знати, що
   * один прохід пристрій власника витримує.
   */
  dispersion: 0,
});

/**
 * Ширина монарха у власних одиницях геометрії.
 *
 * Саме монарха, а не всієї колонії: матеріал спільний для тіл однієї
 * оптичної підпису, а товщину видно найбільше на найбільшому тілі. Для
 * дітей це число завелике, і вони від цього лише густіші кольором — що на
 * їхньому розмірі читається як насиченість, а не як помилка.
 */
export function crystalBodyWidth(geometry: CrystalGeometryState): number {
  const mesh = geometry.meshes.find((entry) => entry.bodyId === 'crystal:mother')
    ?? geometry.meshes[0];
  if (mesh === undefined) return 1;
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (let index = 0; index + 2 < mesh.positions.length; index += 3) {
    const x = mesh.positions[index]!;
    const z = mesh.positions[index + 2]!;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (z < minZ) minZ = z;
    if (z > maxZ) maxZ = z;
  }
  if (!Number.isFinite(minX) || !Number.isFinite(minZ)) return 1;
  return Math.max(1e-6, (maxX - minX + (maxZ - minZ)) / 2);
}

/**
 * Увімкнути або зняти заломлення на вже зібраних матеріалах.
 *
 * Знімає ПОВНІСТЮ, а не лише `transmission`: `attenuationColor` і
 * `thickness` лишились би на матеріалі й чекали б, доки хтось увімкне
 * прозорість іншим шляхом, — тобто прапорець перестав би бути
 * перемикачем і став подорожжю в один бік.
 */
export function applyCrystalRefraction(
  materials: Iterable<THREE.Material>,
  options: { on: boolean; width: number },
): void {
  const thickness = Math.max(1e-6, options.width) * CRYSTAL_REFRACTION.thicknessShare;
  const attenuation = Math.max(1e-6, options.width) * CRYSTAL_REFRACTION.attenuationShare;
  for (const material of materials) {
    const physical = material as THREE.MeshPhysicalMaterial;
    if (physical.isMeshPhysicalMaterial !== true) continue;
    if (options.on) {
      physical.transmission = CRYSTAL_REFRACTION.transmission;
      physical.thickness = thickness;
      physical.attenuationDistance = attenuation;
      // Колір поглинання — власний колір тіла. Не окремий відтінок: те,
      // що густішає в товщі, мусить бути тим самим, що пара заслужила.
      physical.attenuationColor = physical.color.clone();
      physical.dispersion = CRYSTAL_REFRACTION.dispersion;
    } else {
      physical.transmission = 0;
      physical.thickness = 0;
      physical.attenuationDistance = Infinity;
      physical.attenuationColor = new THREE.Color(1, 1, 1);
      physical.dispersion = 0;
    }
    material.needsUpdate = true;
  }
}
