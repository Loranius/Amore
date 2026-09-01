// ============================================================
// Ланцюг станів кристала: джерела → блупринт → … → життя.
// ------------------------------------------------------------
// ЧОМУ ОКРЕМО ВІД ГАКА. Гак `useEvolutionCrystalPipeline` знає про
// Supabase, React Query й сім модулів порталу. Сам ланцюг не знає нічого:
// на вході знімок і конфігурація, на виході шість чистих станів.
//
// Розділено заради ВИМІРУ. `amore-crystal-look` тримається на одному
// правилі — міряй, перш ніж крутити, — а виміряти кристал досі можна було
// лише через живий портал: підняти сервер, залогінитись справжнім PIN'ом,
// дочекатись мережі. Тобто найдорожча передумова стояла перед найчастішою
// дією, і в пісочниці без ключів вона не виконується взагалі.
//
// Тепер той самий ланцюг викликає лабораторія (`crystal-lab.html`) із
// синтетичних джерел. Важливо, що САМЕ ТОЙ САМИЙ: друга копія показувала б
// схожий кристал, а вимір із неї не переносився б на портал — і жодне
// число з неї не було б доказом.
// ============================================================
import {
  buildArtifactFromSnapshot,
  type AdapterDiagnostic,
  type EvolutionSourceSnapshot,
} from '@/engine/evolution/adapters';
import type { ArtifactBlueprint } from '@/engine/evolution';
import {
  buildCrystalSpeciesBlueprint,
  crystalToGrowthBlueprint,
  type CrystalSpeciesBlueprint,
} from '@/engine/species/crystal';
import {
  DEFAULT_GROWTH_ENGINE_CONFIG,
  buildGrowthState,
  type GrowthState,
} from '@/engine/growth';
import {
  DEFAULT_CRYSTAL_COMPOSITION_CONFIG,
  buildCrystalComposition,
  type CrystalCompositionState,
} from '@/engine/composition';
import {
  DEFAULT_CRYSTAL_GEOMETRY_CONFIG,
  buildCrystalGeometry,
  type CrystalGeometryState,
} from '@/engine/geometry';
import {
  DEFAULT_CRYSTAL_MATERIAL_CONFIG,
  buildCrystalMaterialState,
  type CrystalMaterialQuality,
  type CrystalMaterialState,
} from '@/engine/material';
import {
  DEFAULT_CRYSTAL_LIFE_CONFIG,
  buildCrystalLifeState,
  type CrystalLifeState,
} from '@/engine/life';

export const ENGINE_VERSION = '1.0.0';
export const SPECIES_RULES_VERSION = '1.0.0';
export const COUPLE_TIME_ZONE = 'Europe/Kyiv';

/**
 * Стеля опублікованих тіл.
 *
 * Не оптимізація: рушій росту сам вирішує, скільки тіл існує, і без стелі
 * пара з піввіковою історією отримала б їх стільки, скільки років.
 */
export const MAX_PUBLISHED_BODIES = 128;

export interface CrystalPipelineInput {
  coupleId: string;
  asOf: string;
  relationshipStartedAt: string;
  snapshot: EvolutionSourceSnapshot;
  sharedDaysOff: readonly string[];
  quality: CrystalMaterialQuality;
  reducedMotion: boolean;
  colorPartners?: { first: number | null; second: number | null } | undefined;
}

export interface CrystalPipelineStates {
  artifact: ArtifactBlueprint;
  /** Що адаптери відкинули дорогою — портал показує це в діагностиці. */
  adapterDiagnostics: AdapterDiagnostic[];
  species: CrystalSpeciesBlueprint;
  growth: GrowthState;
  composition: CrystalCompositionState;
  geometry: CrystalGeometryState;
  material: CrystalMaterialState;
  life: CrystalLifeState;
}

/** Шість станів з одних джерел. Чисто: ані мережі, ані годинника. */
export function buildCrystalPipelineStates(
  input: CrystalPipelineInput,
): CrystalPipelineStates {
  const built = buildArtifactFromSnapshot({
    coupleId: input.coupleId,
    asOf: input.asOf,
    snapshot: input.snapshot,
    engineConfig: {
      engineVersion: ENGINE_VERSION,
      relationshipStartedAt: input.relationshipStartedAt,
      timeZone: COUPLE_TIME_ZONE,
      leapDayPolicy: 'feb-28',
    },
  });
  const artifact = built.blueprint;

  const species = buildCrystalSpeciesBlueprint({
    artifact,
    config: {
      asOf: input.asOf,
      rulesVersion: SPECIES_RULES_VERSION,
      ...(input.colorPartners ? { colorPartners: input.colorPartners } : {}),
      // Спільні вихідні пари, а не події порталу — див. `CrystalSpeciesConfig`.
      sharedDaysOff: input.sharedDaysOff,
    },
  });

  const growth = buildGrowthState({
    blueprint: crystalToGrowthBlueprint(species),
    config: { ...DEFAULT_GROWTH_ENGINE_CONFIG, maxBodies: MAX_PUBLISHED_BODIES },
  });
  const composition = buildCrystalComposition({
    growth,
    config: DEFAULT_CRYSTAL_COMPOSITION_CONFIG,
  });
  const geometry = buildCrystalGeometry({
    growth,
    composition,
    config: DEFAULT_CRYSTAL_GEOMETRY_CONFIG,
  });
  const material = buildCrystalMaterialState({
    species,
    composition,
    geometry,
    config: { ...DEFAULT_CRYSTAL_MATERIAL_CONFIG, quality: input.quality },
  });
  const life = buildCrystalLifeState({
    species,
    composition,
    material,
    config: {
      ...DEFAULT_CRYSTAL_LIFE_CONFIG,
      quality: input.quality,
      reducedMotion: input.reducedMotion,
      mediaFinishedCount: input.snapshot.media.length,
    },
  });

  return {
    artifact,
    adapterDiagnostics: [...built.adapterDiagnostics],
    species,
    growth,
    composition,
    geometry,
    material,
    life,
  };
}
