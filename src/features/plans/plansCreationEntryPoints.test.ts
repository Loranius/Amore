import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const PLANS_PAGE = readFileSync(join(__dirname, 'PlansPage.tsx'), 'utf8');
const CALENDAR_VIEW = readFileSync(join(__dirname, '../calendar/CalendarViews.tsx'), 'utf8');

describe('plans creation entry points', () => {
  it('uses the floating plus only for a plan', () => {
    expect(PLANS_PAGE).toContain('aria-label="Додати план"');
    expect(PLANS_PAGE).toContain('onClick={openPlanComposer}');
    expect(PLANS_PAGE).not.toContain('CalendarCreateChooser');
    expect(PLANS_PAGE).not.toContain('Що створюємо?');
  });

  it('opens a calendar event directly for a chosen date', () => {
    // `openNewEvent` lost its third argument (`surface`) when the «Події»/
    // «Календар» tabs were removed (ADR-0041) — there is no longer a
    // section to route the modal into, so the call is two arguments now.
    expect(PLANS_PAGE).toContain("onAddOn={(date) => openNewEvent('holiday', date)}");
  });

  it('uses the second tap on the selected day as the event shortcut', () => {
    expect(CALENDAR_VIEW).toMatch(
      /if \(isSel\) \{\s*onAddOn\(iso\);\s*return;\s*\}\s*setSelected\(day\);/,
    );
    expect(CALENDAR_VIEW).toContain('Додати подію на');
  });
});
