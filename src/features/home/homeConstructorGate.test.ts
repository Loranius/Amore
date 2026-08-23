import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// ============================================================
// Регрес: конструктор не повертається до умови за іменем.
// ------------------------------------------------------------
// `me.name === 'Діма'` не було обмеженням доступу — ім'я не є правом, і
// будь-хто з таким іменем отримував панель розробки на головній. Тест
// дивиться в текст, бо гілка залежить від `import.meta.env`, якого в
// цьому середовищі немає.
// ============================================================

const source = readFileSync(join(__dirname, 'EvolutionConstructor.tsx'), 'utf8');

describe('умова показу конструктора', () => {
  it('не питає, як звати користувача', () => {
    expect(source).not.toMatch(/me\.name/);
    expect(source).not.toMatch(/useCurrentUser/);
  });

  it('питає прапорець', () => {
    expect(source).toMatch(/isEvolutionConstructorEnabled/);
    expect(source).toMatch(/const visible = enabled && pathname === '\/'/);
  });
});
