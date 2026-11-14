import { describe, expect, it } from 'vitest';
import { JUMP_S, SHEET_CLIPS, clipColumn, hopHeight, legacyColumn, motionClip, startJump, stepJump } from './motion';

describe('Кліп за станом людини', () => {
  it('стоїть, іде, біжить — за станом, а не за часом', () => {
    expect(motionClip({ moving: false, running: false, jump: null })).toBe('idle');
    expect(motionClip({ moving: false, running: true, jump: null })).toBe('idle');
    expect(motionClip({ moving: true, running: false, jump: null })).toBe('walk');
    expect(motionClip({ moving: true, running: true, jump: null })).toBe('run');
  });

  it('у стрибку кліп — стрибок, хоч би що робили ноги', () => {
    for (const moving of [true, false]) for (const running of [true, false]) expect(motionClip({ moving, running, jump: 0.1 })).toBe('jump');
    expect(motionClip({ moving: true, running: true, jump: 0 })).toBe('jump');
  });
});

describe('Стрибок', () => {
  it('триває JUMP_S і закінчується на землі', () => {
    let j = startJump(null);
    let t = 0;
    while (j != null) { j = stepJump(j, 1 / 60); t += 1 / 60; }
    expect(t).toBeCloseTo(JUMP_S, 1);
    expect(stepJump(null, 1 / 60)).toBeNull();
  });

  it('у повітрі не починається заново', () => {
    expect(startJump(0.3)).toBe(0.3);
    expect(startJump(0)).toBe(0);
  });

  it('проходить кадри стрибка по черзі, без повернень і пропусків', () => {
    const seen: number[] = [];
    for (let t = 0; t < JUMP_S; t += 1 / 240) {
      const col = clipColumn('jump', t);
      if (seen[seen.length - 1] !== col) seen.push(col);
    }
    expect(seen).toEqual(SHEET_CLIPS.jump);
  });

  it('дуга старих аркушів починається й закінчується на землі, вершина посередині', () => {
    expect(hopHeight(0)).toBeCloseTo(0);
    expect(hopHeight(JUMP_S)).toBeCloseTo(0);
    expect(hopHeight(JUMP_S / 2)).toBeGreaterThan(hopHeight(JUMP_S / 4));
  });
});

describe('Кадри кліпів', () => {
  it('кліпи не перетинаються й покривають весь аркуш', () => {
    const all = Object.values(SHEET_CLIPS).flat().sort((a, b) => a - b);
    expect(all).toEqual(Array.from({ length: 22 }, (_, k) => k));
  });

  it('хода й біг зациклені: за цикл проходять усі кадри', () => {
    for (const [clip, fps] of [['walk', 12], ['run', 16]] as const) {
      const cols = new Set<number>();
      for (let k = 0; k < 6; k += 1) cols.add(clipColumn(clip, (k + 0.5) / fps));
      expect([...cols]).toEqual(SHEET_CLIPS[clip]);
      expect(clipColumn(clip, 6.5 / fps)).toBe(SHEET_CLIPS[clip][0]);
    }
  });

  it('старі аркуші: біг — ті самі кадри ходи, стрибок і спокій — кадр «стоїть»', () => {
    expect(legacyColumn('idle', 3, 4)).toBe(0);
    expect(legacyColumn('jump', 0.2, 4)).toBe(0);
    for (let t = 0; t < 2; t += 0.07) {
      expect(legacyColumn('run', t, 4)).toBeGreaterThanOrEqual(1);
      expect(legacyColumn('run', t, 4)).toBeLessThanOrEqual(4);
    }
  });
});
