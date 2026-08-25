import { describe, expect, it } from 'vitest';
import { reefHeadSize } from './colonyFormations';
import { REEF_CAMERA_FOV_DEG, reefCameraFrame, reefStanding } from './reefStaging';

const HEADS = [
  reefHeadSize(1 * 365, 1),
  reefHeadSize(3 * 365, 4),
  reefHeadSize(12 * 365, 6),
  reefHeadSize(25 * 365, 6),
];

describe('камінь ховає основу голови', () => {
  it('нижнє кільце голови лежить під поверхнею каменя', () => {
    /*
     * Уся суть каменя в одному числі. Голова має нижню кришку на рівні
     * своєї основи; камера рифа опускається під цей рівень, і відкрита
     * знизу голова показала б рівний диск.
     *
     * Перевіряється не «камінь є», а саме нерівність: поверхня каменя
     * на відстані радіуса голови вища за те, куди голову посаджено.
     */
    for (const head of HEADS) {
      const standing = reefStanding(head);
      const surface = standing.rock.rise
        * Math.sqrt(1 - (head.radius / standing.rock.radius) ** 2);
      expect(standing.headLift, `голова ${head.radius}`).toBeLessThan(surface);
    }
  });

  it('камінь ширший за голову, але лишається основою, а не островом', () => {
    for (const head of HEADS) {
      const { rock } = reefStanding(head);
      expect(rock.radius).toBeGreaterThan(head.radius);
      expect(rock.radius / head.radius).toBeLessThan(2);
      // І пласкіший за голову — інакше він читався б другою головою.
      expect(rock.rise).toBeLessThan(head.rise * 0.6);
    }
  });

  it('маківка каменя ховається всередині голови', () => {
    // Камінь опуклий, тож його вершина стоїть вище за посадку голови.
    // Якби вона вилізла над головою, з води стирчав би камінь.
    for (const head of HEADS) {
      const standing = reefStanding(head);
      expect(standing.rock.rise, `голова ${head.radius}`)
        .toBeLessThan(standing.headLift + head.rise);
    }
  });

  it('посадка додатна — голова не тоне в камені цілком', () => {
    for (const head of HEADS) {
      const standing = reefStanding(head);
      expect(standing.headLift).toBeGreaterThan(0);
      expect(standing.headLift).toBeLessThan(head.rise);
    }
  });
});

/**
 * Чи видно точку рифа з камери — по-справжньому, через проєкцію.
 *
 * Не «половина поля більша за половину рифа»: так міряють ПЛОСКУ
 * мішень, і саме так перша редакція пропустила ваду, через яку на
 * широкому екрані риф різався краями. Тут точка переводиться в систему
 * камери й питається її кут від осі погляду.
 */
function visible(
  frame: ReturnType<typeof reefCameraFrame>,
  aspect: number,
  point: { x: number; y: number; z: number },
): boolean {
  const eye = {
    x: 0,
    y: frame.target.y + frame.distance * frame.height,
    z: frame.distance,
  };
  const forward = {
    x: frame.target.x - eye.x,
    y: frame.target.y - eye.y,
    z: frame.target.z - eye.z,
  };
  const length = Math.hypot(forward.x, forward.y, forward.z);
  const f = { x: forward.x / length, y: forward.y / length, z: forward.z / length };
  // Права й верхня осі камери (світ тримає верх по +Y).
  const right = { x: 1, y: 0, z: 0 };
  const up = {
    x: f.y * right.z - f.z * right.y,
    y: f.z * right.x - f.x * right.z,
    z: f.x * right.y - f.y * right.x,
  };

  const rel = { x: point.x - eye.x, y: point.y - eye.y, z: point.z - eye.z };
  const depth = rel.x * f.x + rel.y * f.y + rel.z * f.z;
  if (depth <= 0) return false;
  const across = rel.x * right.x + rel.y * right.y + rel.z * right.z;
  const above = rel.x * up.x + rel.y * up.y + rel.z * up.z;

  const halfVertical = (REEF_CAMERA_FOV_DEG * Math.PI) / 360;
  const halfHorizontal = Math.atan(Math.tan(halfVertical) * aspect);
  return Math.abs(Math.atan2(across, depth)) <= halfHorizontal
    && Math.abs(Math.atan2(above, depth)) <= halfVertical;
}

/** Обід і маківка голови — крайні точки, за якими її видно чи ні. */
function headExtremes(
  head: { radius: number; rise: number },
  standing: ReturnType<typeof reefStanding>,
): Array<{ x: number; y: number; z: number }> {
  const points = [{ x: 0, y: standing.headLift + head.rise, z: 0 }];
  for (let step = 0; step < 16; step += 1) {
    const angle = (step / 16) * Math.PI * 2;
    points.push({
      x: head.radius * Math.cos(angle),
      y: standing.headLift,
      z: head.radius * Math.sin(angle),
    });
  }
  return points;
}

// Вертикальний телефон, квадрат і широкий екран.
const ASPECTS = [0.31, 0.45, 1, 1.3, 1.6];

describe('кадр камери тримає весь риф', () => {
  it('уся голова в кадрі на кожній формі екрана', () => {
    for (const head of HEADS) {
      const standing = reefStanding(head);
      for (const aspect of ASPECTS) {
        const frame = reefCameraFrame(head, standing, aspect);
        for (const point of headExtremes(head, standing)) {
          expect(
            visible(frame, aspect, point),
            `голова ${head.radius}, aspect ${aspect}, точка ${JSON.stringify(point)}`,
          ).toBe(true);
        }
      }
    }
  });

  it('вужчий екран відсуває камеру далі', () => {
    for (const head of HEADS) {
      const standing = reefStanding(head);
      expect(reefCameraFrame(head, standing, 0.45).distance)
        .toBeGreaterThan(reefCameraFrame(head, standing, 1.6).distance);
    }
  });

  it('ціль дивиться на риф, а не в порожнечу', () => {
    for (const head of HEADS) {
      const standing = reefStanding(head);
      const frame = reefCameraFrame(head, standing, 1);
      expect(frame.target.y).toBeGreaterThan(0);
      expect(frame.target.y).toBeLessThan(standing.headLift + head.rise);
    }
  });

  it('старший риф вимагає більшого кадру', () => {
    const young = reefCameraFrame(HEADS[0]!, reefStanding(HEADS[0]!), 1);
    const old = reefCameraFrame(HEADS[3]!, reefStanding(HEADS[3]!), 1);
    expect(old.distance).toBeGreaterThan(young.distance);
  });
});
