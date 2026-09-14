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
import { CRYSTAL_SUBSTRATE_BODY_ID, type CrystalGeometryState } from '@/engine/geometry';

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
   * Стеля щільності рендеру, поки заломлення ввімкнене.
   *
   * НЕ «щоб швидше», а тому що інших важелів у нашій версії `three` немає.
   * Буфер заломлення створюється (перевірено в `three` 0.170,
   * `renderTransmissionPass`) з `samples: 4`, `generateMipmaps: true`,
   * `HalfFloatType` — і щокадру ставиться в РОЗМІР ВСЬОГО КАДРУ:
   * `transmissionRenderTarget.setSize( activeViewport.z, activeViewport.w )`.
   * Ручки, якою цей розмір масштабують, у 0.170 немає — її шукано grep'ом і
   * не знайдено.
   *
   * Отже єдине, що впливає на вартість проходу, — це сам розмір полотна.
   * На `high` стеля 2: 824 × 1830 = 1.5 Мп, і стільки ж коштує другий
   * прохід із чотириразовим MSAA та повним ланцюгом mip-рівнів. При 1.4 —
   * 577 × 1281 = 0.74 Мп, тобто **вдвічі менше пікселів** і в кадрі, і в
   * буфері.
   *
   * ЦІНА НАЗВАНА: кадр стає м'якшим. Це видно на тонких лініях — обводах
   * граней і травинках, — і саме тому стеля діє ЛИШЕ поки прапорець
   * увімкнений.
   *
   * Чого тут НЕ виміряно: кадрів на секунду. Пісочниця рендерить через
   * SwiftShader, де час іде приблизно у двадцять разів повільніше
   * (`scripts/live/README.md`, пастка 7), тож будь-яке число про
   * плавність звідси було б вигадкою. Скільки це дало насправді, може
   * сказати тільки пристрій.
   */
  renderScaleCeiling: 1.4,
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
 * ПРИЙМАЄ ПАРИ «тіло → матеріал», а не самі матеріали, і це виправлення
 * власної вади. Перша редакція брала `bundle.materials.values()` — тобто
 * геть усі фізичні матеріали артефакта, разом із **каменем підкладки**.
 * Жеода через це ставала склом: камінь, крізь який видно острів, — це не
 * те, про що просили, і платив за нього кадр найдорожче, бо підкладка
 * займає широку смугу екрана й має 2 396 трикутників проти сотні в
 * монарха.
 *
 * Знімає ПОВНІСТЮ, а не лише `transmission`: `attenuationColor` і
 * `thickness` лишились би на матеріалі й чекали б, доки хтось увімкне
 * прозорість іншим шляхом, — тобто прапорець перестав би бути
 * перемикачем і став подорожжю в один бік.
 */
export function applyCrystalRefraction(
  bodies: Iterable<readonly [string, THREE.Material]>,
  options: { on: boolean; width: number },
): void {
  const thickness = Math.max(1e-6, options.width) * CRYSTAL_REFRACTION.thicknessShare;
  const attenuation = Math.max(1e-6, options.width) * CRYSTAL_REFRACTION.attenuationShare;
  for (const [bodyId, material] of bodies) {
    const physical = material as THREE.MeshPhysicalMaterial;
    if (physical.isMeshPhysicalMaterial !== true) continue;
    // Камінь лишається каменем.
    if (bodyId === CRYSTAL_SUBSTRATE_BODY_ID) continue;
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

/**
 * Щільність рендеру з урахуванням заломлення.
 *
 * Окремою функцією, а не `Math.min` на місці виклику: число має стояти
 * поруч із причиною, через яку воно існує, інакше наступний, хто
 * побачить «магічну 1.4» у файлі сцени, прибере її як зайву.
 */
export function crystalRefractionRenderScale(base: number, refraction: boolean): number {
  if (!refraction) return base;
  return Math.min(base, CRYSTAL_REFRACTION.renderScaleCeiling);
}
