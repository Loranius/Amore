import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// ============================================================
// Регресія хроніки (ADR-0238): дотики по модулях і записах нічого не
// робили. Причина — невидиме поле дотику хрестика (`.modal-close::before`,
// inset −3px) рахується від найближчого позиційованого предка; зі
// `position: static` цим предком ставала вся шторка, і хрестик ловив кожен
// дотик. Виміряно `elementsFromPoint` над модулем «Плани».
// ============================================================

const css = readFileSync(join(__dirname, 'chronicle.css'), 'utf8');

describe('шторка хроніки ловить дотики', () => {
  it('хрестик у заголовку позиційований сам, щоб його поле дотику не накривало шторку', () => {
    const rule = /\.chronicle-head \.modal-close \{([^}]*)\}/.exec(css)?.[1] ?? '';
    expect(rule).toMatch(/position:\s*relative/);
    expect(rule).not.toMatch(/position:\s*static/);
  });

  it('шторка вмикає дотики собі: головна пропускає їх крізь вміст до сцени', () => {
    const rule = /\.chronicle \{([^}]*)\}/.exec(css)?.[1] ?? '';
    expect(rule).toMatch(/pointer-events:\s*auto/);
  });
});
