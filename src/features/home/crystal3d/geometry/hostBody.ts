// ============================================================
// hostBody — аналітичне тіло-господар у світових координатах (Volume V).
// ------------------------------------------------------------
// Нормативно: CRYSTAL_ATTACHMENT_INTEGRITY_PROFILE §6 (External Shell),
// `CAI-REQ-005..008`, `V5-REQ-013..016`.
//
// Питання, на яке відповідає цей модуль, рівно одне: «чи ця точка
// ГАРАНТОВАНО всередині тіла господаря?». Гарантія тут — не побажання, а
// умова коректності: junctionTrim видаляє грані, спираючись на цю
// відповідь, і хибне «так» лишило б у зовнішній оболонці дірку.
//
// Тому радіус господаря беремо як СТРОГУ НИЖНЮ МЕЖУ, і обидва множники —
// не підібрані «на око», а геометричні факти реального меша:
//   • cos(π/segments) — лате будує ПЛОСКІ грані між колонками, тож
//     найближча до осі точка поверхні (середина грані) лежить на
//     вписаному радіусі багатокутника, а не на описаному;
//   • (1 − jitterAmp) — грані ще й «дихають» радіально на ±jitterAmp.
// Добуток гарантує: якщо radial < bound, точка всередині для БУДЬ-ЯКОГО
// азимута й будь-якого розіграного джиттера. Жодних магічних 0.95.
// ============================================================
import * as THREE from 'three';
import { BREATHE_AMPLITUDE, type ClusterBranch, type ClusterMaterial } from '../crystalCluster';
import { computeCrystalProfile, nominalRadiusAt, type CrystalProfile } from './latheProfile';

/** Тіло, проти якого перевіряють занурення: профіль + світовий трансформ. */
export interface HostSolid {
  key: string;
  profile: CrystalProfile;
  /** Світова позиція основи тіла (та сама, що йде в <mesh position>). */
  position: THREE.Vector3;
  /** Обернена орієнтація тіла — переводить світову точку в локальний простір. */
  inverseQuaternion: THREE.Quaternion;
  /** Множник строгої нижньої межі радіуса (вписаний багатокутник × джиттер). */
  radiusBound: number;
  /** Світова обмежувальна сфера (ВЕРХНЯ оцінка) — дешевий відсів кандидатів. */
  boundsCenter: THREE.Vector3;
  boundsRadius: number;
}

export function buildHostSolid(
  branch: ClusterBranch,
  material: Pick<ClusterMaterial, 'surfaceComplexity' | 'polish'>,
): HostSolid {
  const profile = computeCrystalProfile(branch, material);
  const inradius = Math.cos(Math.PI / profile.segments);
  const position = new THREE.Vector3(branch.posX, branch.posY, branch.posZ);
  const quaternion = new THREE.Quaternion(branch.quatX, branch.quatY, branch.quatZ, branch.quatW);

  // Обмежувальна сфера — навпаки, ВЕРХНЯ оцінка (описаний радіус × джиттер):
  // вона лише відсіює завідомо далекі тіла, тож мусить бути щедрою.
  const maxR =
    profile.side.reduce((mx, p) => Math.max(mx, p.r), 0) *
    Math.max(profile.scaleX, profile.scaleZ) *
    (1 + profile.jitterAmp);
  const halfH = profile.h / 2;
  const boundsCenter = new THREE.Vector3(0, halfH, 0).applyQuaternion(quaternion).add(position);

  return {
    key: branch.key,
    profile,
    position,
    inverseQuaternion: quaternion.clone().invert(),
    radiusBound: inradius * Math.max(0, 1 - profile.jitterAmp),
    boundsCenter,
    boundsRadius: Math.hypot(halfH, maxR),
  };
}

/** Чи можуть два тіла взагалі перетинатись (дешевий тест сфер). */
export function boundsOverlap(a: HostSolid, b: HostSolid): boolean {
  return a.boundsCenter.distanceTo(b.boundsCenter) < a.boundsRadius + b.boundsRadius;
}

const _local = new THREE.Vector3();

/**
 * Чи лежить світова точка гарантовано всередині тіла господаря, ще й із
 * запасом `margin` (світові одиниці) у будь-який бік.
 *
 * Запас — не перестраховка, а вимога рантайму: кожне тіло «дихає»
 * (CrystalScene масштабує його по власній осі на ±BREATHE_AMPLITUDE, кожне
 * своєю фазою). Зріз рахується один раз при scale=1, тож грань, яка ледве
 * ховалась у господарі, могла б через кадр із нього виглянути. Тіло
 * ерозується на `margin`, і жодна фаза дихання цього не проб'є.
 *
 * Пласкі архетипи (blade/tabular) масштабують геометрію ПІСЛЯ лате, тож
 * локальну точку спершу «розмасштабовують» назад у простір обертання —
 * інакше лезо вважалось би круглим і зріз пішов би повз.
 *
 * Нижче основи і вище вістря — завжди «зовні»: там тіло замкнене кришкою,
 * і точка за нею вже частина зовнішнього світу.
 */
export function isInsideHost(worldPoint: THREE.Vector3, host: HostSolid, margin = 0): boolean {
  _local.copy(worldPoint).sub(host.position).applyQuaternion(host.inverseQuaternion);
  const { profile } = host;
  const y = _local.y;
  if (y <= margin || y >= profile.h - margin) return false;
  const x = _local.x / profile.scaleX;
  const z = _local.z / profile.scaleZ;
  const radial = Math.hypot(x, z);
  // Профіль звужується, тож у вікні ±margin поверхня може бути ближчою до
  // осі, ніж рівно на висоті y — беремо найгірший з трьох замірів.
  const nominal = Math.min(
    nominalRadiusAt(profile, y),
    nominalRadiusAt(profile, y - margin),
    nominalRadiusAt(profile, y + margin),
  );
  return radial + margin < nominal * host.radiusBound;
}

/**
 * Запас ерозії для пари (тіло, господар): обидва дихають по власній осі,
 * тож точка може зміститись до BREATHE_AMPLITUDE·висота кожного з них.
 */
export const breatheMargin = (self: HostSolid, host: HostSolid): number =>
  BREATHE_AMPLITUDE * (self.profile.h + host.profile.h);

/** Індекс тіл за ключем — вхід для junctionTrim/validateShell. */
export function buildHostSolids(
  branches: readonly ClusterBranch[],
  material: Pick<ClusterMaterial, 'surfaceComplexity' | 'polish'>,
): Map<string, HostSolid> {
  return new Map(branches.map((b) => [b.key, buildHostSolid(b, material)]));
}
