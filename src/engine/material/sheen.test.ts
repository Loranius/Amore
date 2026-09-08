import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DEFAULT_CRYSTAL_COMPOSITION_CONFIG, buildCrystalComposition } from '../composition';
import { buildArtifactBlueprint, type EvolutionEventInput } from '../evolution';
import { DEFAULT_CRYSTAL_GEOMETRY_CONFIG, buildCrystalGeometry } from '../geometry';
import { DEFAULT_GROWTH_ENGINE_CONFIG, buildGrowthState } from '../growth';
import { buildCrystalSpeciesBlueprint, crystalToGrowthBlueprint } from '../species/crystal';
import { DEFAULT_CRYSTAL_MATERIAL_CONFIG } from './config';
import { buildCrystalMaterialState } from './engine';
import type { CrystalMaterialQuality } from './types';

// ============================================================
// Перелив — і чому в нього рівно одне число (ADR-0161).
// ------------------------------------------------------------
// Прохання власника: «накинь переливи на кристал при обертанні, але не дуже
// виразні». Обидві половини тут перевіряються, і друга не менш важлива за
// першу: перелив, який перерісши стає веселкою, — це рівно та тонка плівка,
// яку з цього кристала вже одного разу прибрали (`onePalette.test.ts`:
// «carries no thin-film iridescence»), бо вона клала золото на одну грань і
// зелень на сусідню.
//
// Що робить цей перелив іншим: обидва кінці його розмаху — кольори, які вже
// в родині пари (небо й обідок), і він НЕ додає світла, а розгойдує те, що
// вже набралось. Тому він не може ані винести колір за межі заслуженого
// (ADR-0004), ані підняти всі грані разом — а підйом усіх граней разом і є
// те, що сплощує кристал.
// ============================================================

function events(): EvolutionEventInput[] {
  return Array.from({ length: 24 }, (_, index) => ({
    id: `sheen-${index}`,
    occurredAt: `${2001 + Math.floor(index / 6)}-0${(index % 6) + 1}-12T10:00:00Z`,
    source: 'memories@1',
    evidence: 'verified' as const,
    channels: { remembrance: 0.9 },
    portalActivity: 0.4,
  }));
}

function build(quality: CrystalMaterialQuality = 'high') {
  const artifact = buildArtifactBlueprint({
    coupleId: 'sheen',
    config: {
      engineVersion: '1.0.0',
      relationshipStartedAt: '2000-01-01',
      timeZone: 'Europe/Kyiv',
      leapDayPolicy: 'feb-28',
    },
    events: events(),
  });
  const species = buildCrystalSpeciesBlueprint({
    artifact,
    config: { asOf: '2011-01-02T09:00:00Z', rulesVersion: '1.0.0' },
  });
  const growth = buildGrowthState({
    blueprint: crystalToGrowthBlueprint(species),
    config: DEFAULT_GROWTH_ENGINE_CONFIG,
  });
  const composition = buildCrystalComposition({ growth, config: DEFAULT_CRYSTAL_COMPOSITION_CONFIG });
  const geometry = buildCrystalGeometry({
    growth,
    composition,
    config: DEFAULT_CRYSTAL_GEOMETRY_CONFIG,
  });
  return buildCrystalMaterialState({
    species,
    composition,
    geometry,
    config: { ...DEFAULT_CRYSTAL_MATERIAL_CONFIG, quality },
  });
}

const crystals = (quality: CrystalMaterialQuality = 'high') =>
  build(quality).bodies.filter((body) => body.bodyId !== 'crystal:substrate');

describe('перелив', () => {
  it('є на кожному кристалі колонії', () => {
    // Нуль тут означав би кристал, який під обертом стоїть нерухомий —
    // виміряно на лабораторії до правки: 10.1% зміни за 4°, і майже все те
    // був рух меж граней, а не світло на тілі.
    for (const body of crystals()) {
      expect(body.shader.sheenStrength, body.bodyId).toBeGreaterThan(0);
    }
  });

  it('НЕ ДУЖЕ ВИРАЗНИЙ, і межа названа числом', () => {
    /*
     * Власник сказав «але не дуже виразні», і це число — вся різниця між
     * грою світла й веселкою. `sheenStrength` — частка, на яку розгойдується
     * ЯКА ВЖЕ Є яскравість, і стільки ж підмішаного відтінку.
     *
     * 0.2 як стеля, а не 0.12 як рівність: значення заслужене профілем
     * якості, і смуга має лишитись смугою. Але вище п'ятої частини перелив
     * перестає бути переливом — при ±20% дві сусідні грані розходяться на
     * 40% лише від того, куди вони повернуті, тобто на всю ту різницю, яку
     * `amore-crystal-look` називає «читається кристалом». Тон грані після
     * цього нічого не вирішує.
     */
    for (const body of crystals()) {
      expect(body.shader.sheenStrength, body.bodyId).toBeLessThan(0.2);
    }
  });

  it('однаковий на всіх кристалах колонії, і це навмисне', () => {
    /*
     * Сусідні терми мають окрему частку для ролі `micro`, і я був написав
     * таку саму. Потім перевірив, чи вона спрацьовує: на парі з 9, 14, 28 і
     * 43 тілами (6, 11, 25 і 40 років) роль `micro` не дісталась жодному
     * тілу — `roleFor` віддає її лише тому, чий tier не збігся з чотирма
     * названими, а рушій росту інших не видає.
     *
     * Тому тут одне число. Гілка, якої не можна побачити, — не обережність,
     * а мертвий код; цей тест і є те, що не дасть їй з'явитись мовчки.
     */
    const all = crystals(). map((body) => body.shader.sheenStrength);
    expect(new Set(all).size, JSON.stringify(all)).toBe(1);
  });

  it('зникає там, де вимкнено обчислене відбиття', () => {
    // Перелив — частина того самого бюджету кімнати, якої немає. Профіль,
    // що не платить за відбиття, не платить і за неї.
    for (const body of build('fallback').bodies) {
      expect(body.shader.sheenStrength, body.bodyId).toBe(0);
    }
  });

  it('не чіпає жилу', () => {
    // Жила не грань: вона не повертається до ока різними боками, тож азимут
    // відбиття на ній нічого не розрізняє.
    const vein = build().bodies.find((body) => body.bodyId === 'crystal:substrate');
    expect(vein?.shader.sheenStrength).toBe(0);
  });

  it('входить у підпис матеріалу, за яким тіла збиваються в батч', () => {
    // Батч ділить один матеріал. Тіло з переливом, що потрапило б у батч із
    // тілом без нього, дістало б чужий перелив — саме та випадковість, від
    // якої підпис і стереже.
    const engine = readFileSync(join(__dirname, 'engine.ts'), 'utf8');
    expect(engine).toContain('body.shader.sheenStrength,');
  });

  it('розгойдує те, що набралось, а не додає своє', () => {
    /*
     * Це і є те, що відрізняє його від тонкої плівки, яку звідси прибрали.
     * Терм, який лише ДОДАЄ, підіймає всі грані разом і сплощує тіло — саме
     * за це вище в цьому ж шейдері прибрано сталу чверть у неба. Множник зі
     * знаковим розмахом темнить так само часто, як висвітлює, тож дві
     * по-різному повернуті грані розходяться.
     *
     * І обидва кінці відтінку — кольори, які вже в родині пари: чужого
     * кольору в перелив узяти нізвідки.
     */
    const shader = readFileSync(
      join(__dirname, '../renderer/three/material.ts'),
      'utf8',
    );
    expect(shader).toContain('outgoingLight *= mix( vec3( 1.0 ), evolutionSheenTint, uEvolutionSheenStrength )');
    expect(shader).toContain('* ( 1.0 + evolutionPlay * uEvolutionSheenStrength );');
    expect(shader).toMatch(
      /vec3 evolutionSheenTint = mix\(\s*uEvolutionSkyColor,\s*uEvolutionRimColor,/,
    );
  });

  it('має входом ТІЛЬКИ напрямок погляду, а не годинник', () => {
    // Перелив, що йде сам по собі, — мерехтіння. Власник просив те, що
    // з'являється від ОБЕРТУ, тож фаза часу сюди не заходить: у блоці немає
    // жодного uEvolutionPhase.
    const shader = readFileSync(
      join(__dirname, '../renderer/three/material.ts'),
      'utf8',
    );
    const from = shader.indexOf('if ( uEvolutionSheenStrength > 0.0001 )');
    const block = shader.slice(from, shader.indexOf('\n  }', from));
    expect(from).toBeGreaterThan(0);
    expect(block).not.toContain('uEvolutionPhase');
    expect(block).toContain('inverseTransformDirection( evolutionReflected, viewMatrix )');
  });
});
