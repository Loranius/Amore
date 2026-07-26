// ============================================================
// Профіль графіки й «скло» без карти оточення (Volume VI, рендер-шар).
// ------------------------------------------------------------
// Контекст — заголовок render/gfxProfile.ts: у липні зі сцени прибрали
// ОДНИМ коммітом обох підозрюваних у білому фоні на пристрої власника
// (карту оточення й Bloom), тож жоден не перевірений поодинці. Ці тести
// стережуть інструмент бісекції, а не «красивість»:
//
//   1. дефолт НЕ вмикає нічого, що створює render target — інакше
//      діагностика перестає бути діагностикою, бо підозрюваний працює
//      завжди;
//   2. `?gfx=` уміє вмикати рівно ОДНУ можливість (абсолютний режим) —
//      без цього ізолювати причину неможливо;
//   3. вимкнена можливість справді нічого не додає в матеріал;
//   4. нові поля матеріалу не розмножують батчі (draw calls — виміряне
//      вузьке місце мобільного GPU, див. Phase 8).
// ============================================================
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { buildBranches, SEEDS, type DataVolume } from './fixture';
import { publishCrystal } from '../crystalPublication';
import { buildBodyBatches, disposeBatches } from '../render/batchedBodies';
import { bodyMaterialProps, materialSignature } from '../material/bodyMaterial';
import { BARE_GFX, DEFAULT_GFX, parseGfxProfile } from '../render/gfxProfile';
import { buildStudioEnvMap, STUDIO_COLORS } from '../render/envMap';
import { applySkyReflection, skyReflectionSignature } from '../render/skyReflection';

const VOLUMES: readonly DataVolume[] = ['sparse', 'typical', 'rich'];

describe('профіль графіки — інструмент бісекції', () => {
  it('дефолт не вмикає ЖОДНОГО механізму з render target', () => {
    // Це головна умова всієї фази. Карта оточення веде в PMREM
    // (HalfFloat render target), Bloom — у власні таргети композера;
    // обидва — той самий клас, що лишився під підозрою. Якщо колись
    // хтось увімкне їх у дефолті «щоб було красивіше», тест упаде і
    // нагадає, що діагноз ще не поставлений.
    expect(DEFAULT_GFX.env, 'карта оточення в дефолті').toBe(false);
    expect(DEFAULT_GFX.bloom, 'Bloom у дефолті').toBe(false);
    // …а «скло» — навпаки, увімкнене: воно безпечне й дає виміряний ефект
    // (середня дельта пікселя 6.7 проти «off»).
    expect(DEFAULT_GFX.glass).toBe(true);
    // Іризація вимкнена НЕ через ризик, а тому що виміряно її невидимість
    // (0.5 дельти навіть на максимумі). Тест стереже саме це рішення:
    // якщо колись її ввімкнуть, спершу треба показати, що її видно.
    expect(DEFAULT_GFX.iridescence).toBe(false);
  });

  it('перелік без знаків вмикає РІВНО перелічене (ізоляція)', () => {
    const onlyEnv = parseGfxProfile('env');
    expect(onlyEnv).toEqual({ env: true, iridescence: false, glass: false, bloom: false });
    const onlyBloom = parseGfxProfile('bloom');
    expect(onlyBloom).toEqual({ env: false, iridescence: false, glass: false, bloom: true });
    // Обидва разом — теж без «зайвого» скла, щоб порівняння лишалось чистим.
    expect(parseGfxProfile('env,bloom')).toEqual({
      env: true,
      iridescence: false,
      glass: false,
      bloom: true,
    });
  });

  it('+/- працюють від дефолту, off/all — крайні точки', () => {
    expect(parseGfxProfile('+bloom')).toEqual({ ...DEFAULT_GFX, bloom: true });
    expect(parseGfxProfile('+irid')).toEqual({ ...DEFAULT_GFX, iridescence: true });
    expect(parseGfxProfile('-glass')).toEqual({ ...DEFAULT_GFX, glass: false });
    expect(parseGfxProfile('off')).toEqual(BARE_GFX);
    expect(parseGfxProfile('all')).toEqual({ env: true, iridescence: true, glass: true, bloom: true });
    // Порожнє/відсутнє — дефолт; сміття ігнорується, а не ламає рендер.
    expect(parseGfxProfile(null)).toEqual(DEFAULT_GFX);
    expect(parseGfxProfile('')).toEqual(DEFAULT_GFX);
    expect(parseGfxProfile('нісенітниця')).toEqual(BARE_GFX);
  });
});

describe('матеріал — гейт по профілю', () => {
  it('вимкнена можливість справді нічого не додає', () => {
    const { branches, material } = buildBranches(SEEDS[0]);
    const body = branches.find((b) => b.primary)!;
    const bare = bodyMaterialProps(body, material, BARE_GFX);
    expect(bare.iridescence).toBe(0);
    expect(bare.rimStrength).toBe(0);
    expect(bare.skyStrength).toBe(0);

    const glass = bodyMaterialProps(body, material, DEFAULT_GFX);
    expect(glass.rimStrength).toBeGreaterThan(0);
    expect(glass.skyStrength).toBeGreaterThan(0);
    const irid = bodyMaterialProps(body, material, parseGfxProfile('irid'));
    expect(irid.iridescence).toBeGreaterThan(0);
  });

  it('справжня карта оточення вимикає підробку — інакше подвійне відбиття', () => {
    const { branches, material } = buildBranches(SEEDS[0]);
    const body = branches.find((b) => b.primary)!;
    const withEnv = bodyMaterialProps(body, material, parseGfxProfile('all'));
    expect(withEnv.skyStrength, 'небо в шейдері поверх справжньої мапи').toBe(0);
    expect(withEnv.rimStrength, 'френель поверх справжньої мапи').toBe(0);
  });

  it('нові поля входять у ключ батча — два матеріали не зіллються', () => {
    const { branches, material } = buildBranches(SEEDS[0]);
    const body = branches.find((b) => b.primary)!;
    expect(materialSignature(bodyMaterialProps(body, material, BARE_GFX))).not.toBe(
      materialSignature(bodyMaterialProps(body, material, DEFAULT_GFX)),
    );
  });

  it('фото полірують → іризація сильніша', () => {
    // Той самий зв'язок, що вже керує roughness/clearcoat і джиттером
    // граней: іризація — «полірований» бік матеріалу, а не окремий декор.
    const { branches, material } = buildBranches(SEEDS[0]);
    const body = branches.find((b) => !b.primary && b.tier !== 'micro' && !b.emissive)!;
    const irid = parseGfxProfile('irid');
    const dull = bodyMaterialProps(body, { ...material, polish: 0 }, irid);
    const polished = bodyMaterialProps(body, { ...material, polish: 1 }, irid);
    expect(polished.iridescence).toBeGreaterThan(dull.iridescence);
  });

  it('мікрошар лишається матовим пилом, віхи — золотими, не веселковими', () => {
    const { branches, material } = buildBranches(SEEDS[0], 'rich');
    const micro = branches.find((b) => b.tier === 'micro');
    const emissive = branches.find((b) => b.emissive);
    const irid = parseGfxProfile('irid');
    if (micro !== undefined) expect(bodyMaterialProps(micro, material, irid).iridescence).toBe(0);
    if (emissive !== undefined) {
      expect(bodyMaterialProps(emissive, material, irid).iridescence).toBe(0);
      expect(bodyMaterialProps(emissive, material).rimColor).toBe('#ffe0a3');
    }
  });
});

describe('draw calls — нові параметри не розмножують батчі', () => {
  it('кількість батчів однакова в усіх профілях', () => {
    // Поля матеріалу входять у ключ батча, тож теоретично могли б
    // подрібнити групи. Заміряно: не дрібнять — розрізнення те саме, що
    // було (ярус/вид тіла), просто з більшою кількістю чисел.
    for (const seed of SEEDS) {
      for (const volume of VOLUMES) {
        const { branches, material } = buildBranches(seed, volume);
        const published = publishCrystal(branches, material);
        const counts = [BARE_GFX, DEFAULT_GFX, parseGfxProfile('all')].map((gfx) => {
          const batches = buildBodyBatches(published.renderable, material, gfx);
          const n = batches.length;
          disposeBatches(batches);
          return n;
        });
        expect(new Set(counts).size, `${seed}/${volume}: ${counts.join(' vs ')}`).toBe(1);
        expect(counts[0], `${seed}/${volume}: ${counts[0]} батчів`).toBeLessThanOrEqual(10);
      }
    }
  });
});

describe('«скло» без карти оточення', () => {
  it('патчить шейдер і дає кожній конфігурації власний ключ програми', () => {
    // Без `customProgramCacheKey` three перевикористав би скомпільовану
    // програму між матеріалами з різними уніформами — і два батчі тихо
    // поділили б чуже відбиття.
    const material = new THREE.MeshPhysicalMaterial();
    const options = {
      rim: 0.3,
      sky: 0.1,
      skyColor: new THREE.Color('#f2f6ff'),
      groundColor: new THREE.Color('#f6cbd8'),
      rimColor: new THREE.Color('#ffeef5'),
    };
    applySkyReflection(material, options);
    expect(material.customProgramCacheKey()).toContain(skyReflectionSignature(options));

    const shader = { uniforms: {}, fragmentShader: 'void main() {\n#include <opaque_fragment>\n}' };
    material.onBeforeCompile(shader as never, null as never);
    expect(Object.keys(shader.uniforms).sort()).toEqual([
      'uGroundColor',
      'uRimColor',
      'uRimStrength',
      'uSkyColor',
      'uSkyStrength',
    ]);
    expect(shader.fragmentShader).toContain('uniform float uRimStrength;');
    expect(shader.fragmentShader).toContain('outgoingLight +=');
    material.dispose();
  });

  it('нульові сили нічого не патчать — вимкнено означає вимкнено', () => {
    const material = new THREE.MeshPhysicalMaterial();
    const before = material.onBeforeCompile;
    applySkyReflection(material, {
      rim: 0,
      sky: 0,
      skyColor: new THREE.Color(),
      groundColor: new THREE.Color(),
      rimColor: new THREE.Color(),
    });
    expect(material.onBeforeCompile).toBe(before);
    material.dispose();
  });
});

describe('діагностична карта оточення', () => {
  it('детермінована й придатна для PBR-матеріалу', () => {
    const a = buildStudioEnvMap();
    const b = buildStudioEnvMap();
    expect(Array.from(b.image.data as Uint8Array)).toEqual(Array.from(a.image.data as Uint8Array));
    expect(a.mapping).toBe(THREE.EquirectangularReflectionMapping);
    expect(a.colorSpace).toBe(THREE.SRGBColorSpace);
    a.dispose();
    b.dispose();
  });

  it('це справді градієнт «небо → земля», а не рівна заливка', () => {
    // Заливка дала б відбиття без жодної інформації про напрямок, тобто
    // просто підняла б яскравість — і діагностика перевіряла б не те.
    const texture = buildStudioEnvMap(STUDIO_COLORS);
    const data = texture.image.data as Uint8Array;
    const width = texture.image.width;
    const height = texture.image.height;
    const luminanceOfRow = (y: number): number => {
      let sum = 0;
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        sum += data[i]! * 0.2126 + data[i + 1]! * 0.7152 + data[i + 2]! * 0.0722;
      }
      return sum / width;
    };
    expect(luminanceOfRow(1), 'зеніт не яскравіший за надир').toBeGreaterThan(luminanceOfRow(height - 2));
    texture.dispose();
  });
});
