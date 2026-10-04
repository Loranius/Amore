import { describe, expect, it } from 'vitest';
import { DAY_END_MIN, MEET_DOW, MEET_WEEK, PROPOSAL_WEEK, dayInfo, firstDayOfWeek } from './calendar';
import { JOB_BY_ID, ROUTES, itemById } from './content';
import {
  LifeRuleError,
  askDimaAlong,
  attendStudy,
  callDima,
  dimaCity,
  dimaWithLena,
  sendDimaHome,
  buy,
  canDoDuty,
  dutyToday,
  goOnDate,
  jobCheck,
  meetDima,
  meetingDue,
  newLife,
  propose,
  proposalCheck,
  routePlan,
  sleep,
  takeJob,
  travel,
  travelCheck,
  visitLyceum,
  visitSight,
  workShift,
  type LifeState,
} from './life';
import { rngFor, shuffled } from './rng';
import { SaveError, parseSave, serialize } from './save';

// ============================================================
// «Дєвочка в городі» (ADR-0239): правила симуляції.
// Кожен тест називає правило з ADR-0239 §2–§5, яке тримає.
// ============================================================

const at = (state: LifeState, day: number, minute = 8 * 60): LifeState => ({ ...state, day, minute, doneToday: [] });

/** Прожити дні до `day`, щоранку відвідуючи обов'язок. */
function liveUntil(state: LifeState, day: number): LifeState {
  let s = state;
  while (s.day < day) {
    const duty = dutyToday(s);
    if (duty && duty.kind !== 'work' && s.city === duty.city) s = attendStudy({ ...s, minute: duty.startBy }, [0.8]).state;
    s = sleep({ ...s, city: s.home, minute: 22 * 60 }).state;
  }
  return s;
}

describe('§2 календар «тиждень — рік» ставить справжні дати на свої дні', () => {
  it('зустріч — середа 4-го курсу, грудень 2022; пропозиція — субота, липень 2026', () => {
    const meet = dayInfo(firstDayOfWeek(MEET_WEEK) + MEET_DOW);
    expect([meet.stage, meet.level, meet.monthName, meet.calendarYear]).toEqual(['uni', 4, 'грудень', 2022]);
    const proposal = dayInfo(firstDayOfWeek(PROPOSAL_WEEK) + 5);
    expect([proposal.monthName, proposal.calendarYear, proposal.season]).toEqual(['липень', 2026, 'summer']);
  });

  it('садочок у 5 років, перший клас — у 6, кожен день має пору року', () => {
    expect(dayInfo(0).age).toBe(5);
    expect(dayInfo(firstDayOfWeek(1)).age).toBe(6);
    expect(new Set(Array.from({ length: 7 }, (_, d) => dayInfo(d).season))).toEqual(new Set(['autumn', 'winter', 'spring', 'summer']));
  });

  it('відкидає неможливий день замість тихого NaN', () => {
    expect(() => dayInfo(-1)).toThrow();
    expect(() => dayInfo(1.5)).toThrow();
  });
});

describe('§2 кості: детерміновані для тієї самої причини, різні для різних', () => {
  it('однакові ключі — однакова послідовність', () => {
    const a = rngFor(7, 'day', 3);
    const b = rngFor(7, 'day', 3);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
    expect(rngFor(7, 'day', 4)()).not.toBe(rngFor(7, 'day', 3)());
    expect(shuffled(rngFor(1), [1, 2, 3, 4, 5]).sort()).toEqual([1, 2, 3, 4, 5]);
  });
});

describe('§3 обов\'язок дня й навчання', () => {
  const kid = newLife(1);

  it('будні садочок у Жилинцях; 10–11 клас — у Правдівці; вихідні вільні', () => {
    expect(dutyToday(kid)?.kind).toBe('sadok');
    expect(dutyToday(at(kid, 5))).toBeNull();
    expect(dutyToday(at(kid, firstDayOfWeek(9)))?.city).toBe('zhylyntsi');
    expect(dutyToday(at(kid, firstDayOfWeek(10)))?.city).toBe('pravdivka');
    expect(dutyToday(at(kid, firstDayOfWeek(13)))?.building).toBe('vtei');
  });

  it('відвідування дає знання й віху, вдруге за день — відмова', () => {
    const school = at(newLife(1, 'school'), firstDayOfWeek(1));
    const { state, events } = attendStudy(school, [1, 0.8, 0.9]);
    expect(state.skills.knowledge).toBeGreaterThan(school.skills.knowledge);
    expect(state.milestones).toContain('firstBell');
    expect(events.some((e) => e.kind === 'milestone')).toBe(true);
    expect(canDoDuty(state).ok).toBe(false);
    expect(() => attendStudy(state, [1])).toThrow(LifeRuleError);
  });

  it('запізнення знижує оцінку дня; надто пізно — вже не пускають', () => {
    const school = at(newLife(1, 'school'), firstDayOfWeek(2));
    const onTime = attendStudy({ ...school, minute: 8 * 60 }, [1]).state.yearScores[0]!;
    const late = attendStudy({ ...school, minute: 9 * 60 + 30 }, [1]).state.yearScores[0]!;
    expect(late).toBeLessThan(onTime);
    expect(canDoDuty({ ...school, minute: 12 * 60 }).ok).toBe(false);
  });

  it('оцінки поза 0..1 — помилка, а не тихе обрізання', () => {
    expect(() => attendStudy(newLife(1), [1.5])).toThrow(LifeRuleError);
    expect(() => attendStudy(newLife(1), [])).toThrow(LifeRuleError);
  });

  it('новий рік: річна оцінка, кишенькові; пропуски знижують бал', () => {
    const start = newLife(3, 'school');
    const diligent = liveUntil(start, firstDayOfWeek(2));
    let lazy = start;
    while (lazy.day < firstDayOfWeek(2)) lazy = sleep({ ...lazy, minute: 22 * 60 }).state;
    expect(diligent.marks.at(-1)!.mark).toBeGreaterThan(lazy.marks.at(-1)!.mark);
    expect(diligent.money).toBeGreaterThan(start.money);
  });

  it('після 11 класу — переїзд у гуртожиток Вінниці й віхи випускного', () => {
    const s = liveUntil(at(newLife(5, 'school'), firstDayOfWeek(11)), firstDayOfWeek(12));
    expect([s.home, s.city, s.homeName]).toEqual(['vinnytsia', 'vinnytsia', 'Гуртожиток ВДПУ']);
    expect(s.milestones).toEqual(expect.arrayContaining(['graduation', 'student']));
  });
});

describe('§3 крамниці', () => {
  const vin = { ...newLife(2, 'uni'), money: 1000 };

  it('їжа відновлює енергію одразу; річ лягає у власність і вдягається', () => {
    const tired = { ...vin, energy: 40 };
    expect(buy(tired, 'grocery', 'varenyky').state.energy).toBe(70);
    const dressed = buy(vin, 'clothes', 'hoodie').state;
    expect(dressed.owned).toContain('hoodie');
    expect(dressed.outfit).toBe('hoodie');
    expect(dressed.money).toBe(1000 - itemById('hoodie').price);
    expect(() => buy(dressed, 'clothes', 'hoodie')).toThrow('Вже є');
  });

  it('у селі немає одягу; сувеніри — лише у своєму місті; бракує грошей — відмова з сумою', () => {
    expect(() => buy(newLife(2), 'clothes', 'hoodie')).toThrow(LifeRuleError);
    expect(() => buy(vin, 'souvenirs', 'magnetLviv')).toThrow(LifeRuleError);
    expect(() => buy({ ...vin, money: 10 }, 'grocery', 'varenyky')).toThrow(/Не вистачає 25/);
  });

  it('затишок стає в кімнату на своє місце', () => {
    const s = buy({ ...newLife(2, 'adult'), money: 2000 }, 'home', 'rugPink').state;
    expect(s.decor.rug).toBe('rugPink');
  });
});

describe('§3 дорога між містами', () => {
  it('найдешевший шлях детермінований і складається з реальних доріг', () => {
    const plan = routePlan('zhylyntsi', 'odesa')!;
    expect(plan.legs.map((l) => [l.a, l.b])).toEqual([['zhylyntsi', 'khmelnytskyi'], ['khmelnytskyi', 'vinnytsia'], ['vinnytsia', 'odesa']]);
    expect(plan.price).toBe(60 + 140 + 380);
    for (const leg of plan.legs) expect(ROUTES).toContain(leg);
  });

  it('малеча їде далеко лише з мамою на вихідних і безкоштовно; пішки до Правдівки — будь-коли', () => {
    const kid = newLife(4);
    expect(travelCheck(kid, 'khmelnytskyi').ok).toBe(false);
    const weekend = at(kid, 5, 9 * 60);
    const trip = travel(weekend, 'khmelnytskyi').state;
    expect(trip.money).toBe(weekend.money);
    expect(trip.milestones).toContain('firstTrip');
    expect(travelCheck(kid, 'pravdivka').ok).toBe(true);
  });

  it('доросла платить за квиток і не виїжджає вночі', () => {
    const s = { ...newLife(4, 'adult'), money: 2000 };
    expect(travel(s, 'kyiv').state.money).toBe(2000 - 290);
    expect(travelCheck({ ...s, minute: DAY_END_MIN - 100 }, 'kyiv').ok).toBe(false);
    expect(travelCheck({ ...s, money: 5 }, 'kyiv').ok).toBe(false);
  });
});

describe('§4 робота за вибором', () => {
  it('школярка — лише підробіток вихідними з 8 класу; диплом відкриває офіс', () => {
    const teen = at({ ...newLife(6, 'school'), city: 'vinnytsia' }, firstDayOfWeek(9) + 5);
    expect(jobCheck(teen, JOB_BY_ID.get('barista')!).ok).toBe(true);
    expect(jobCheck(teen, JOB_BY_ID.get('accountant')!).ok).toBe(false);
    expect(jobCheck(at(teen, firstDayOfWeek(6) + 5), JOB_BY_ID.get('barista')!).ok).toBe(false);
    const hired = takeJob(teen, 'barista').state;
    expect(dutyToday(hired)?.kind).toBe('work');
    expect(dutyToday(at(hired, firstDayOfWeek(9)))?.kind).toBe('school');
  });

  it('зміна платить за старанність, а п\'ять змін дають підвищення', () => {
    let s = takeJob({ ...newLife(6, 'adult'), skills: { knowledge: 60, creativity: 30, sport: 10, charm: 30 } }, 'accountant').state;
    const good = workShift({ ...s, minute: 9 * 60 }, 1).state.money - s.money;
    const poor = workShift({ ...s, minute: 9 * 60 }, 0).state.money - s.money;
    expect(good).toBeGreaterThan(poor);
    for (let d = 0; d < 7 && s.job!.rank === 0; d += 1) {
      if (dutyToday(s)?.kind === 'work') s = workShift({ ...s, minute: 9 * 60 }, 0.8).state;
      s = sleep({ ...s, minute: 22 * 60 }).state;
    }
    expect(s.job!.rank).toBe(1);
    expect(s.milestones).toEqual(expect.arrayContaining(['firstMoney', 'promotion']));
  });

  it('співбесіда — лише в місті роботи', () => {
    expect(() => takeJob(newLife(6, 'adult'), 'designer')).toThrow(/Київ/);
  });
});

describe('§5 справжня історія всередині вільного життя', () => {
  it('ліцей — літо після 9 класу в Хмельницькому, один раз', () => {
    const s = at({ ...newLife(8, 'school'), city: 'khmelnytskyi' }, firstDayOfWeek(9) + 6);
    const visited = visitLyceum(s).state;
    expect(visited.milestones).toContain('lyceum');
    expect(() => visitLyceum(visited)).toThrow();
  });

  it('Діма з\'являється не раніше середи 4-го курсу у Вінниці', () => {
    const uni = newLife(9, 'uni');
    expect(meetingDue(at(uni, firstDayOfWeek(MEET_WEEK) + 1))).toBe(false);
    const due = at(uni, firstDayOfWeek(MEET_WEEK) + MEET_DOW);
    expect(meetingDue(due)).toBe(true);
    const met = meetDima(due).state;
    expect(met.flags.metDima).toBe(true);
    expect(meetingDue(met)).toBe(false);
    // Після знайомства Діма вдома; побачення — коли Лєна покличе його з собою.
    expect(() => goOnDate(met, 'walk')).toThrow(LifeRuleError);
    const along = askDimaAlong(met).state;
    expect(goOnDate(along, 'walk').state.hearts.dima).toBeGreaterThan(met.hearts.dima);
  });

  it('після диплома з Дімою — спільна квартира на Вишеньці', () => {
    const met = meetDima(at(newLife(9, 'uni'), firstDayOfWeek(MEET_WEEK) + MEET_DOW)).state;
    const s = liveUntil(met, firstDayOfWeek(16));
    expect(s.flags.livingWithDima).toBe(true);
    expect(s.homeName).toBe('Квартира на Вишеньці');
    expect(s.milestones).toEqual(expect.arrayContaining(['diploma', 'together']));
  });

  it('пропозиція — літо 2026 на Отраді, коли сердець досить; інакше пояснює, чого бракує', () => {
    const adult = newLife(10, 'adult');
    const odesa = at({ ...adult, city: 'odesa', hearts: { ...adult.hearts, dima: 8 }, dima: { mode: 'follow', eta: null } }, firstDayOfWeek(PROPOSAL_WEEK) + 5, 19 * 60);
    expect(proposalCheck(odesa).ok).toBe(true);
    const alone = proposalCheck({ ...odesa, dima: { mode: 'home', eta: null } });
    expect(alone.ok ? '' : alone.reason).toMatch(/поклич/);
    const done = propose(odesa).state;
    expect(done.flags.proposed).toBe(true);
    expect(done.milestones).toContain('proposal');
    const lowHearts = proposalCheck({ ...odesa, hearts: { ...odesa.hearts, dima: 3 } });
    expect(lowHearts.ok ? '' : lowHearts.reason).toMatch(/разом/);
    const winter = proposalCheck(at(odesa, firstDayOfWeek(PROPOSAL_WEEK) + 2));
    expect(winter.ok ? '' : winter.reason).toMatch(/улітку/);
  });

  it('Діма ходить за Лєною лише на її прохання, іде додому за словом, приходить на дзвінок (власник, 2026-10-04)', () => {
    const adult = at(newLife(4, 'adult'), firstDayOfWeek(17) + 1, 10 * 60);
    // Удома й на вулиці свого міста — чекає, поки покличуть.
    expect(adult.dima.mode).toBe('home');
    expect(dimaWithLena(adult)).toBe(false);
    const along = askDimaAlong(adult).state;
    expect(dimaWithLena(along)).toBe(true);
    // Їде разом із Лєною.
    const trip = travel(along, 'kyiv').state;
    expect(dimaCity(trip)).toBe('kyiv');
    // «Йди додому» — і він уже не поруч.
    const alone = sendDimaHome(trip).state;
    expect(dimaWithLena(alone)).toBe(false);
    expect(dimaCity(alone)).toBe('vinnytsia');
    // Дзвінок з іншого міста: Діма в дорозі, потім поруч.
    const called = callDima(alone).state;
    expect(dimaCity(called)).toBeNull();
    expect(called.dima.eta).toBeGreaterThan(alone.minute + 60);
    expect(dimaWithLena({ ...called, minute: called.dima.eta! })).toBe(true);
    expect(() => callDima(called)).toThrow(/в дорозі/);
    // Ніч — і він знову вдома.
    const home = travel({ ...called, minute: called.dima.eta! }, 'vinnytsia').state;
    expect(sleep(home).state.dima.mode).toBe('home');
  });

  it('пам\'ятка — фото в альбом один раз', () => {
    const s = at({ ...newLife(2, 'adult'), city: 'odesa' }, firstDayOfWeek(17) + 5);
    const once = visitSight(s, 'otrada').state;
    expect(once.photos).toEqual(['otrada']);
    expect(visitSight(once, 'otrada').state.photos).toEqual(['otrada']);
  });
});

describe('§6 сейв', () => {
  it('серіалізація — без втрат; ті самі дії дають той самий сейв', () => {
    const play = () => buy(attendStudy(newLife(42, 'school'), [0.7]).state, 'grocery', 'bun').state;
    const s = play();
    expect(parseSave(serialize(s))).toEqual(s);
    // Сейв версії 1 (до Діми-супутника) читається: Діма чекає вдома.
    const old = JSON.parse(serialize(s)) as Record<string, unknown>;
    delete old.dima;
    old.version = 1;
    expect(parseSave(JSON.stringify(old)).dima).toEqual({ mode: 'home', eta: null });
    expect(serialize(play())).toBe(serialize(s));
  });

  it('пошкоджений сейв — помилка з назвою поля, а не тихе нове життя', () => {
    const s = JSON.parse(serialize(newLife(1))) as Record<string, unknown>;
    expect(() => parseSave('{oops')).toThrow(SaveError);
    expect(() => parseSave(JSON.stringify({ ...s, energy: 140 }))).toThrow(/energy/);
    expect(() => parseSave(JSON.stringify({ ...s, owned: ['unicorn'] }))).toThrow(/owned/);
    expect(() => parseSave(JSON.stringify({ ...s, version: 0 }))).toThrow(/версії/);
  });
});
