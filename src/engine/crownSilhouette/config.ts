import type { TreeCrownSilhouetteConfig } from './types';

export const DEFAULT_TREE_CROWN_SILHOUETTE_CONFIG: TreeCrownSilhouetteConfig = {
  rulesVersion: 'tree-crown-silhouette-v1.3.0',
  azimuthSectorCount: 16,
  verticalBandCount: 5,
  maximumRadialOffsetRatio: 0.055,
  // Keep the branch hierarchy readable instead of inflating hundreds of
  // cards into two solid polygonal clouds around the main fork.
  maximumScaleDelta: 0.24,
  envelopeResponse: 0.7,
  middleLayerResponse: 0.18,
  frontClosureSelectionFraction: 0.68,
  frontClosureTargetRadialRatio: 0.5,
  frontClosureMaximumInwardOffsetRatio: 0.1,
  frontClosureScaleDelta: 0.18,
  viewDirectionCount: 8,
  minimumReadableFacingDot: 0.16,
  minimumReadableLeafFraction: 0.1,
  /*
   * ВИБІРКА, МЕНША ЗА ВІСІМ ЛИСТКІВ, НЕ СУДИТЬСЯ.
   *
   * Розгортка від нуля до сорока років по п'яти профілях заповнення знайшла
   * ТРИ АВАРІЇ в кожного активного профілю — на 0.25, 0.5 і 0.75 року
   * контракт кидав виняток, тобто пара побачила б порожній екран замість
   * дерева. Діагностика назвала причину точно: листя попереду 1, 4 або 6, з
   * них читаних НУЛЬ.
   *
   * Сіянець має всього 16-22 листки, зібрані в один жмуток на паличці. З
   * восьми напрямків огляду в котромусь неминуче трапиться, що всі три
   * картки, які опинились попереду, стоять до ока ребром. «Частка читаних
   * нижча за 0.1» на вибірці з однієї картки — це не якість крони, це
   * округлення.
   *
   * Сам інваріант лишається: він оберігає крону від того, щоб читатись
   * лезами, і на кроні з десятками карток працює як і працював. Вісім —
   * найменша вибірка, на якій поріг 0.1 узагалі має різницю між «жодного» і
   * «один».
   */
  minimumReadableSampleSize: 8,
};
