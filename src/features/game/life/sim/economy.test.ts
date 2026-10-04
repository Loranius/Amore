import { describe, expect, it } from 'vitest';
import { firstDayOfWeek } from './calendar';
import {
  BUSINESS_NEGLECT_DAYS,
  GIGS_PER_DAY,
  PROPERTIES,
  ROOM_FLOOR,
  buyProperty,
  doGig,
  gigCheck,
  GIGS,
  manageBusiness,
  moveFurniture,
  moveToOwned,
  openBusiness,
  rentIncome,
  spotOf,
  upgradeBusiness,
} from './economy';
import { LifeRuleError, newLife, sleep, type LifeState } from './life';
import { parseSave, serialize } from './save';

// ============================================================
// Власник, 2026-10-04: заробляти вдома через інтернет, відкрити свою справу
// (три), купувати нерухомість у різних містах, облаштовувати дім — «на рівні
// Сімс», і все навколо Лєни. Тести тримають логіку світу: де це можна, що
// воно коштує і що приносить.
// ============================================================

const adultAt = (patch: Partial<LifeState> = {}): LifeState => ({
  ...newLife(11, 'adult'),
  day: firstDayOfWeek(17) + 1,
  minute: 9 * 60,
  doneToday: [],
  ...patch,
});

describe('інтернет-заробіток', () => {
  it('потрібні ноутбук і дім; навичка підіймає оплату; не більше двох на день', () => {
    const noLaptop = adultAt();
    expect(gigCheck(noLaptop, GIGS[0]!).ok).toBe(false);
    const s = adultAt({ owned: ['laptop'], skills: { knowledge: 50, creativity: 30, sport: 10, charm: 30 } });
    const away = gigCheck({ ...s, city: 'kyiv' }, GIGS[0]!);
    expect(away.ok ? '' : away.reason).toMatch(/удома/);
    let next = s;
    for (let k = 0; k < GIGS_PER_DAY; k += 1) next = doGig(next, 'texts').state;
    expect(next.money).toBeGreaterThan(s.money);
    expect(() => doGig(next, 'design')).toThrow(LifeRuleError);
    expect(next.skills.knowledge).toBe(s.skills.knowledge + GIGS_PER_DAY);
  });
});

describe('своя справа', () => {
  it('відкривається на місці й за гроші; навідування дає касу; без нагляду — пів доходу', () => {
    const s = adultAt({ city: 'vinnytsia', money: 60000 });
    expect(() => openBusiness({ ...s, city: 'kyiv' }, 'cafe')).toThrow(/Вінниця/);
    const opened = openBusiness(s, 'cafe').state;
    expect(opened.businesses).toEqual([{ id: 'cafe', level: 1, visited: s.day }]);
    const managed = manageBusiness(opened, 'cafe').state;
    expect(managed.money).toBeGreaterThan(opened.money);
    expect(() => manageBusiness(managed, 'cafe')).toThrow(/вже/);

    const night = (state: LifeState) => {
      const asleep = sleep({ ...state, city: state.home, minute: 22 * 60 }).state;
      return asleep.money - state.money;
    };
    const fresh = night(managed);
    const neglected = night({ ...managed, day: managed.day, businesses: [{ id: 'cafe', level: 1, visited: managed.day - BUSINESS_NEGLECT_DAYS - 1 }] });
    expect(fresh).toBeGreaterThan(0);
    expect(neglected).toBeLessThan(fresh);
  });

  it('три справи; рівні 1→3; інтернет-магазин — з дому з ноутбуком', () => {
    const s = adultAt({ money: 200000, owned: ['laptop'] });
    let next = openBusiness(s, 'shop').state;
    next = upgradeBusiness(next, 'shop').state;
    next = upgradeBusiness(next, 'shop').state;
    expect(next.businesses[0]!.level).toBe(3);
    expect(() => upgradeBusiness(next, 'shop')).toThrow(/Найвищий/);
    next = openBusiness({ ...next, city: 'khmelnytskyi' }, 'flowers').state;
    next = openBusiness({ ...next, city: 'vinnytsia' }, 'cafe').state;
    expect(next.businesses.map((b) => b.id).sort()).toEqual(['cafe', 'flowers', 'shop']);
  });
});

describe('нерухомість', () => {
  it('купують на місці; у своєму — без оренди; порожнє здається щотижня', () => {
    const s = adultAt({ city: 'odesa', money: 100000 });
    expect(PROPERTIES.length).toBeGreaterThanOrEqual(5);
    const bought = buyProperty(s, 'flatOdesa').state;
    expect(bought.properties).toEqual(['flatOdesa']);
    expect(rentIncome(bought)).toBeGreaterThan(0);
    const moved = moveToOwned(bought, 'flatOdesa').state;
    expect(moved.home).toBe('odesa');
    expect(moved.rent).toBe(0);
    expect(rentIncome(moved)).toBe(0);
    expect(() => buyProperty({ ...s, city: 'kyiv' }, 'flatOdesa')).toThrow(/на місці/);
  });
});

describe('облаштування дому', () => {
  it('меблі переставляються в межах підлоги; переїзд — нова розстановка', () => {
    const s = adultAt({ decor: { rug: 'rugPink' } });
    let next = s;
    for (let k = 0; k < 30; k += 1) next = moveFurniture(next, 'rug', 1, 1);
    expect(spotOf(next, 'rug')).toEqual([ROOM_FLOOR.x1, ROOM_FLOOR.y1]);
    expect(() => moveFurniture(s, 'tv', 1, 0)).toThrow(LifeRuleError);
  });

  it('сейв зберігає справи, житло й розстановку, а старий сейв без них читається', () => {
    const s = moveFurniture(openBusiness(adultAt({ money: 9000, owned: ['laptop'], decor: { rug: 'rugPink' } }), 'shop').state, 'rug', -1, 0);
    const withHome = { ...s, properties: ['flatVin'] };
    expect(parseSave(serialize(withHome))).toEqual(withHome);
    const old = JSON.parse(serialize(withHome)) as Record<string, unknown>;
    delete old.businesses;
    delete old.properties;
    delete old.layout;
    const read = parseSave(JSON.stringify(old));
    expect(read.businesses).toEqual([]);
    expect(read.properties).toEqual([]);
    expect(read.layout).toEqual({});
  });
});
