import { describe, expect, it } from 'vitest';
import { isEvolutionConstructorEnabled } from './evolutionConstructorFlag';

// ============================================================
// Інструмент розробки не показується парі.
// ------------------------------------------------------------
// Умовою було `me.name === 'Діма'`: панель повзунків жила у продакшн-
// збірці й показувалась на головній за ІМЕНЕМ користувача. Ім'я — не
// право доступу, а головна, за `PRODUCT.md`, — «передусім кристал».
// ============================================================

describe('доступ до конструктора еволюції', () => {
  it('у продакшні за замовчуванням прихований', () => {
    expect(isEvolutionConstructorEnabled('', false)).toBe(false);
    expect(isEvolutionConstructorEnabled('?tab=partner', false)).toBe(false);
  });

  it('у розробці відкритий без параметрів', () => {
    expect(isEvolutionConstructorEnabled('', true)).toBe(true);
  });

  it('у продакшні відкривається явним запитом', () => {
    // Власник тестує кристал/дерево/риф на СПРАВЖНЬОМУ порталі з
    // телефона, тож повне вимкнення в продакшні було б втратою.
    for (const value of ['1', 'true', 'on']) {
      expect(isEvolutionConstructorEnabled(`?sandbox=${value}`, false)).toBe(true);
    }
  });

  it('чуже значення параметра не відкриває', () => {
    // Щоб `?sandbox=0` у збереженому посиланні не вмикав панель мовчки.
    for (const value of ['0', 'false', 'off', '']) {
      expect(isEvolutionConstructorEnabled(`?sandbox=${value}`, false)).toBe(false);
    }
  });
});
