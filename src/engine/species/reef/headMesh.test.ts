import { describe, expect, it } from 'vitest';
import { reefHeadSize } from './colonyFormations';
import { buildReefHeadMesh } from './headMesh';

const head = reefHeadSize(6 * 365, 5);

const AZIMUTH = 24;

/** Радіуси всіх вершин одного кільця, за азимутом. */
function ringRadii(mesh: ReturnType<typeof buildReefHeadMesh>, ring: number): number[] {
  const radii: number[] = [];
  for (let segment = 0; segment < AZIMUTH; segment += 1) {
    const at = (ring * AZIMUTH + segment) * 3;
    radii.push(Math.hypot(mesh.positions[at]!, mesh.positions[at + 2]!));
  }
  return radii;
}

/** Скільки радіус гуляє по одному кільцю — частка від найбільшого. */
function ringSpread(mesh: ReturnType<typeof buildReefHeadMesh>, ring: number): number {
  const radii = ringRadii(mesh, ring);
  return (Math.max(...radii) - Math.min(...radii)) / Math.max(...radii);
}

/** Візерунок кільця без його розміру: відхилення від власного середнього. */
function ringPattern(mesh: ReturnType<typeof buildReefHeadMesh>, ring: number): number[] {
  const radii = ringRadii(mesh, ring);
  const mean = radii.reduce((sum, value) => sum + value, 0) / radii.length;
  return radii.map((value) => value / mean - 1);
}

/** Наскільки візерунки двох кілець — те саме з точністю до масштабу. */
function patternMatch(a: number[], b: number[]): number {
  const dot = a.reduce((sum, value, at) => sum + value * b[at]!, 0);
  return dot / Math.max(1e-12, Math.hypot(...a) * Math.hypot(...b));
}

describe('купол голови — замкнене тіло', () => {
  const mesh = buildReefHeadMesh(head, 12345);

  it('нормалей стільки ж, скільки позицій, і всі числа скінченні', () => {
    expect(mesh.normals).toHaveLength(mesh.positions.length);
    expect(mesh.positions.every(Number.isFinite)).toBe(true);
    expect(mesh.normals.every(Number.isFinite)).toBe(true);
  });

  it('кожен індекс указує на наявну вершину', () => {
    const vertices = mesh.positions.length / 3;
    expect(mesh.indices.length % 3).toBe(0);
    expect(mesh.indices.every((index) => index >= 0 && index < vertices)).toBe(true);
  });

  it('кожне ребро належить рівно двом трикутникам', () => {
    /*
     * Це і є «замкнене». Перевірка не на око: у відкритої чаші знайдеться
     * ребро з одним сусідом, і саме там камера побачила б порожнечу
     * зсередини, коли опуститься під рівень основи.
     */
    const edges = new Map<string, number>();
    for (let at = 0; at < mesh.indices.length; at += 3) {
      const triangle = [mesh.indices[at]!, mesh.indices[at + 1]!, mesh.indices[at + 2]!];
      for (let corner = 0; corner < 3; corner += 1) {
        const a = triangle[corner]!;
        const b = triangle[(corner + 1) % 3]!;
        const key = a < b ? `${a}:${b}` : `${b}:${a}`;
        edges.set(key, (edges.get(key) ?? 0) + 1);
      }
    }
    const open = [...edges.values()].filter((count) => count !== 2);
    expect(open, 'купол не замкнений').toHaveLength(0);
  });

  it('маківка — найвища точка, і вона одна', () => {
    /*
     * Купол сходиться в одну корону. Якби маківка сіла нижче за верхнє
     * кільце, тіло вивернулось би всередину — замкненість цього не
     * помічає, бо ребра лишаються парними, а межі лишаються в допуску.
     */
    const apex = mesh.positions.length / 3 - 2; // передостання: за нею — центр кришки
    const apexY = mesh.positions[apex * 3 + 1]!;
    let highestRing = -Infinity;
    for (let vertex = 0; vertex < apex; vertex += 1) {
      highestRing = Math.max(highestRing, mesh.positions[vertex * 3 + 1]!);
    }
    expect(apexY).toBeGreaterThan(highestRing);
  });

  it('жоден трикутник не вироджений', () => {
    /*
     * Замкненість — умова топологічна, і сама по собі вона брехлива.
     *
     * Мутація «маківка знову кільцем» (`APEX_BAND = 1`) стягує все
     * верхнє кільце в одну точку: двадцять чотири вершини збігаються,
     * ребра далі мають рівно по два трикутники, і тест на замкненість
     * проходить — а це рівно та вада, через яку купол уже раз довелось
     * переробляти. Вироджений трикутник не має нормалі, і рендерер
     * дістає з нього NaN.
     */
    const scale = Math.max(head.radius, head.rise);
    let smallest = Infinity;
    for (let at = 0; at < mesh.indices.length; at += 3) {
      const corner = (k: number): [number, number, number] => {
        const v = mesh.indices[at + k]! * 3;
        return [mesh.positions[v]!, mesh.positions[v + 1]!, mesh.positions[v + 2]!];
      };
      const a = corner(0); const b = corner(1); const c = corner(2);
      const u: [number, number, number] = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
      const w: [number, number, number] = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
      const cross = Math.hypot(
        u[1] * w[2] - u[2] * w[1],
        u[2] * w[0] - u[0] * w[2],
        u[0] * w[1] - u[1] * w[0],
      );
      smallest = Math.min(smallest, cross / 2);
    }
    expect(smallest / (scale * scale), 'є трикутники без площі').toBeGreaterThan(1e-4);
  });

  it('має нижню кришку, і вона дивиться вниз', () => {
    expect(mesh.baseCapTriangleCount).toBeGreaterThan(0);
    // Кришка йде ОСТАННЬОЮ, тож її трикутники — хвіст індексів.
    const capStart = mesh.indices.length - mesh.baseCapTriangleCount * 3;
    expect(capStart).toBeGreaterThan(0);
    for (let at = capStart; at < mesh.indices.length; at += 3) {
      const y = [0, 1, 2].map((k) => mesh.positions[mesh.indices[at + k]! * 3 + 1]!);
      // Уся кришка лежить на рівні основи або нижче за перше кільце.
      expect(Math.max(...y)).toBeLessThan(head.rise * 0.5);
    }
  });
});

describe('купол не є гладкою мискою', () => {
  it('радіус на одній висоті різниться по колу', () => {
    /*
     * Головне твердження форми. Гладка поверхня обертання читається
     * пластиковою мискою: у неї немає жодного місця, де світло
     * поводиться інакше. Живий масив росте долями.
     */
    /*
     * Міряється ОДНЕ кільце, а не вікно по висоті.
     *
     * Перша редакція брала всі вершини в смузі `y`, а туди потрапляють
     * різні кільця з різними базовими радіусами — і розкид виходив
     * більшим за справжню нерівність. Через це сусідня перевірка «не
     * зірка» падала на формі, яка зіркою не була. Вершини йдуть
     * кільцями по `AZIMUTH_SEGMENTS`, тож кільце береться зрізом.
     */
    /*
     * Підлога 0.18 — не «щось більше за нуль», а вимірене число.
     *
     * Перша редакція ставила 0.08, і мутація «частки прибрано»
     * (`LOBE_DEPTH = 0`) пройшла всі десять тестів: підлогу перекривала
     * сама дрібна хвиля. Виміряно на шістдесяти насіннях: із частками
     * розкид на кільці 4 лежить у 0.275–0.308, без них — у 0.089–0.090.
     * 0.18 стоїть між цими діапазонами й не належить жодному.
     */
    const spread = ringSpread(buildReefHeadMesh(head, 777), 4);
    expect(spread, 'купол ідеально круглий').toBeGreaterThan(0.18);
  });

  it('нерівність не робить із купола зірку', () => {
    /*
     * Межа з іншого боку: частки мають читатись долями масиву, а не
     * шипами.
     *
     * Міряються ВСІ кільця й кілька насінь, а не три кільця одного
     * насіння: найбільший розкид сидить на кільці 3, якого перша
     * редакція не питала. Виміряно на шістдесяти насіннях — максимум
     * 0.349; 0.40 лишає запас на насіння поза вибіркою й ловить будь-яке
     * подвоєння глибини часток.
     */
    for (const seed of [1, 777, 4242]) {
      const mesh = buildReefHeadMesh(head, seed);
      for (let ring = 1; ring < 8; ring += 1) {
        expect(ringSpread(mesh, ring), `насіння ${seed}, кільце ${ring}`)
          .toBeLessThan(0.40);
      }
    }
  });

  it('візерунок не той самий на кожному рівні', () => {
    /*
     * Друга половина форми, і її розкид не ловить.
     *
     * Якби нерівність була самими лише частками, кожне кільце мало б
     * ОДИН І ТОЙ САМИЙ візерунок, тільки різного розміру — тобто купол
     * був би профілем, протягнутим угору, як точена ніжка. Хвиля
     * закручується з висотою, і від того рівні розходяться.
     *
     * Виміряно: збіг кільця 2 з кільцем 6 дорівнює 0.85; при
     * `RIPPLE_DEPTH = 0` він рівно 1.0000 — профіль повторюється точно.
     */
    const mesh = buildReefHeadMesh(head, 777);
    const match = patternMatch(ringPattern(mesh, 2), ringPattern(mesh, 6));
    expect(match, 'купол — протягнутий профіль').toBeLessThan(0.97);
  });

  it('різні пари мають різні куполи', () => {
    const a = buildReefHeadMesh(head, 1);
    const b = buildReefHeadMesh(head, 2);
    expect(a.positions).not.toEqual(b.positions);
  });

  it('та сама пара — той самий купол', () => {
    expect(buildReefHeadMesh(head, 99)).toEqual(buildReefHeadMesh(head, 99));
  });
});

describe('купол лишається в межах голови', () => {
  it('не переростає свого радіуса й підйому надто сильно', () => {
    // Нерівність зміщує поверхню, тож точні межі трохи більші за
    // номінальні — але саме «трохи»: інакше розкладка колоній, яка
    // рахує прив'язки з номінального купола, сіла б у повітря.
    const mesh = buildReefHeadMesh(head, 4242);
    const widest = Math.max(
      Math.abs(mesh.bounds.min.x), Math.abs(mesh.bounds.max.x),
      Math.abs(mesh.bounds.min.z), Math.abs(mesh.bounds.max.z),
    );
    expect(widest).toBeLessThan(head.radius * 1.2);
    expect(mesh.bounds.max.y).toBeLessThan(head.rise * 1.2);
    expect(mesh.bounds.min.y).toBeGreaterThanOrEqual(-1e-6);
  });

  it('трикутників небагато: купол видно загальним планом', () => {
    const mesh = buildReefHeadMesh(head, 1);
    expect(mesh.indices.length / 3).toBeLessThan(500);
  });
});
