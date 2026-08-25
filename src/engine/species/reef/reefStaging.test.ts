import { describe, expect, it } from 'vitest';
import { reefHeadSize } from './colonyFormations';
import { reefCameraFrame, reefStanding } from './reefStaging';

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

describe('кадр камери тримає весь риф', () => {
  it('відстань більша за найширше в сцені', () => {
    for (const head of HEADS) {
      const standing = reefStanding(head);
      const frame = reefCameraFrame(head, standing);
      expect(frame.distance).toBeGreaterThan(standing.rock.radius * 2);
    }
  });

  it('ціль дивиться на риф, а не в порожнечу', () => {
    for (const head of HEADS) {
      const standing = reefStanding(head);
      const frame = reefCameraFrame(head, standing);
      expect(frame.target.y).toBeGreaterThan(0);
      expect(frame.target.y).toBeLessThan(standing.headLift + head.rise);
    }
  });

  it('старший риф вимагає більшого кадру', () => {
    const young = reefCameraFrame(HEADS[0]!, reefStanding(HEADS[0]!));
    const old = reefCameraFrame(HEADS[3]!, reefStanding(HEADS[3]!));
    expect(old.distance).toBeGreaterThan(young.distance);
  });
});
