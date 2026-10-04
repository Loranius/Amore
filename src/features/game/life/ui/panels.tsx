// ============================================================
// Панелі «Дєвочка в городі» (ADR-0239): крамниця, дорога, вакансії, ріелтор,
// шафа, альбом, телефон (стан і налаштування), сумка, побачення, сон,
// мама. Кожна кнопка, якої не можна натиснути, каже чому.
// ============================================================
import { useState, type ReactNode } from 'react';
import { DAY_END_MIN, clockLabel, dayInfo } from '../sim/calendar';
import {
  CITIES,
  CITY_IDS,
  EDUCATION_NAME,
  ITEMS,
  JOBS,
  MAX_HEARTS,
  MODE_NAME,
  PERSON_NAME,
  ROUTES,
  REGION_CITY_IDS,
  SHOP_NAME,
  SIGHTS,
  SKILL_NAME,
  itemById,
  shopStock,
  type CityId,
  type DecorSlot,
  type Item,
  type PersonId,
  type ShopId,
  type SkillId,
} from '../sim/content';
import {
  DATE_PRICE,
  MILESTONES,
  RENT,
  albumProgress,
  askDimaAlong,
  buy,
  callDima,
  dimaWithLena,
  hugDima,
  sendDimaHome,
  canBuy,
  education,
  giveGift,
  goOnDate,
  jobCheck,
  moveHome,
  personNearby,
  quitJob,
  shiftPay,
  studying,
  takeJob,
  today,
  travelCheck,
  wear,
  type DateKind,
  type LifeState,
} from '../sim/life';
import {
  CLOSE_LEVEL,
  COFFEE_PRICE,
  RESIDENT_BY_ID,
  acquainted,
  chat,
  coffeeCheck,
  coffeeWith,
  friendship,
  giftResident,
  lineFor,
  meetResident,
  relationName,
} from '../sim/people';
import {
  BUSINESSES,
  BUSINESS_BY_ID,
  BUSINESS_NEGLECT_DAYS,
  GIGS,
  GIGS_PER_DAY,
  PROPERTIES,
  buyProperty,
  buyPropertyCheck,
  doGig,
  gigCheck,
  gigPay,
  livesIn,
  manageBusiness,
  manageCheck,
  moveToOwned,
  openBusiness,
  openBusinessCheck,
  rentIncome,
  upgradeBusiness,
  upgradeCheck,
  type Business,
} from '../sim/economy';
import { UA_OUTLINE } from '../games/banks';
import type { GameController, Panel } from '../controller';
import { lenaLook } from '../look';
import { isMuted, setMuted } from '../sound';
import { PixelIcon, Portrait } from './pixels';

function Sheet({ title, sub, onClose, children }: { title: string; sub?: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="lg-scrim" onPointerDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <section className="lg-panel lg-sheet" role="dialog" aria-modal="true" aria-label={title}>
        <header className="lg-sheet-head">
          <div>
            <h2>{title}</h2>
            {sub && <small>{sub}</small>}
          </div>
          <button type="button" className="lg-btn is-red is-square" onClick={onClose} aria-label="Закрити"><PixelIcon name="cross" size={3} /></button>
        </header>
        <div className="lg-sheet-body">{children}</div>
      </section>
    </div>
  );
}

function Money({ value }: { value: number }) {
  return <span className="lg-price"><PixelIcon name="coin" size={2} /> {value} ₴</span>;
}

function ItemBadge({ item }: { item: Item }) {
  const icon = { food: 'cake', outfit: 'smile', decor: 'star', book: 'album', gift: 'heart', gadget: 'phone', souvenir: 'star' } as const;
  const tint = item.outfit?.top ?? item.tint;
  return (
    <div className="lg-swatch" style={{ background: tint ?? '#fff4dc' }}>
      {item.kind === 'outfit' ? <span style={{ width: 16, height: 16, background: item.outfit!.bottom, border: '2px solid #5a3218', borderRadius: 3 }} /> : <PixelIcon name={item.kind === 'book' ? 'album' : icon[item.kind]} size={3} />}
    </div>
  );
}

// ------------------------------------------------------------
function ShopPanel({ c, life, shop }: { c: GameController; life: LifeState; shop: ShopId }) {
  const stock = shopStock(shop, life.city, today(life).week);
  return (
    <Sheet title={SHOP_NAME[shop]} sub={`${CITIES[life.city].name} · у гаманці ${life.money} ₴`} onClose={() => c.closePanel()}>
      {stock.length === 0 && <p className="lg-note">Полиці порожні — заходь пізніше.</p>}
      {stock.map((item) => {
        const check = canBuy(life, shop, item.id);
        const owned = life.owned.includes(item.id);
        return (
          <div key={item.id} className={`lg-row${check.ok ? '' : ' is-off'}`}>
            <ItemBadge item={item} />
            <div>
              <div className="lg-row-title">{item.name}</div>
              <div className="lg-row-sub">{item.blurb}{!check.ok && !owned ? ` · ${check.reason}` : ''}</div>
            </div>
            <div style={{ display: 'grid', gap: 4, justifyItems: 'end' }}>
              <Money value={item.price} />
              <button type="button" className="lg-btn is-small" disabled={!check.ok} onClick={() => void c.act((s) => buy(s, shop, item.id))}>
                {owned ? 'Є' : item.kind === 'food' ? 'З\'їсти' : 'Купити'}
              </button>
            </div>
          </div>
        );
      })}
    </Sheet>
  );
}

// ------------------------------------------------------------
function TravelPanel({ c, life }: { c: GameController; life: LifeState }) {
  const [pick, setPick] = useState<CityId | null>(null);
  // Поділля — за замовчуванням, коли Лєна там: на мапі країни три села й
  // місто лягали в одну точку (власник, 2026-10-04).
  const [view, setView] = useState<'region' | 'country'>(CITIES[life.city].local ? 'region' : 'country');
  const W = 300;
  const H = 207;
  const check = pick ? travelCheck(life, pick) : null;
  const choose = (id: CityId) => setPick(id);
  const routeStroke = (mode: string) => (mode === 'train' ? '#8a5a34' : mode === 'bus' ? '#3a6fd8' : '#c9a46a');
  const routeDash = (mode: string) => (mode === 'walk' ? '3 3' : mode === 'bus' ? '6 3' : undefined);
  const marker = (id: CityId, x: number, y: number, big: boolean) => {
    const here = id === life.city;
    const chosen = pick === id;
    const village = CITIES[id].kind === 'village';
    return (
      <g key={id} onClick={() => choose(id)} style={{ cursor: 'pointer' }} role="button" aria-label={CITIES[id].name}>
        {village ? (
          // Хатка: дах і стіна.
          <g transform={`translate(${x},${y})`}>
            <rect x={-6} y={-3} width={12} height={8} fill={here ? '#ff5d8f' : chosen ? '#f2c14e' : '#fff4dc'} stroke="#5a3218" strokeWidth="1.5" />
            <polygon points="-8,-3 0,-10 8,-3" fill="#c0503a" stroke="#5a3218" strokeWidth="1.5" />
          </g>
        ) : (
          // Місто: три будинки різної висоти.
          <g transform={`translate(${x},${y})`}>
            {[[-9, -4, 6, 10], [-3, -9, 7, 15], [4, -6, 6, 12]].map(([bx, by, bw, bh], i) => (
              <rect key={i} x={bx} y={by} width={bw} height={bh} fill={here ? '#ff5d8f' : chosen ? '#f2c14e' : '#fff4dc'} stroke="#5a3218" strokeWidth="1.5" />
            ))}
          </g>
        )}
        <text x={x} y={y - (big ? 16 : 13)} textAnchor="middle" fontSize={big ? 12 : 11} fontWeight="900" fill="#4a2a14" stroke="#fbe7b8" strokeWidth="3" paintOrder="stroke">{CITIES[id].name}</text>
        <circle cx={x} cy={y} r="18" fill="transparent" />
      </g>
    );
  };
  return (
    <Sheet title="Куди поїдемо?" sub={`Зараз: ${CITIES[life.city].name} · ${clockLabel(life.minute)}`} onClose={() => c.closePanel()}>
      <div className="lg-tabs" role="tablist">
        <button type="button" role="tab" aria-selected={view === 'region'} className={`lg-btn is-small${view === 'region' ? '' : ' is-paper'}`} onClick={() => setView('region')}>Поділля</button>
        <button type="button" role="tab" aria-selected={view === 'country'} className={`lg-btn is-small${view === 'country' ? '' : ' is-paper'}`} onClick={() => setView('country')}>Україна</button>
      </div>
      {view === 'country' ? (
        <svg className="lg-map" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Мапа України">
          <polygon points={UA_OUTLINE.map(([x, y]) => `${x * W},${y * H}`).join(' ')} fill="#a8d890" stroke="#4f8a5a" strokeWidth="2" />
          {ROUTES.filter((r) => !(CITIES[r.a].local && CITIES[r.b].local)).map((r) => {
            const a = CITIES[r.a].local ? REGION_DOT : CITIES[r.a].pos;
            const b = CITIES[r.b].local ? REGION_DOT : CITIES[r.b].pos;
            return <line key={`${r.a}-${r.b}`} x1={a[0] * W} y1={a[1] * H} x2={b[0] * W} y2={b[1] * H} stroke={routeStroke(r.mode)} strokeWidth="2" strokeDasharray={routeDash(r.mode)} />;
          })}
          {/* Поділля — одна рамка: торкнись, і відкриється детальна мапа. */}
          <g onClick={() => setView('region')} style={{ cursor: 'pointer' }} role="button" aria-label="Поділля — детальна мапа">
            <rect x={REGION_DOT[0] * W - 22} y={REGION_DOT[1] * H - 14} width="44" height="28" fill="#fff4dc" fillOpacity="0.85" stroke="#5a3218" strokeWidth="2" strokeDasharray="4 2" />
            <text x={REGION_DOT[0] * W} y={REGION_DOT[1] * H + 4} textAnchor="middle" fontSize="10" fontWeight="900" fill="#4a2a14">Поділля</text>
          </g>
          {CITY_IDS.filter((id) => !CITIES[id].local).map((id) => marker(id, CITIES[id].pos[0] * W, CITIES[id].pos[1] * H, false))}
        </svg>
      ) : (
        <svg className="lg-map" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Мапа Поділля">
          <rect x="0" y="0" width={W} height={H} fill="#b9e09a" />
          {/* Поля й ліс — щоб мапа не була порожньою. */}
          {REGION_FIELDS.map(([x, y, w, h, fill], i) => <rect key={i} x={x * W} y={y * H} width={w * W} height={h * H} fill={fill} opacity="0.75" />)}
          {REGION_FOREST.map(([x, y], i) => (
            <g key={i} transform={`translate(${x * W},${y * H})`}><circle r="5" fill="#4f9a4a" /><rect x="-1" y="3" width="2" height="4" fill="#6e4426" /></g>
          ))}
          {/* Південний Буг і ставок у Жилинцях. */}
          <path d={`M ${0.55 * W} 0 C ${0.6 * W} ${0.3 * H}, ${0.75 * W} ${0.3 * H}, ${0.78 * W} ${0.62 * H} S ${0.9 * W} ${0.95 * H}, ${W} ${H}`} fill="none" stroke="#5aa8e0" strokeWidth="5" />
          <ellipse cx={0.31 * W} cy={0.69 * H} rx="9" ry="5" fill="#5aa8e0" />
          {ROUTES.filter((r) => CITIES[r.a].local && CITIES[r.b].local).map((r) => {
            const a = CITIES[r.a].local!;
            const b = CITIES[r.b].local!;
            return <line key={`${r.a}-${r.b}`} x1={a[0] * W} y1={a[1] * H} x2={b[0] * W} y2={b[1] * H} stroke={routeStroke(r.mode)} strokeWidth={r.mode === 'train' ? 4 : 3} strokeDasharray={routeDash(r.mode)} />;
          })}
          {/* Залізниця далі: стрілки до міст поза Поділлям. */}
          {ROUTES.filter((r) => Boolean(CITIES[r.a].local) !== Boolean(CITIES[r.b].local)).map((r) => {
            const inside = CITIES[r.a].local ? r.a : r.b;
            const outside = inside === r.a ? r.b : r.a;
            const from = CITIES[inside].local!;
            const dx = CITIES[outside].pos[0] - CITIES[inside].pos[0];
            const dy = CITIES[outside].pos[1] - CITIES[inside].pos[1];
            const l = Math.hypot(dx, dy) || 1;
            const to: [number, number] = [from[0] + (dx / l) * 0.17, from[1] + (dy / l) * 0.17];
            return (
              <g key={`${r.a}-${r.b}`} onClick={() => choose(outside)} style={{ cursor: 'pointer' }}>
                <line x1={from[0] * W} y1={from[1] * H} x2={to[0] * W} y2={to[1] * H} stroke={routeStroke(r.mode)} strokeWidth="3" strokeDasharray="2 2" />
                <text x={to[0] * W} y={to[1] * H + (dy > 0 ? 12 : -4)} textAnchor="middle" fontSize="9" fontWeight="800" fill="#4a2a14" stroke="#fbe7b8" strokeWidth="2.5" paintOrder="stroke">→ {CITIES[outside].name}</text>
              </g>
            );
          })}
          {REGION_CITY_IDS.map((id) => marker(id, CITIES[id].local![0] * W, CITIES[id].local![1] * H, true))}
        </svg>
      )}
      {/* Список — завжди: місто можна обрати й без влучання в мапу. */}
      <div className="lg-city-list">
        {CITY_IDS.map((id) => (
          <button key={id} type="button" className={`lg-btn is-small${pick === id ? '' : ' is-paper'}`} disabled={id === life.city} onClick={() => choose(id)}>{CITIES[id].name}</button>
        ))}
      </div>
      {!pick && <p className="lg-note">Обери місто на мапі або в списку.</p>}
      {pick && check && (
        <div className="lg-row" style={{ gridTemplateColumns: '1fr auto' }}>
          <div>
            <div className="lg-row-title">{CITIES[pick].name}</div>
            <div className="lg-row-sub">{CITIES[pick].blurb}</div>
            {check.ok && (
              <div className="lg-row-sub">
                {check.plan.legs.map((l) => MODE_NAME[l.mode]).join(' → ')} · {Math.round(check.plan.minutes / 6) / 10} год · {check.withMom ? 'з мамою, мама платить' : `${check.plan.price} ₴`}
              </div>
            )}
            {!check.ok && <div className="lg-row-sub" style={{ color: '#b8323a' }}>{check.reason}</div>}
          </div>
          <button type="button" className="lg-btn" disabled={!check.ok} onClick={() => void c.goTo(pick)}>Їхати</button>
        </div>
      )}
    </Sheet>
  );
}

/** Де Поділля на мапі країни: середина його міст. */
const REGION_DOT: [number, number] = [0.31, 0.39];
const REGION_FIELDS: [number, number, number, number, string][] = [
  [0.05, 0.4, 0.14, 0.12, '#e8d27a'], [0.32, 0.3, 0.16, 0.1, '#d9e88a'], [0.55, 0.7, 0.18, 0.14, '#e8d27a'],
  [0.08, 0.78, 0.2, 0.12, '#cfe58a'], [0.6, 0.08, 0.14, 0.12, '#d9e88a'],
];
const REGION_FOREST: [number, number][] = [
  [0.44, 0.52], [0.47, 0.56], [0.5, 0.51], [0.66, 0.24], [0.69, 0.28], [0.08, 0.2], [0.11, 0.24], [0.62, 0.84], [0.93, 0.2], [0.9, 0.25],
];

// ------------------------------------------------------------
function JobsPanel({ c, life, focus }: { c: GameController; life: LifeState; focus?: string | undefined }) {
  const jobs = [...JOBS].sort((a, b) => (a.id === focus ? -1 : b.id === focus ? 1 : 0));
  const edu = education(life);
  return (
    <Sheet title="Робота" sub={`Освіта: ${EDUCATION_NAME[edu]}${studying(life) ? ' · поки вчишся — лише підробіток' : ''}`} onClose={() => c.closePanel()}>
      {life.job && (
        <div className="lg-row" style={{ gridTemplateColumns: '1fr auto', background: '#e8f6dc' }}>
          <div>
            <div className="lg-row-title">Зараз: {c.shiftJobTitle()}</div>
            <div className="lg-row-sub">Змін відпрацьовано: {life.job.shifts}</div>
          </div>
          <button type="button" className="lg-btn is-small is-paper" onClick={() => void c.act(quitJob)}>Звільнитись</button>
        </div>
      )}
      {jobs.map((job) => {
        const check = jobCheck(life, job);
        const mine = life.job?.id === job.id;
        const here = life.city === job.city;
        return (
          <div key={job.id} className={`lg-row${check.ok ? '' : ' is-off'}`} style={{ gridTemplateColumns: '1fr auto' }}>
            <div>
              <div className="lg-row-title">{job.title}</div>
              <div className="lg-row-sub">{job.place} · {CITIES[job.city].name} · {job.blurb}</div>
              <div>
                <span className="lg-tag">{shiftPay(job, 0, 0.8, 60)} ₴ за зміну</span>
                <span className={`lg-tag ${EDUCATION_NAME[job.education] && (job.education === 'none' || edu === 'diploma' || (edu === 'school' && job.education === 'school')) ? 'is-ok' : 'is-no'}`}>{EDUCATION_NAME[job.education]}</span>
                {Object.entries(job.skills ?? {}).map(([k, v]) => (
                  <span key={k} className={`lg-tag ${life.skills[k as SkillId] >= v ? 'is-ok' : 'is-no'}`}>{SKILL_NAME[k as SkillId]} {v}+</span>
                ))}
                {job.partTime && <span className="lg-tag">можна підробляти</span>}
              </div>
              {!check.ok && <div className="lg-row-sub" style={{ color: '#b8323a' }}>{check.reason}</div>}
            </div>
            {mine ? <span className="lg-tag is-ok">Твоя робота</span> : (
              <button type="button" className="lg-btn is-small" disabled={!check.ok || !here} onClick={() => void c.act((s) => takeJob(s, job.id))} title={here ? '' : `Співбесіда — у місті ${CITIES[job.city].name}`}>
                {here ? 'Влаштуватися' : CITIES[job.city].name}
              </button>
            )}
          </div>
        );
      })}
    </Sheet>
  );
}

// ------------------------------------------------------------
function RealtorPanel({ c, life }: { c: GameController; life: LifeState }) {
  const rent = life.flags.livingWithDima ? Math.round(RENT[life.city] * 0.6) : RENT[life.city];
  const can = !studying(life) && life.home !== life.city && life.money >= rent;
  const here = PROPERTIES.filter((p) => p.city === life.city);
  const mine = PROPERTIES.filter((p) => life.properties.includes(p.id));
  const biz = BUSINESSES.filter((b) => b.city === life.city);
  return (
    <Sheet title="Нерухомість і справи" sub={`Зараз живеш: ${life.homeName}${life.rent ? ` · оренда ${life.rent} ₴/тиждень` : ' · без оренди'}`} onClose={() => c.closePanel()}>
      <h3 style={{ margin: 0 }}>Оренда</h3>
      <p className="lg-note">Оренда списується щотижня. {life.flags.livingWithDima ? 'Удвох із Дімою — платите навпіл (60% ціни на тебе).' : ''}</p>
      <div className="lg-row" style={{ gridTemplateColumns: '1fr auto' }}>
        <div>
          <div className="lg-row-title">Квартира: {CITIES[life.city].name}</div>
          <div className="lg-row-sub">{rent} ₴ на тиждень · застава {rent} ₴</div>
          {studying(life) && <div className="lg-row-sub" style={{ color: '#b8323a' }}>Переїзд — після диплома</div>}
          {life.home === life.city && <div className="lg-row-sub">Ти вже тут живеш</div>}
        </div>
        <button type="button" className="lg-btn" disabled={!can} onClick={() => void c.act((s) => moveHome(s, s.city))}>Орендувати</button>
      </div>

      <h3 style={{ margin: '6px 0 0' }}>Купити житло</h3>
      {here.length === 0 && <p className="lg-note">У цьому місті житла на продаж немає.</p>}
      {here.map((p) => {
        const owned = life.properties.includes(p.id);
        const check = buyPropertyCheck(life, p.id);
        const living = owned && livesIn(life, p.id);
        return (
          <div key={p.id} className="lg-row" style={{ gridTemplateColumns: '1fr auto' }}>
            <div>
              <div className="lg-row-title">{p.name}</div>
              <div className="lg-row-sub">{p.blurb} · здавати: +{p.rentOut} ₴/тиждень</div>
              {!owned && !check.ok && <div className="lg-row-sub" style={{ color: '#b8323a' }}>{check.reason}</div>}
            </div>
            {!owned
              ? <div style={{ display: 'grid', gap: 4, justifyItems: 'end' }}><Money value={p.price} /><button type="button" className="lg-btn is-small" disabled={!check.ok} onClick={() => void c.act((s) => buyProperty(s, p.id))}>Купити</button></div>
              : living
                ? <span className="lg-tag is-ok">Твій дім</span>
                : <button type="button" className="lg-btn is-small is-green" onClick={() => void c.act((s) => moveToOwned(s, p.id))}>Переїхати</button>}
          </div>
        );
      })}
      {mine.length > 0 && (
        <p className="lg-note">Твоє житло: {mine.map((p) => p.name).join(' · ')}. Порожнє здається — квартиранти платять щотижня (зараз +{rentIncome(life)} ₴).</p>
      )}

      {biz.length > 0 && <h3 style={{ margin: '6px 0 0' }}>Своя справа</h3>}
      {biz.map((b) => <BusinessRow key={b.id} c={c} life={life} b={b} />)}
      <p className="lg-note">Інші міста — інше житло й інші справи. Інтернет-магазин відкривається з ноутбука вдома.</p>
    </Sheet>
  );
}

/** Рядок справи: відкрити, навідатися, розвинути. */
function BusinessRow({ c, life, b }: { c: GameController; life: LifeState; b: Business }) {
  const owned = life.businesses.find((x) => x.id === b.id);
  if (!owned) {
    const check = openBusinessCheck(life, b.id);
    return (
      <div className="lg-row" style={{ gridTemplateColumns: '1fr auto' }}>
        <div>
          <div className="lg-row-title">{b.name}</div>
          <div className="lg-row-sub">{b.blurb} · від {b.income[0]} ₴ за день</div>
          {!check.ok && <div className="lg-row-sub" style={{ color: '#b8323a' }}>{check.reason}</div>}
        </div>
        <div style={{ display: 'grid', gap: 4, justifyItems: 'end' }}>
          <Money value={b.open} />
          <button type="button" className="lg-btn is-small" disabled={!check.ok} onClick={() => void c.act((s) => openBusiness(s, b.id))}>Відкрити</button>
        </div>
      </div>
    );
  }
  const manage = manageCheck(life, b.id);
  const up = upgradeCheck(life, b.id);
  const idle = life.day - owned.visited > BUSINESS_NEGLECT_DAYS;
  return (
    <div className="lg-row" style={{ gridTemplateColumns: '1fr auto', background: '#e8f6dc' }}>
      <div>
        <div className="lg-row-title">{b.name} · {b.levels[owned.level - 1]}</div>
        <div className="lg-row-sub">~{b.income[owned.level - 1]} ₴ за день{idle ? ' · без хазяйки — пів доходу' : ''}</div>
        {!manage.ok && <div className="lg-row-sub">{manage.reason}</div>}
      </div>
      <div style={{ display: 'grid', gap: 4, justifyItems: 'end' }}>
        <button type="button" className="lg-btn is-small is-green" disabled={!manage.ok} onClick={() => void c.act((s) => manageBusiness(s, b.id))}>Навідатись</button>
        {owned.level < 3 && <button type="button" className="lg-btn is-small is-paper" disabled={!up.ok} onClick={() => void c.act((s) => upgradeBusiness(s, b.id))} title={up.ok ? '' : up.reason}>Розвинути · {b.upgrade[owned.level - 1]} ₴</button>}
      </div>
    </div>
  );
}

// ------------------------------------------------------------
/**
 * Розмова з мешканцем (знайомства, 2026-10-04): познайомитись, поговорити,
 * подарувати, а з подругою чи другом — кава вдвох.
 */
function PersonPanel({ c, life, id }: { c: GameController; life: LifeState; id: string }) {
  const r = RESIDENT_BY_ID.get(id)!;
  const known = acquainted(life, id);
  const level = friendship(life, id);
  const talked = life.doneToday.includes(`talk:${id}`);
  const coffee = coffeeCheck(life, id);
  const gifts = [...new Set(life.gifts)];
  return (
    <Sheet title={known ? r.name : r.female ? 'Незнайомка' : 'Незнайомець'} sub={known ? `${r.role} · ${relationName(life, id)}` : r.role} onClose={() => c.closePanel()}>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 12 }}>
        <Portrait look={lenaLook(life)} scale={4} />
        <Portrait look={c.residentLook(id)} scale={4} />
      </div>
      <p className="lg-quote">«{lineFor(life, id)}»</p>
      {known && <Hearts n={level} />}
      <div style={{ display: 'grid', gap: 8 }}>
        {!known
          ? <button type="button" className="lg-btn is-pink" onClick={() => void c.act((s) => meetResident(s, id))}>Познайомитись</button>
          : <button type="button" className="lg-btn" disabled={talked} onClick={() => void c.act((s) => chat(s, id))}>{talked ? 'Сьогодні вже говорили' : 'Поговорити'}</button>}
        {known && (
          <button type="button" className="lg-btn is-paper" disabled={!coffee.ok} onClick={() => void c.act((s) => coffeeWith(s, id))} title={coffee.ok ? '' : coffee.reason}>
            Запросити на каву · {COFFEE_PRICE} ₴{coffee.ok ? '' : ` — ${coffee.reason}`}
          </button>
        )}
        {known && gifts.length > 0 && !life.doneToday.includes(`gift:${id}`) && (
          <div className="lg-city-list">
            {gifts.map((g) => (
              <button key={g} type="button" className="lg-btn is-small is-paper" onClick={() => void c.act((s) => giftResident(s, id, g))}>Подарувати: {itemById(g).name}</button>
            ))}
          </div>
        )}
      </div>
      {known && level >= CLOSE_LEVEL && <p className="lg-note">Близька дружба: кожна розмова вчить ({SKILL_NAME[r.teaches].toLowerCase()} +1).</p>}
    </Sheet>
  );
}

// ------------------------------------------------------------
/** Ноутбук удома: замовлення онлайн і свій інтернет-магазин. */
function LaptopPanel({ c, life }: { c: GameController; life: LifeState }) {
  const left = GIGS_PER_DAY - life.doneToday.filter((d) => d === 'gig').length;
  return (
    <Sheet title="Ноутбук" sub={`Замовлень сьогодні ще: ${left} · ${clockLabel(life.minute)}`} onClose={() => c.closePanel()}>
      <h3 style={{ margin: 0 }}>Робота онлайн</h3>
      {GIGS.map((g) => {
        const check = gigCheck(life, g);
        return (
          <div key={g.id} className={`lg-row${check.ok ? '' : ' is-off'}`} style={{ gridTemplateColumns: '1fr auto' }}>
            <div>
              <div className="lg-row-title">{g.title}</div>
              <div className="lg-row-sub">{g.blurb} · {Math.round(g.minutes / 6) / 10} год · {SKILL_NAME[g.skill]} {g.need}+</div>
              {!check.ok && <div className="lg-row-sub" style={{ color: '#b8323a' }}>{check.reason}</div>}
            </div>
            <div style={{ display: 'grid', gap: 4, justifyItems: 'end' }}>
              <Money value={gigPay(life, g)} />
              <button type="button" className="lg-btn is-small" disabled={!check.ok} onClick={() => void c.act((s) => doGig(s, g.id))}>Взятись</button>
            </div>
          </div>
        );
      })}
      <h3 style={{ margin: '6px 0 0' }}>Свої справи</h3>
      <BusinessRow c={c} life={life} b={BUSINESS_BY_ID.get('shop')!} />
      {life.businesses.filter((b) => b.id !== 'shop').map((owned) => {
        const b = BUSINESS_BY_ID.get(owned.id)!;
        return (
          <div key={b.id} className="lg-tile">
            <span>{b.name} · {b.levels[owned.level - 1]}</span>
            <span>Навідатись — на місці: {b.city ? CITIES[b.city].name : ''}</span>
          </div>
        );
      })}
    </Sheet>
  );
}

// ------------------------------------------------------------
const DECOR_NAME: Record<DecorSlot, string> = {
  bed: 'Ліжко', rug: 'Килим', plant: 'Вазон', lamp: 'Лампа', poster: 'Постер', shelf: 'Полиця', tv: 'Телевізор', pet: 'Улюбленець', table: 'Стіл', desk: 'Письмовий стіл', sofa: 'Диван',
};

/** Облаштування: переставити кожну річ стрілками. */
function DecoratePanel({ c, life }: { c: GameController; life: LifeState }) {
  const slots = (['bed', ...(Object.keys(life.decor) as DecorSlot[]).filter((s) => s !== 'bed')] as DecorSlot[]);
  return (
    <Sheet title="Облаштувати кімнату" sub={life.homeName} onClose={() => c.closePanel()}>
      <p className="lg-note">Переставляй меблі стрілками — кімната змінюється одразу. Нові речі — у «Дім і затишок».</p>
      {slots.map((slot) => (
        <div key={slot} className="lg-row" style={{ gridTemplateColumns: '1fr auto' }}>
          <div>
            <div className="lg-row-title">{DECOR_NAME[slot]}</div>
            <div className="lg-row-sub">{life.decor[slot] ? itemById(life.decor[slot]!).name : 'Звичайне'}</div>
          </div>
          <div className="lg-arrows">
            <button type="button" className="lg-btn is-small is-paper" aria-label="Вліво" onClick={() => c.rearrange(slot, -1, 0)}>←</button>
            <button type="button" className="lg-btn is-small is-paper" aria-label="Вгору" onClick={() => c.rearrange(slot, 0, -1)}>↑</button>
            <button type="button" className="lg-btn is-small is-paper" aria-label="Вниз" onClick={() => c.rearrange(slot, 0, 1)}>↓</button>
            <button type="button" className="lg-btn is-small is-paper" aria-label="Вправо" onClick={() => c.rearrange(slot, 1, 0)}>→</button>
          </div>
        </div>
      ))}
    </Sheet>
  );
}

// ------------------------------------------------------------
function WardrobePanel({ c, life }: { c: GameController; life: LifeState }) {
  const outfits = life.owned.filter((id) => itemById(id).kind === 'outfit');
  return (
    <Sheet title="Шафа" sub="Що вдягнути сьогодні?" onClose={() => c.closePanel()}>
      <div style={{ display: 'grid', placeItems: 'center', padding: 6, background: 'linear-gradient(#bfe3f5,#e8f4fb)', border: '3px solid #5a3218', borderRadius: 6 }}>
        <Portrait look={lenaLook(life)} scale={6} crop={false} />
      </div>
      <div className="lg-grid">
        <button type="button" className={`lg-btn is-paper${life.outfit === null ? ' is-green' : ''}`} onClick={() => c.commitWear(wear(life, null))}>Звичайний одяг</button>
        {outfits.map((id) => (
          <button key={id} type="button" className={`lg-btn is-paper${life.outfit === id ? ' is-green' : ''}`} onClick={() => c.commitWear(wear(life, id))}>{itemById(id).name}</button>
        ))}
      </div>
      {outfits.length === 0 && <p className="lg-note">Новий одяг продають у містах — у крамниці «Одяг».</p>}
    </Sheet>
  );
}

// ------------------------------------------------------------
function AlbumPanel({ c, life }: { c: GameController; life: LifeState }) {
  const { done, total } = albumProgress(life);
  const souvenirs = ITEMS.filter((i) => i.kind === 'souvenir');
  return (
    <Sheet title="Альбом життя" sub={`Зібрано ${done} з ${total}`} onClose={() => c.closePanel()}>
      <div className="lg-meter-bar" style={{ height: 12 }}><div className="lg-meter-fill" style={{ width: `${(done / total) * 100}%`, background: '#ff7aa8' }} /></div>
      <h3 style={{ margin: '6px 0 0' }}>Віхи</h3>
      <div className="lg-grid">
        {MILESTONES.map((m) => {
          const got = life.milestones.includes(m.id);
          return (
            <div key={m.id} className={`lg-tile${got ? '' : ' is-locked'}`}>
              <span>{got ? <PixelIcon name="star" /> : '?'} {got ? m.title : '…'}</span>
              {got && <span style={{ fontWeight: 700, fontSize: 12 }}>{m.text}</span>}
            </div>
          );
        })}
      </div>
      <h3 style={{ margin: '6px 0 0' }}>Фото</h3>
      <div className="lg-grid">
        {SIGHTS.map((s) => {
          const got = life.photos.includes(s.id);
          return <div key={s.id} className={`lg-tile${got ? '' : ' is-locked'}`}>{got ? s.name : '???'}<span style={{ fontWeight: 700, fontSize: 11 }}>{CITIES[s.city].name}</span></div>;
        })}
      </div>
      <h3 style={{ margin: '6px 0 0' }}>Сувеніри й одяг</h3>
      <div className="lg-grid">
        {souvenirs.map((s) => <div key={s.id} className={`lg-tile${life.owned.includes(s.id) ? '' : ' is-locked'}`}>{life.owned.includes(s.id) ? s.name : '???'}</div>)}
        {ITEMS.filter((i) => i.kind === 'outfit').map((s) => <div key={s.id} className={`lg-tile${life.owned.includes(s.id) ? '' : ' is-locked'}`}>{life.owned.includes(s.id) ? s.name : '???'}</div>)}
      </div>
      {life.marks.length > 0 && (
        <>
          <h3 style={{ margin: '6px 0 0' }}>Оцінки за роки</h3>
          <div className="lg-grid">
            {life.marks.map((m) => {
              const info = dayInfo(m.week * 7);
              return <div key={m.week} className="lg-tile">{info.stage === 'uni' ? `${info.level} курс` : `${info.level} клас`}<span style={{ fontSize: 18 }}>{m.mark}</span></div>;
            })}
          </div>
        </>
      )}
    </Sheet>
  );
}

// ------------------------------------------------------------
function Hearts({ n }: { n: number }) {
  return (
    <span className="lg-hearts" aria-label={`${Math.floor(n)} з ${MAX_HEARTS}`}>
      {Array.from({ length: MAX_HEARTS }, (_, i) => <span key={i} style={{ opacity: i < Math.floor(n) ? 1 : 0.22 }}><PixelIcon name="heart" size={2} /></span>)}
    </span>
  );
}

function PhonePanel({ c, life }: { c: GameController; life: LifeState }) {
  const info = today(life);
  const [muted, setMute] = useState(isMuted());
  const avg = life.marks.length ? Math.round((life.marks.reduce((a, m) => a + m.mark, 0) / life.marks.length) * 10) / 10 : null;
  return (
    <Sheet title="Телефон" sub={`Лєні ${info.age} · ${info.schoolYear}`} onClose={() => c.closePanel()}>
      <div className="lg-bars">
        {(Object.keys(SKILL_NAME) as SkillId[]).map((k) => (
          <div key={k}>
            <div className="lg-row-title" style={{ fontSize: 13 }}>{SKILL_NAME[k]} · {life.skills[k]}</div>
            <div className="lg-meter-bar"><div className="lg-meter-fill" style={{ width: `${life.skills[k]}%`, background: '#7fb8e8' }} /></div>
          </div>
        ))}
      </div>
      {(['mom', 'friend', 'dima'] as PersonId[]).filter((p) => p !== 'dima' || life.flags.metDima).map((p) => (
        <div key={p} className="lg-row" style={{ gridTemplateColumns: '1fr auto' }}>
          <div className="lg-row-title">{c.personName(p)}</div>
          <Hearts n={life.hearts[p]} />
        </div>
      ))}
      {life.flags.metDima && (
        <div className="lg-row" style={{ gridTemplateColumns: '1fr auto' }}>
          <div>
            <div className="lg-row-title">Подзвонити Дімі</div>
            <div className="lg-row-sub">
              {dimaWithLena(life) ? 'Він поруч' : life.dima.mode === 'follow' && life.dima.eta !== null ? `Уже в дорозі · буде о ${clockLabel(life.dima.eta)}` : 'Попросити прийти до тебе'}
            </div>
          </div>
          <button type="button" className="lg-btn is-pink is-small" disabled={life.dima.mode === 'follow'} onClick={() => { c.closePanel(); void c.act(callDima); }}>Дзвонити</button>
        </div>
      )}
      {Object.keys(life.people).length > 0 && (
        <>
          <h3 style={{ margin: 0 }}>Знайомі</h3>
          {Object.entries(life.people).sort((a, b) => b[1] - a[1]).map(([pid, level]) => (
            <div key={pid} className="lg-row" style={{ gridTemplateColumns: '1fr auto' }}>
              <div>
                <div className="lg-row-title">{RESIDENT_BY_ID.get(pid)?.name}</div>
                <div className="lg-row-sub">{relationName(life, pid)} · {CITIES[RESIDENT_BY_ID.get(pid)!.city].name}</div>
              </div>
              <Hearts n={level} />
            </div>
          ))}
        </>
      )}
      {(life.businesses.length > 0 || life.properties.length > 0) && (
        <div className="lg-tile">
          {life.businesses.map((owned) => <span key={owned.id}>{BUSINESS_BY_ID.get(owned.id)!.name} · рівень {owned.level}</span>)}
          {life.properties.length > 0 && <span>Своє житло: {life.properties.length} · здача +{rentIncome(life)} ₴/тиждень</span>}
        </div>
      )}
      <div className="lg-tile">
        <span>Освіта: {EDUCATION_NAME[education(life)]}{avg !== null ? ` · середній бал ${avg}` : ''}</span>
        <span>Робота: {c.shiftJobTitle() ?? '—'}</span>
        <span>Дім: {life.homeName}{life.rent ? ` · ${life.rent} ₴/тиждень` : ''}</span>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button type="button" className="lg-btn is-paper" onClick={() => { setMuted(!muted); setMute(!muted); }}>{muted ? 'Звук: вимкнено' : 'Звук: увімкнено'}</button>
        <button type="button" className="lg-btn is-paper" onClick={() => c.toTitle()}>Головне меню</button>
      </div>
      <p className="lg-note">Гра зберігається сама після кожної дії.</p>
    </Sheet>
  );
}

// ------------------------------------------------------------
function BagPanel({ c, life }: { c: GameController; life: LifeState }) {
  const counts = new Map<string, number>();
  for (const g of life.gifts) counts.set(g, (counts.get(g) ?? 0) + 1);
  const people: PersonId[] = ['mom', 'friend', 'dima'];
  const keep = life.owned.filter((id) => ['book', 'gadget', 'souvenir'].includes(itemById(id).kind));
  return (
    <Sheet title="Сумка" sub={`${life.money} ₴`} onClose={() => c.closePanel()}>
      <h3 style={{ margin: 0 }}>Подарунки</h3>
      {counts.size === 0 && <p className="lg-note">Подарунки купують у «Квіти й подарунки» та «Техніка».</p>}
      {[...counts.entries()].map(([id, n]) => (
        <div key={id} className="lg-row" style={{ gridTemplateColumns: '44px 1fr' }}>
          <ItemBadge item={itemById(id)} />
          <div>
            <div className="lg-row-title">{itemById(id).name} × {n}</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
              {people.filter((p) => p !== 'dima' || life.flags.metDima).map((p) => (
                <button key={p} type="button" className="lg-btn is-small is-pink" disabled={!personNearby(life, p) || life.doneToday.includes(`gift:${p}`)} onClick={() => void c.act((s) => giveGift(s, p, id))}>{PERSON_NAME[p]}</button>
              ))}
            </div>
          </div>
        </div>
      ))}
      <h3 style={{ margin: '6px 0 0' }}>Речі</h3>
      <div className="lg-grid">{keep.map((id) => <div key={id} className="lg-tile">{itemById(id).name}<span style={{ fontWeight: 700, fontSize: 11 }}>{itemById(id).blurb}</span></div>)}</div>
      {keep.length === 0 && <p className="lg-note">Поки порожньо.</p>}
    </Sheet>
  );
}

// ------------------------------------------------------------
function DatePanel({ c, life }: { c: GameController; life: LifeState }) {
  const options: [DateKind, string, string][] = [['walk', 'Прогулянка', 'Безкоштовно · +½ серця'], ['cafe', 'Кава й десерт', `${DATE_PRICE.cafe} ₴ · +1 серце`], ['cinema', 'Кіно', `${DATE_PRICE.cinema} ₴ · +1 серце`]];
  const done = life.doneToday.includes('date');
  return (
    <Sheet title="Побачення з Дімою" sub={done ? 'Сьогодні вже бачились — завтра ще' : 'Куди підемо?'} onClose={() => c.closePanel()}>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 12 }}>
        <Portrait look={lenaLook(life)} scale={4} />
        <Portrait look={c.dimaLook()} scale={4} />
      </div>
      <Hearts n={life.hearts.dima} />
      {options.map(([kind, title, sub]) => (
        <div key={kind} className="lg-row" style={{ gridTemplateColumns: '1fr auto' }}>
          <div>
            <div className="lg-row-title">{title}</div>
            <div className="lg-row-sub">{sub}</div>
          </div>
          <button type="button" className="lg-btn is-pink" disabled={done || life.money < DATE_PRICE[kind]} onClick={() => void c.date(kind, (s) => goOnDate(s, kind))}>Іти</button>
        </div>
      ))}
    </Sheet>
  );
}

// ------------------------------------------------------------
/**
 * Розмова з Дімою (власник, 2026-10-04): він іде з Лєною лише тоді, коли
 * вона попросить, і йде додому чекати, коли вона скаже.
 */
function DimaPanel({ c, life }: { c: GameController; life: LifeState }) {
  const along = dimaWithLena(life);
  return (
    <Sheet title="Діма" sub={along ? 'Ходить із тобою' : 'Чекає вдома'} onClose={() => c.closePanel()}>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 12 }}>
        <Portrait look={lenaLook(life)} scale={4} />
        <Portrait look={c.dimaLook()} scale={4} />
      </div>
      <Hearts n={life.hearts.dima} />
      <div style={{ display: 'grid', gap: 8 }}>
        {along && <button type="button" className="lg-btn is-pink" disabled={life.doneToday.includes('hug')} onClick={() => void c.act(hugDima)}>Обійняти</button>}
        {along
          ? <button type="button" className="lg-btn" onClick={() => { c.closePanel(); void c.act(sendDimaHome); }}>«Йди додому, я пізніше»</button>
          : <button type="button" className="lg-btn" onClick={() => { c.closePanel(); void c.act(askDimaAlong); }}>«Ходімо зі мною»</button>}
        {along && <button type="button" className="lg-btn is-paper" onClick={() => c.openPanel({ kind: 'date' })}>Побачення…</button>}
      </div>
    </Sheet>
  );
}

// ------------------------------------------------------------
function SleepPanel({ c, life }: { c: GameController; life: LifeState }) {
  const late = life.minute > 24 * 60;
  return (
    <Sheet title="Лягти спати?" sub={`Зараз ${clockLabel(life.minute)} · до півночі сон відновлює всі сили`} onClose={() => c.closePanel()}>
      <p className="lg-note">{late ? 'Вже за північ — зранку буде важкувато.' : life.minute < 18 * 60 ? 'Ще світло надворі. Може, погуляти?' : 'Гарний час для сну.'}</p>
      <p className="lg-note">Залишок дня: {Math.max(0, Math.round((DAY_END_MIN - life.minute) / 60))} год.</p>
      <button type="button" className="lg-btn" onClick={() => void c.goToSleep()}>Спати до ранку</button>
    </Sheet>
  );
}

// ------------------------------------------------------------
function MomPanel({ c, life }: { c: GameController; life: LifeState }) {
  return (
    <Sheet title="Мама" sub="Рідна хата в Жилинцях" onClose={() => c.closePanel()}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <div className="lg-portrait"><Portrait look={c.momLook()} scale={4} /></div>
        <Hearts n={life.hearts.mom} />
      </div>
      <button type="button" className="lg-btn is-paper" onClick={() => { c.closePanel(); void c.say(c.momLines()); }}>Поговорити</button>
      <button type="button" className="lg-btn is-paper" onClick={() => c.openPanel({ kind: 'bag' })}>Подарувати щось…</button>
    </Sheet>
  );
}

export function Panels({ c, life, panel }: { c: GameController; life: LifeState; panel: Panel }) {
  switch (panel.kind) {
    case 'shop': return <ShopPanel c={c} life={life} shop={panel.shop} />;
    case 'travel': return <TravelPanel c={c} life={life} />;
    case 'jobs': return <JobsPanel c={c} life={life} focus={panel.focus} />;
    case 'realtor': return <RealtorPanel c={c} life={life} />;
    case 'wardrobe': return <WardrobePanel c={c} life={life} />;
    case 'album': return <AlbumPanel c={c} life={life} />;
    case 'phone': return <PhonePanel c={c} life={life} />;
    case 'bag': return <BagPanel c={c} life={life} />;
    case 'date': return <DatePanel c={c} life={life} />;
    case 'sleep': return <SleepPanel c={c} life={life} />;
    case 'mom': return <MomPanel c={c} life={life} />;
    case 'dima': return <DimaPanel c={c} life={life} />;
    case 'laptop': return <LaptopPanel c={c} life={life} />;
    case 'person': return <PersonPanel c={c} life={life} id={panel.id} />;
    case 'decorate': return <DecoratePanel c={c} life={life} />;
  }
}
