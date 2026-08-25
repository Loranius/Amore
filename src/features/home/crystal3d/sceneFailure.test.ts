import { describe, expect, it } from 'vitest';
import { sceneFailureReason } from './sceneFailure';

describe('заглушка не називає не ту причину', () => {
  it('404 на моделі — це асет, а не WebGL', () => {
    /*
     * Дослівно те, що стояло в консолі на телефоні власника, поки на
     * екрані писало «WebGL недоступний».
     */
    expect(sceneFailureReason(new Error(
      'Could not load /models/amore_ruin.glb: fetch for '
      + '"https://loranius.github.io/models/amore_ruin.glb" responded with 404',
    ))).toBe('asset');
  });

  it.each([
    'Failed to fetch',
    'NetworkError when attempting to fetch resource.',
    'Could not load models/school_of_fish_reef.glb',
  ])('%s — теж асет', (message) => {
    expect(sceneFailureReason(new Error(message))).toBe('asset');
  });

  it('незнайома помилка лишається загальною', () => {
    // Помилятись безпечно можна лише в цей бік: обережне формулювання
    // замість упевненого й хибного.
    expect(sceneFailureReason(new Error('Cannot read properties of undefined')))
      .toBe('scene');
    expect(sceneFailureReason(undefined)).toBe('scene');
    expect(sceneFailureReason('щось геть інше')).toBe('scene');
  });
});
