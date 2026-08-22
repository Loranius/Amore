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
    expect(PLANS_PAGE).toContain("onAddOn={(date) => openNewEvent('holiday', date, 'calendar')}");
  });

  it('uses the second tap on the selected day as the event shortcut', () => {
    expect(CALENDAR_VIEW).toMatch(
      /if \(isSel\) \{\s*onAddOn\(iso\);\s*return;\s*\}\s*setSelected\(day\);/,
    );
    expect(CALENDAR_VIEW).toContain('Додати подію на');
  });
});
