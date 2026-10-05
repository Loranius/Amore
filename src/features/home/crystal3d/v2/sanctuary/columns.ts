// ============================================================
// Колони святилища (ADR-0242).
// ------------------------------------------------------------
// Ті самі п'ять квадратних колон з боків і позаду (спереду жодної — вони не
// затуляють кристал пари), але вже не клони. Кожна має:
//   * плінт і капітель — колона збудована, а не стовпчик;
//   * стовбур із трьох барабанів, трохи зсунутих і повернутих один відносно
//     одного — шви кладки й пошкоджені краї без дрібних трикутників;
//   * власні висоту, товщину, поворот і ледь помітний нахил;
//   * зламаний верх у частини колон — уламок лежить поруч на підлозі;
//   * лозу різної густоти: одна колона майже вся в лозі, інша гола.
// Повтор лишається — п'ять однакових за родом колон читаються задумом, а не
// випадком.
// ============================================================
import { unit } from '@/engine/species/crystalV2/hash';
import { PAINT, Painter, box, chunk, flower, ivy, polar, vine, type V3 } from './brushes';

/**
 * Кути колон — від камери (вона дивиться з +z, тобто з кута π/2): колони
 * з боків і позаду, а спереду дуга відкрита. `vines` — скільки висоти
 * стовбура обвиває лоза (0 — гола колона).
 */
const COLUMNS = [
  { a: 0.52, h: 0.62, vines: 0.85 },
  { a: 2.62, h: 0.8, vines: 0.35 },
  { a: 3.75, h: 0.5, vines: 0 },
  { a: 4.71, h: 0.9, vines: 0.6 },
  { a: 5.67, h: 0.7, vines: 0.2 },
] as const;

/** Де стоять колони цього острова — бордюр підлоги між ними. */
export function columnAngles(seed: string): number[] {
  return COLUMNS.map((col, k) => col.a + (unit(seed, `isle:column${k}:a`) - 0.5) * 0.2);
}

/** Будує колони; повертає найвищу точку руїн (щоб камера не зрізала їх). */
export function buildColumns(p: Painter, seed: string, R: number): number {
  let ruinTop = 0;
  const angles = columnAngles(seed);
  COLUMNS.forEach((col, k) => {
    const key = `isle:column${k}`;
    const a = angles[k]!;
    const base = polar(R * (0.85 + 0.04 * unit(seed, `${key}:r`)), a, 0);
    const h = R * col.h * (0.9 + 0.2 * unit(seed, `${key}:h`));
    const w = R * (0.11 + 0.05 * unit(seed, `${key}:w`));
    const turn = (unit(seed, `${key}:turn`) - 0.5) * 0.7;
    const broken = unit(seed, `${key}:broken`) < 0.45;
    // Нахил — до 3°, у випадковий бік: колона осіла, але стоїть.
    const leanDir = unit(seed, `${key}:leanDir`) * Math.PI * 2;
    const lean = Math.tan((unit(seed, `${key}:lean`) * 3 * Math.PI) / 180);
    const axis = (y: number): V3 => [base[0] + Math.cos(leanDir) * lean * y, y, base[2] + Math.sin(leanDir) * lean * y];
    const shade = 0.8 + 0.16 * unit(seed, `${key}:shade`);

    // Плінт: широкий низький блок, на якому стоїть стовбур.
    box(p, [base[0], -R * 0.02, base[2]], [base[0], R * 0.065, base[2]], w * 1.45, w * 1.45, PAINT.ruin, shade * 0.92, turn);
    // Стовбур — три барабани. Кожен трохи зсунутий і повернутий: шов кладки
    // читається уступом, а пошкоджений край — без дрібних граней.
    const shaftTop = broken ? h * (0.72 + 0.12 * unit(seed, `${key}:stump`)) : h;
    const joints = [R * 0.065, R * 0.065 + (shaftTop - R * 0.065) * 0.38, R * 0.065 + (shaftTop - R * 0.065) * 0.7, shaftTop];
    for (let d = 0; d < 3; d += 1) {
      const dk = `${key}:drum${d}`;
      const nudge = w * 0.05 * d;
      const da = unit(seed, `${dk}:nudge`) * Math.PI * 2;
      const lo = axis(joints[d]!);
      const hi = axis(joints[d + 1]!);
      const shift: V3 = [Math.cos(da) * nudge, 0, Math.sin(da) * nudge];
      box(
        p,
        [lo[0] + shift[0], lo[1], lo[2] + shift[2]],
        [hi[0] + shift[0], hi[1], hi[2] + shift[2]],
        w * (1 - 0.04 * d),
        w * (1 - 0.04 * d),
        PAINT.ruin,
        shade * (0.86 + 0.06 * d),
        turn + (unit(seed, `${dk}:turn`) - 0.5) * 0.12,
      );
    }
    let crown: number;
    const top = axis(shaftTop);
    if (broken) {
      // Зламаний верх: скошений уламок, а сам барабан лежить на підлозі поруч.
      box(p, top, [top[0] + w * 0.12, shaftTop + w * 0.45, top[2] - w * 0.08], w * 0.78, w * 0.66, PAINT.ruin, shade * 0.95, turn + 0.3);
      crown = shaftTop + w * 0.45;
      const side = a + (unit(seed, `${key}:fallSide`) < 0.5 ? -1 : 1) * 0.24;
      const lie = polar(R * 0.79, side, w * 0.42);
      const along: V3 = [-Math.sin(side), 0, Math.cos(side)];
      const len = w * (1.3 + 0.5 * unit(seed, `${key}:fallLen`));
      box(
        p,
        [lie[0] - along[0] * len * 0.5, lie[1], lie[2] - along[2] * len * 0.5],
        [lie[0] + along[0] * len * 0.5, lie[1] + w * 0.04, lie[2] + along[2] * len * 0.5],
        w * 0.84,
        w * 0.84,
        PAINT.ruin,
        shade * 0.86,
      );
      chunk(p, seed, `${key}:rubble`, polar(R * 0.82, a + 0.12, R * 0.02), w * 0.32, PAINT.ruin, 0, 0.6);
    } else {
      // Капітель — дві плити, ширші за стовбур.
      box(p, top, [top[0], shaftTop + w * 0.16, top[2]], w * 1.18, w * 1.18, PAINT.ruin, shade * 0.98, turn);
      box(p, [top[0], shaftTop + w * 0.16, top[2]], [top[0], shaftTop + w * 0.32, top[2]], w * 1.34, w * 1.34, PAINT.ruin, shade, turn);
      crown = shaftTop + w * 0.32;
    }
    ruinTop = Math.max(ruinTop, crown);

    // ── Лоза: спіраль по стовбуру від землі вгору ────────────
    if (col.vines > 0) {
      const climb = (crown - R * 0.04) * col.vines;
      const steps = Math.max(4, Math.round(climb / (R * 0.045)));
      const phase = unit(seed, `${key}:vinePhase`) * Math.PI * 2;
      const turns = 1.1 + 0.6 * unit(seed, `${key}:vineTurns`);
      const path: V3[] = [];
      for (let i = 0; i <= steps; i += 1) {
        const t = i / steps;
        const y = R * 0.04 + climb * t;
        const ang = phase + t * turns * Math.PI * 2;
        const c = axis(y);
        const rr = w * 0.62;
        path.push([c[0] + Math.cos(ang) * rr, y, c[2] + Math.sin(ang) * rr]);
      }
      vine(p, seed, `${key}:vine`, path, R * 0.062, 0.35);
      // Густа лоза доходить до верху й лягає шапкою, з неї звисають пасма.
      if (col.vines > 0.5) {
        ivy(p, seed, `${key}:cap`, [top[0], crown + R * 0.01, top[2]], R * 0.1);
        const out: V3 = [Math.cos(a), 0, Math.sin(a)];
        const hang: V3[] = [];
        for (let d = 0; d < 5; d += 1) hang.push([top[0] + out[0] * w * 0.7, crown - d * R * 0.06, top[2] + out[2] * w * 0.7]);
        vine(p, seed, `${key}:hang`, hang, R * 0.045, 0.5);
      }
    }
    // Біля підніжжя — трава й квітка в кутку плінта, збоку по дузі краю.
    const side: V3 = [-Math.sin(a), 0, Math.cos(a)];
    const foot: V3 = [base[0] + side[0] * w * 0.95, R * 0.05, base[2] + side[2] * w * 0.95];
    ivy(p, seed, `${key}:foot`, foot, R * 0.06);
    if (unit(seed, `${key}:bloom`) < 0.7) flower(p, seed, `${key}:footFlower`, [foot[0], R * 0.075, foot[2]], R * 0.02);
  });
  return ruinTop;
}
