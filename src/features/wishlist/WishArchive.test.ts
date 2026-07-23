import { describe, expect, it } from 'vitest';
import { archiveCountText } from './wishlistArchivePresentation';

describe('archiveCountText', () => {
  it('formats personal memory counts', () => {
    expect(archiveCountText(1, false)).toBe('1 подарований спогад');
    expect(archiveCountText(3, false)).toBe('3 подаровані спогади');
    expect(archiveCountText(11, false)).toBe('11 подарованих спогадів');
  });

  it('formats shared dream counts', () => {
    expect(archiveCountText(1, true)).toBe('1 здійснена мрія');
    expect(archiveCountText(4, true)).toBe('4 здійснені мрії');
    expect(archiveCountText(12, true)).toBe('12 здійснених мрій');
  });
});
