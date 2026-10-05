import { describe, expect, it } from 'vitest';
import { mapsOf } from '../world/maps';
import { firstDayOfWeek, dayInfo } from './calendar';
import { ACTIVITIES, activityCheck, doActivity } from './activities';
import { newLife, type LifeState } from './life';

// ============================================================
// Власник, 2026-10-04: «додай трошки різноманіття в локації усі». Кожне
// заняття має місце на мапі свого міста й слухається пори року та години.
// ============================================================

const s = (patch: Partial<LifeState>): LifeState => ({ ...newLife(21, 'adult'), day: firstDayOfWeek(17) + 1, minute: 10 * 60, doneToday: [], ...patch });

describe('заняття в містах', () => {
  it('кожне заняття має зону на мапі свого міста, і кожне місто має хоч одне', () => {
    for (const a of ACTIVITIES) {
      const zones = mapsOf(a.city).flatMap((m) => m.zones).filter((z) => z.action.type === 'activity' && z.action.id === a.id);
      expect(zones.length, a.id).toBe(1);
    }
    expect(new Set(ACTIVITIES.map((a) => a.city)).size).toBe(7);
  });

  it('море — лише влітку, концерт — увечері, раз на день', () => {
    const summerDay = Array.from({ length: 7 }, (_, d) => firstDayOfWeek(17) + d).find((d) => dayInfo(d).season === 'summer')!;
    const winterDay = Array.from({ length: 7 }, (_, d) => firstDayOfWeek(17) + d).find((d) => dayInfo(d).season === 'winter')!;
    expect(activityCheck(s({ city: 'odesa', day: winterDay }), 'swim').ok).toBe(false);
    const swim = doActivity(s({ city: 'odesa', day: summerDay }), 'swim').state;
    expect(swim.mood).toBeGreaterThan(s({}).mood);
    expect(activityCheck(swim, 'swim').ok).toBe(false);
    expect(activityCheck(s({ city: 'khmelnytskyi', minute: 12 * 60 }), 'concert').ok).toBe(false);
    expect(activityCheck(s({ city: 'khmelnytskyi', minute: 18 * 60 }), 'concert').ok).toBe(true);
  });

  it('спортзал коштує й тренує; город зближує з мамою', () => {
    const gym = doActivity(s({ city: 'vinnytsia' }), 'gym').state;
    expect(gym.money).toBe(s({}).money - 120);
    expect(gym.skills.sport).toBe(s({}).skills.sport + 1);
    const warmDay = Array.from({ length: 7 }, (_, d) => firstDayOfWeek(17) + d).find((d) => dayInfo(d).season !== 'winter')!;
    const base = s({ city: 'zhylyntsi', day: warmDay, hearts: { mom: 6, dima: 6, friend: 6 } });
    expect(doActivity(base, 'garden').state.hearts.mom).toBe(6.5);
  });
});
