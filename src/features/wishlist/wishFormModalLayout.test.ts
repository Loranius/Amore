import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const FORM = readFileSync(join(__dirname, 'WishFormModal.tsx'), 'utf8');
const STYLES = readFileSync(join(__dirname, 'wishlistFormSections.css'), 'utf8');

describe('WishFormModal quick-create layout', () => {
  it('keeps the frequent fields visible and optional work collapsed', () => {
    expect(FORM).toContain('className="form-field wm-title-field"');
    expect(FORM).toContain('className="form-field wm-link-field"');
    expect(FORM).toContain('className="wm-photo-summary"');
    expect(FORM).toContain('aria-expanded={photoOpen}');
    expect(FORM).toContain('className="wm-details-summary"');
    expect(FORM).toContain('aria-expanded={detailsOpen}');
    expect(FORM).toContain('{detailsOpen && (');
    expect(FORM).not.toContain('wm-form-section-index');
  });

  it('offers one primary footer action instead of duplicate cancel controls', () => {
    const actions = FORM.match(
      /<div className="modal-actions wm-form-actions">([\s\S]*?)<\/div>/,
    )?.[1];

    expect(actions).toBeDefined();
    expect(actions?.match(/<button/g)).toHaveLength(1);
    expect(actions).toContain('Створити бажання');
    expect(STYLES).toMatch(
      /\.wm-form-actions \.wm-form-submit\s*\{[\s\S]*?width:\s*100%/,
    );
  });

  it('preserves recipient and creator-only secret semantics', () => {
    expect(FORM).toContain("type Scope = 'me' | 'partner' | 'shared'");
    expect(FORM).toContain("isSecret: scope === 'me' && isSecret");
    expect(FORM).toContain('aria-label="Видимість бажання"');
    expect(FORM).toContain('Видиме партнеру');
    expect(FORM).toContain('Таємне');
  });

  it('keeps the two visibility choices side by side on narrow screens', () => {
    expect(STYLES).toMatch(
      /\.wm-wish-editor \.wm-visibility-picker\s*\{[\s\S]*?grid-template-columns:\s*repeat\(2/,
    );
    expect(STYLES).not.toMatch(
      /\.wm-wish-editor \.wm-visibility-picker\s*\{[^}]*grid-template-columns:\s*1fr/,
    );
  });
});
