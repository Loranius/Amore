import { describe, expect, it } from 'vitest';
import { DEFAULT_ARTIFACT_FORMS, parseArtifactForms } from './artifactForms';

// ADR-0237 §7, п. 1: форма — вибір пари; невідоме значення не ламає сцену.
describe('форми виду в налаштуваннях пари', () => {
  it('розбирає збережений JSON і об’єкт', () => {
    expect(parseArtifactForms('{"crystal":"stalagmite","tree":"sakura"}')).toEqual({ crystal: 'stalagmite', tree: 'sakura' });
    expect(parseArtifactForms({ crystal: 'druse', tree: 'spruce' })).toEqual({ crystal: 'druse', tree: 'spruce' });
  });

  it('будь-що невідоме — форма за замовчуванням (сталий вигляд: друза й дуб)', () => {
    expect(parseArtifactForms(null)).toEqual(DEFAULT_ARTIFACT_FORMS);
    expect(parseArtifactForms('не json')).toEqual(DEFAULT_ARTIFACT_FORMS);
    expect(parseArtifactForms('{"crystal":"obelisk","tree":"palm"}')).toEqual(DEFAULT_ARTIFACT_FORMS);
    expect(parseArtifactForms('{"tree":"sakura"}')).toEqual({ crystal: 'druse', tree: 'sakura' });
  });
});
