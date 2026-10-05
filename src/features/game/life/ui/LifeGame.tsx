// ============================================================
// «Дєвочка в городі» — корінь інтерфейсу (ADR-0239): полотно світу й усе,
// що лежить над ним (годинник, гроші, сили, кнопка дії, діалоги,
// картки, панелі, титул).
// ============================================================
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { freshSeed } from '@/lib/entropy';
import { SEASON_NAME, clockLabel, dayInfo } from '../sim/calendar';
import { CHAPTER_WEEK, type Chapter } from '../sim/life';
import { GameController, type Speaker } from '../controller';
import { lenaLook } from '../look';
import { DIMA, MOM, OLYA, type Look } from '../render/people';
import type { Zone } from '../world/types';
import { Panels } from './panels';
import { PixelIcon, Portrait } from './pixels';
import './game.css';

const VERB: Record<Zone['action']['type'], string> = {
  duty: 'Зайти', workplace: 'Зайти', home: 'Додому', bed: 'Спати', exit: 'Вийти', station: 'Квитки', shop: 'Зайти',
  sight: 'Фото', jobs: 'Вакансії', realtor: 'Квартири', friends: 'Гратися', date: 'Побачення', lyceum: 'Зайти',
  stone: 'Підійти', mom: 'Мама', walk: 'Іти', wardrobe: 'Шафа', info: 'Глянути', talk: 'Поговорити', laptop: 'Ноутбук', decorate: 'Облаштувати', activity: 'Почати',
  yard: 'Подвір\'я', village: 'У село', dog: 'Бася', kitchen: 'Зайти',
};

const NAME: Record<Speaker, string> = { n: '', l: 'Лєна', d: 'Діма', m: 'Мама', o: 'Оля' };

export function LifeGame() {
  const controller = useMemo(() => new GameController(), []);
  useSyncExternalStore(controller.subscribe, controller.snapshot);
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => (canvas.current ? controller.attach(canvas.current) : undefined), [controller]);
  // Лише в розробці: живий стенд (`scripts/live`) ставить Лєну в потрібне
  // місто й пору року. У збірку для пари цей рядок не потрапляє.
  useEffect(() => {
    if (import.meta.env.DEV) (window as unknown as { __lifeGame?: GameController }).__lifeGame = controller;
  }, [controller]);

  const { ui, life } = controller;
  return (
    <div className="lg">
      <canvas ref={canvas} className="lg-canvas" aria-label="Світ гри «Дєвочка в городі»" />
      {ui.screen === 'title' && <Title c={controller} />}
      {ui.screen === 'world' && life && !ui.activity && <Hud c={controller} />}
      {ui.activity?.phase === 'intro' && <ActivityIntro c={controller} />}
      {ui.panel && life && <Panels c={controller} life={life} panel={ui.panel} />}
      {ui.dialog && <Dialog c={controller} />}
      {ui.card && <CardView c={controller} />}
      {ui.ask && <Ask c={controller} />}
      {ui.celebrate && <Celebrate />}
    </div>
  );
}

// ------------------------------------------------------------
function Title({ c }: { c: GameController }) {
  const [choose, setChoose] = useState(false);
  const saved = c.saved.state;
  const savedInfo = saved ? dayInfo(saved.day) : null;
  const chapters: [Chapter, string][] = [['sadok', 'Садочок'], ['school', 'Школа'], ['uni', 'ВДПУ'], ['adult', 'Доросле життя']];
  const begin = (chapter: Chapter) => {
    if (saved && !window.confirm('Почати нове життя? Збережене буде замінене.')) return;
    void c.newGame(freshSeed(), chapter);
  };
  return (
    <div className="lg-title">
      <div className="lg-panel lg-title-box">
        <h1>Дєвочка в городі</h1>
        {!choose && (
          <>
            {saved && savedInfo && (
              <button type="button" className="lg-btn is-pink" onClick={() => void c.continueGame()}>
                Продовжити · {savedInfo.dayName.toLowerCase()}, {savedInfo.monthName} {savedInfo.calendarYear}
              </button>
            )}
            {c.saved.problem && <p className="lg-note" style={{ color: '#b8323a' }}>{c.saved.problem}</p>}
            <button type="button" className="lg-btn" onClick={() => setChoose(true)}>Нове життя</button>
          </>
        )}
        {choose && (
          <>
            <p className="lg-note">З чого почати? Кожен розділ — з прожитим минулим.</p>
            <div className="lg-chapters">
              {chapters.map(([id, label]) => (
                <button key={id} type="button" className="lg-btn is-paper" onClick={() => begin(id)}>
                  {label}
                  <br />
                  <small style={{ fontWeight: 800 }}>{dayInfo(CHAPTER_WEEK[id] * 7).schoolYear}</small>
                </button>
              ))}
            </div>
            <button type="button" className="lg-btn is-small is-paper" onClick={() => setChoose(false)}>Назад</button>
          </>
        )}
        <p className="lg-foot">для Лєни · з любов'ю, Діма</p>
      </div>
    </div>
  );
}

// ------------------------------------------------------------
function Meter({ icon, value, color, label }: { icon: 'bolt' | 'smile'; value: number; color: string; label: string }) {
  return (
    <div className="lg-meter" title={`${label}: ${Math.round(value)}`}>
      <PixelIcon name={icon} size={2} label={label} />
      <div className="lg-meter-bar"><div className="lg-meter-fill" style={{ width: `${value}%`, background: color }} /></div>
    </div>
  );
}

function Hud({ c }: { c: GameController }) {
  const { ui } = c;
  const life = c.life!;
  const info = dayInfo(life.day);
  const night = life.minute >= 20 * 60 || life.minute < 6 * 60;
  const near = ui.near;
  const blocked = !!ui.panel || !!ui.dialog || !!ui.card || ui.ask;
  return (
    <div className="lg-hud">
      <div className="lg-panel lg-place">
        <div className="lg-place-name">{c.placeName()}</div>
        <Meter icon="bolt" value={life.energy} color={life.energy > 25 ? '#7ed957' : '#e8776a'} label="Сили" />
        <Meter icon="smile" value={life.mood} color="#f2c14e" label="Настрій" />
      </div>
      <div className="lg-panel lg-clock">
        <div className="lg-clock-day">{info.dayShort} · {info.monthName} {info.calendarYear}</div>
        <div className="lg-clock-time"><PixelIcon name={night ? 'moon' : 'sun'} size={2} /> {clockLabel(life.minute)}</div>
        <div className="lg-clock-money"><PixelIcon name="coin" size={2} /> {life.money} ₴ <small style={{ marginLeft: 'auto', fontSize: 11 }}>{SEASON_NAME[info.season]}</small></div>
      </div>
      <div className="lg-wood lg-goal">{c.objective()}</div>
      {near && !blocked && (
        <button type="button" className="lg-btn lg-action" onClick={() => void c.interact(near)}>
          {VERB[near.action.type]} · {near.label}
        </button>
      )}
      <div className="lg-toasts" aria-live="polite">
        {ui.toasts.map((t) => <div key={t.id} className="lg-panel lg-toast">{t.text}</div>)}
      </div>
      <nav className="lg-menu" aria-label="Меню гри">
        <button type="button" className="lg-btn is-paper" onClick={() => c.openPanel({ kind: 'bag' })} aria-label="Сумка"><PixelIcon name="bag" size={3} /></button>
        <button type="button" className="lg-btn is-paper" onClick={() => c.openPanel({ kind: 'album' })} aria-label="Альбом"><PixelIcon name="album" size={3} /></button>
        <button type="button" className="lg-btn is-paper" onClick={() => c.openPanel({ kind: 'phone' })} aria-label="Телефон"><PixelIcon name="phone" size={3} /></button>
      </nav>
      {ui.saveProblem && <div className="lg-panel lg-warn">{ui.saveProblem}</div>}
    </div>
  );
}

// ------------------------------------------------------------
function speakerLook(c: GameController, who: Speaker): Look | null {
  const life = c.life;
  if (who === 'l') return life ? lenaLook(life) : null;
  if (who === 'd') return DIMA;
  if (who === 'm') return MOM;
  if (who === 'o') return { ...OLYA, kid: life ? dayInfo(life.day).week <= 6 : true };
  return null;
}

function Dialog({ c }: { c: GameController }) {
  const d = c.ui.dialog!;
  const line = d.lines[d.i]!;
  const look = speakerLook(c, line.who);
  const color = { n: '#7a4f2a', l: '#c23a67', d: '#3a6fd8', m: '#b8323a', o: '#2f8a6a' }[line.who];
  return (
    <div className="lg-panel lg-dialog" role="dialog" aria-live="polite" onClick={() => c.advanceDialog()}>
      <div className="lg-portrait">{look ? <Portrait look={look} scale={4} /> : <PixelIcon name="star" size={6} />}</div>
      <div>
        {NAME[line.who] && <div className="lg-dialog-who" style={{ color }}>{NAME[line.who]}</div>}
        <div className="lg-dialog-text">{line.text}</div>
        <div className="lg-dialog-next">▼</div>
      </div>
    </div>
  );
}

function CardView({ c }: { c: GameController }) {
  const card = c.ui.card!;
  return (
    <div className="lg-scrim" onClick={() => c.closeCard()}>
      <div className={`lg-panel lg-card${card.tone === 'gold' ? ' is-gold' : card.tone === 'love' ? ' is-love' : ''}`} role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <h2>{card.title}</h2>
        {card.body && <p>{card.body}</p>}
        {card.lines?.map((l) => <p key={l}>{l}</p>)}
        <button type="button" className={`lg-btn${card.tone === 'love' ? ' is-pink' : ''}`} onClick={() => c.closeCard()} autoFocus>{card.button ?? 'Далі'}</button>
      </div>
    </div>
  );
}

function ActivityIntro({ c }: { c: GameController }) {
  const a = c.ui.activity!;
  return (
    <div className="lg-scrim">
      <div className="lg-panel lg-card" role="dialog" aria-modal="true">
        <h2>{a.title}</h2>
        <p>Сьогодні в програмі:</p>
        <ol className="lg-plan">
          {a.plans.map((p, i) => <li key={p.key}><b>{i + 1}</b>{p.title}</li>)}
        </ol>
        <button type="button" className="lg-btn is-green" onClick={() => c.startActivity()} autoFocus>Почати</button>
      </div>
    </div>
  );
}

function Ask({ c }: { c: GameController }) {
  return (
    <div className="lg-ask">
      <div className="lg-panel lg-card" role="dialog" aria-modal="true">
        <div style={{ display: 'flex', justifyContent: 'center', gap: 12 }}>
          <Portrait look={DIMA} scale={5} />
        </div>
        <PixelIcon name="ring" size={5} label="Обручка" />
        <h2>Будь моєю дружиною офіційно!</h2>
        <button type="button" className="lg-btn is-pink" onClick={() => c.answerYes()}><PixelIcon name="heart" size={2} /> ТАК</button>
        <button type="button" className="lg-btn" onClick={() => c.answerYes()}>ЗВИЧАЙНО, ТАК! <PixelIcon name="ring" size={2} /></button>
      </div>
    </div>
  );
}

function Celebrate() {
  return (
    <div className="lg-celebrate" aria-hidden>
      {Array.from({ length: 18 }, (_, i) => (
        <span key={i} style={{ left: `${(i * 37) % 100}%`, animationDuration: `${5 + (i % 5)}s`, animationDelay: `${-(i % 7)}s` }}>
          <PixelIcon name="heart" size={3 + (i % 3)} />
        </span>
      ))}
    </div>
  );
}
