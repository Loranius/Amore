import type { ComponentProps } from 'react';
import type { CrystalV2Geometry } from '@/engine/species/crystalV2/geometry';
import type { CrystalV2Model } from '@/engine/species/crystalV2/model';
import { seasonOf } from '@/engine/species/grammar/season';
import { CRYSTAL_GROUND_BASELINE } from '@/engine/renderer/three';
import { Diorama } from '@/features/home/diorama/Diorama';
import { CrystalIsland } from './CrystalIsland';
import { CrystalV2Object } from './CrystalV2Object';
import { linearColour } from './crystalV2Material';
import type { CrystalV2Frame } from './crystalV2Frame';

interface CrystalHomeWorldProps {
  model: CrystalV2Model;
  geometry: CrystalV2Geometry;
  frame: CrystalV2Frame;
  /** Радіус верхівки острова в сцені (`dioramaIslandRadius`). */
  island: number;
  theme: 'light' | 'dark';
  reduceMotion: boolean;
  /** Дотик хроніки росту (ADR-0238) — лише на справжній головній. */
  tap?: ComponentProps<'group'>;
}

/**
 * Світ Crystal Home усередині `PortalStage`: тло й частинки діорами,
 * святилище-острів і колонія. Один компонент на портал і на лабораторію
 * (`crystal-home-lab.html`), тож те, що інспектує DevTools у лабораторії, —
 * ті самі об'єкти, що бачить пара, а не схожа копія.
 */
export function CrystalHomeWorld({ model, geometry, frame, island, theme, reduceMotion, tap }: CrystalHomeWorldProps) {
  return (
    <>
      <Diorama
        species="crystal"
        theme={theme}
        seed={model.startDate}
        radius={island}
        groundY={CRYSTAL_GROUND_BASELINE}
        reduceMotion={reduceMotion}
        base={false}
      />
      <CrystalIsland
        seed={model.startDate}
        theme={theme}
        radius={island}
        groundY={CRYSTAL_GROUND_BASELINE}
        glowColour={linearColour(model.colour.rgb)}
        crystalHeight={frame.height}
        reduceMotion={reduceMotion}
        druses={model.druses}
        season={seasonOf(model.asOf)}
      />
      <group {...tap}>
        <CrystalV2Object
          model={model}
          geometry={geometry}
          scale={frame.scale}
          theme={theme}
          reduceMotion={reduceMotion}
        />
      </group>
    </>
  );
}
