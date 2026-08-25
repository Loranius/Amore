// ============================================================
// Риба: двадцять два трикутники й чорна крапка замість ока.
// ------------------------------------------------------------
// Власник назвав форму дослівно: «менше полігонів, просто різнокольорові
// рибки, замість ока в них просто чорна точка». Це й є специфікація.
//
// Риба одна на всю зграю: тіло однакове, різняться колір, розмір і
// орбіта. Тому меш будується РАЗ і малюється інстансами — двадцять дві
// риби коштують два виклики малювання, а не сорок чотири.
//
// Форма — не риба взагалі, а силует, який читається рибою збоку:
// стиснуте з боків веретено з розділеним хвостом. Ніяких плавців,
// зябер і луски: на екрані телефона риба має чотири піксели заввишки, і
// все, що дрібніше за силует, там не існує.
//
// ВІСЬ. Ніс дивиться в +Z, верх у +Y, боки в ±X. Сцена повертає рибу
// по дотичній до її кола, тож ця вісь — частина контракту, а не смак.
// ============================================================
import { round6 } from './math';
import type { ReefMeshData } from './headMesh';

/** Напіввисота й напівширина — у частках довжини риби. */
const BODY_HALF_HEIGHT = 0.19;
const BODY_HALF_WIDTH = 0.075;
/** Де тіло найтовще: ближче до голови, як у справжньої риби. */
const WIDEST_AT = 0.38;
/** Де тіло переходить у хвостове стебло. */
const WAIST_AT = 0.78;
const WAIST_SCALE = 0.34;

/** Хвіст: наскільки виступає й наскільки роздвоєний. */
const TAIL_LENGTH = 0.26;
const TAIL_SPREAD = 0.3;
const TAIL_FORK = 0.11;

/** Око: де сидить, яке завбільшки й наскільки виступає за борт. */
const EYE_AT = 0.17;
const EYE_LIFT = 0.06;
/*
 * Крапка ВЕЛИКА, і це не карикатура, а арифметика.
 *
 * Перша редакція мала 0.035 довжини риби. Риба на екрані завдовжки
 * приблизно 0.1 одиниці сцени — тобто око виходило 0.004, набагато
 * менше за піксель, і на живому знімку його просто не було. Власник
 * просив «замість ока просто чорну точку»; точка, якої не видно, — це
 * не виконана вимога, а прибрана.
 *
 * 0.075 — це 40% напіввисоти тіла. Багато для риби й рівно стільки,
 * скільки треба, щоб силует читався живим на загальному плані.
 */
const EYE_RADIUS = 0.075;
const EYE_SEGMENTS = 6;

/**
 * Тіло риби довжиною 1, носом у +Z.
 *
 * Чотири кільця по чотири вершини (верх, правий бік, низ, лівий бік) —
 * саме стільки, щоб силует був стиснутий з боків, а не круглий.
 */
export function buildReefFishMesh(): ReefMeshData {
  const positions: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];

  const nose = 0;
  positions.push(0, 0, round6(0.5));
  normals.push(0, 0, 1);

  const rings: Array<[number, number]> = [
    [WIDEST_AT, 1],
    [WAIST_AT, WAIST_SCALE],
  ];
  const ringStart = positions.length / 3;
  for (const [at, scale] of rings) {
    const z = 0.5 - at;
    const halfHeight = BODY_HALF_HEIGHT * scale;
    const halfWidth = BODY_HALF_WIDTH * scale;
    // Порядок вершин у кільці: верх, правий бік, низ, лівий бік.
    const ring: Array<[number, number]> = [
      [0, halfHeight], [halfWidth, 0], [0, -halfHeight], [-halfWidth, 0],
    ];
    for (const [x, y] of ring) {
      positions.push(round6(x), round6(y), round6(z));
      const length = Math.max(1e-9, Math.hypot(x, y));
      normals.push(round6(x / length), round6(y / length), 0);
    }
  }

  const tailBase = positions.length / 3;
  positions.push(0, 0, round6(-0.5 + TAIL_LENGTH));
  normals.push(0, 0, -1);

  // Ніс → перше кільце.
  for (let side = 0; side < 4; side += 1) {
    indices.push(nose, ringStart + side, ringStart + ((side + 1) % 4));
  }
  // Перше кільце → друге.
  for (let side = 0; side < 4; side += 1) {
    const next = (side + 1) % 4;
    indices.push(ringStart + side, ringStart + 4 + side, ringStart + next);
    indices.push(ringStart + next, ringStart + 4 + side, ringStart + 4 + next);
  }
  // Друге кільце → основа хвоста.
  for (let side = 0; side < 4; side += 1) {
    indices.push(ringStart + 4 + side, tailBase, ringStart + 4 + ((side + 1) % 4));
  }

  /*
   * Хвіст — пласка вилка з двох трикутників, і він двобічний.
   *
   * Двобічний не з ліні: у площини немає товщини, і риба, що
   * розвернулась, показала б виворіт. Два трикутники з протилежним
   * обходом коштують стільки ж, скільки один прапорець матеріалу, зате
   * не змушують сцену вимикати відсікання для всієї зграї.
   */
  const forkTop = positions.length / 3;
  positions.push(0, round6(TAIL_SPREAD), round6(-0.5));
  normals.push(0, 0, -1);
  positions.push(0, round6(-TAIL_SPREAD), round6(-0.5));
  normals.push(0, 0, -1);
  positions.push(0, 0, round6(-0.5 + TAIL_FORK));
  normals.push(0, 0, -1);
  const forkNotch = forkTop + 2;
  indices.push(tailBase, forkTop, forkNotch);
  indices.push(tailBase, forkNotch, forkTop + 1);
  indices.push(tailBase, forkNotch, forkTop);
  indices.push(tailBase, forkTop + 1, forkNotch);

  return {
    positions,
    normals,
    indices,
    baseCapTriangleCount: 0,
    bounds: {
      min: { x: -BODY_HALF_WIDTH, y: -TAIL_SPREAD, z: -0.5 },
      max: { x: BODY_HALF_WIDTH, y: TAIL_SPREAD, z: 0.5 },
    },
  };
}

/**
 * Око — чорна крапка, і буквально: плаский шестикутник на кожному боці.
 *
 * Окремий меш, бо він єдиний у зграї не має кольору риби. Двадцять дві
 * риби дають сорок чотири крапки й ОДИН виклик малювання.
 */
export function buildReefFishEyeMesh(): ReefMeshData {
  const positions: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];

  for (const side of [1, -1]) {
    const centre = positions.length / 3;
    const x = side * (BODY_HALF_WIDTH * 0.55);
    positions.push(round6(x), round6(EYE_LIFT), round6(0.5 - EYE_AT));
    normals.push(side, 0, 0);
    for (let step = 0; step < EYE_SEGMENTS; step += 1) {
      const angle = (step / EYE_SEGMENTS) * Math.PI * 2;
      positions.push(
        round6(x),
        round6(EYE_LIFT + Math.sin(angle) * EYE_RADIUS),
        round6(0.5 - EYE_AT + Math.cos(angle) * EYE_RADIUS),
      );
      normals.push(side, 0, 0);
    }
    for (let step = 0; step < EYE_SEGMENTS; step += 1) {
      const next = (step + 1) % EYE_SEGMENTS;
      // Обхід залежить від боку, інакше одне з двох очей дивилось би
      // всередину риби й зникло під відсіканням.
      if (side > 0) indices.push(centre, centre + 1 + step, centre + 1 + next);
      else indices.push(centre, centre + 1 + next, centre + 1 + step);
    }
  }

  return {
    positions,
    normals,
    indices,
    baseCapTriangleCount: 0,
    bounds: {
      min: { x: -BODY_HALF_WIDTH, y: EYE_LIFT - EYE_RADIUS, z: 0.5 - EYE_AT - EYE_RADIUS },
      max: { x: BODY_HALF_WIDTH, y: EYE_LIFT + EYE_RADIUS, z: 0.5 - EYE_AT + EYE_RADIUS },
    },
  };
}
