// ============================================================
// Контролер «Дєвочка в городі» (ADR-0239): кадр, рух, час доби, двері-дії,
// міні-ігри, сцени історії й автозбереження.
// ------------------------------------------------------------
// Правила — у `sim/` (чисті функції); тут — лише те, що робить їх грою:
// хто де стоїть, що на екрані, чого чекає інтерфейс. React читає знімок
// стану через `subscribe/snapshot` і викликає методи-дії.
// ============================================================
import { DAY_END_MIN, dayInfo, type Season } from './sim/calendar';
import { CITIES, JOB_BY_ID, SIGHTS, type CityId, type DecorSlot, type PersonId, type ShopId } from './sim/content';
import { moveFurniture } from './sim/economy';
import { ACTIVITY_BY_ID, activityCheck, doActivity } from './sim/activities';
import { RESIDENT_BY_ID, acquainted, residentsIn } from './sim/people';
import { RESIDENT_LOOKS } from './render/residents';
import {
  LifeRuleError,
  attendStudy,
  canDoDuty,
  dimaArrived,
  dimaWithLena,
  dutyToday,
  meetDima,
  meetingDue,
  mustSleep,
  newLife,
  passTime,
  playWithFriends,
  propose,
  proposalCheck,
  sleep,
  today,
  travel,
  visitLyceum,
  visitSight,
  workShift,
  canVisitLyceum,
  type Chapter,
  type LifeEvent,
  type LifeState,
  type Outcome,
} from './sim/life';
import { rngFor } from './sim/rng';
import { SAVE_KEY, SaveError, parseSave, serialize } from './sim/save';
import { dayPlan, friendsGame, makeGame, type PlannedGame } from './games/day';
import { Kit, type MiniGame } from './games/kit';
import { lenaLook } from './look';
import { DIMA, MOM, OLYA, townsfolkLook, type Look } from './render/people';
import { renderScene, type Actor, type Weather } from './render/scene';
import { sfx, unlockAudio } from './sound';
import { colliderFor, tileFeet, zoneAt } from './world/collide';
import { HATA_MOM_BED, homeInterior } from './world/interior';
import { cityMap, homeYard } from './world/maps';
import { MOM_DOORS, MOM_SPOTS, YARD_ID } from './world/yard';
import { KITCHEN_ID, KITCHEN_MOM_SPOTS, summerKitchenMap } from './world/kitchen';
import { momPlan, type MomPlan } from './sim/mom';
import { DOG_HAPPY_S, LENA_FALL_S, feedBasia, newDog, petBasia, stepDog, type Dog } from './sim/dog';

/** Стеля щільності пікселів полотна гри (власник: «оптимізуй під айфони»). */
export const GAME_MAX_DPR = 2;
import { TILE, type GameMap, type Zone } from './world/types';

export type Panel =
  | { kind: 'shop'; shop: ShopId }
  | { kind: 'travel' }
  | { kind: 'jobs'; focus?: string | undefined }
  | { kind: 'realtor' }
  | { kind: 'wardrobe' }
  | { kind: 'album' }
  | { kind: 'phone' }
  | { kind: 'bag' }
  | { kind: 'date' }
  | { kind: 'sleep' }
  | { kind: 'mom' }
  | { kind: 'dima' }
  | { kind: 'person'; id: string }
  | { kind: 'laptop' }
  | { kind: 'decorate' }
  | { kind: 'dog' };

export type Speaker = 'n' | 'l' | 'd' | 'm' | 'o';
export interface Line { who: Speaker; text: string }

export interface Card {
  title: string;
  body?: string | undefined;
  lines?: string[] | undefined;
  button?: string | undefined;
  tone?: 'gold' | 'love' | 'plain' | undefined;
}

export interface ActivityUi {
  plans: PlannedGame[];
  index: number;
  phase: 'intro' | 'play' | 'between';
  title: string;
  scores: number[];
}

export interface UiState {
  screen: 'title' | 'world';
  panel: Panel | null;
  dialog: { lines: Line[]; i: number } | null;
  card: Card | null;
  toasts: { id: number; text: string }[];
  near: Zone | null;
  activity: ActivityUi | null;
  ask: boolean;
  saveProblem: string | null;
  /** Скільки сердець і подяк летить над екраном (після пропозиції). */
  celebrate: boolean;
}

/** Хвилин гри за секунду ходіння: день 7:00–2:00 ≈ 12 хвилин гри. */
export const MINUTES_PER_SECOND = 1.5;

interface Walker extends Actor {
  target: { x: number; y: number } | null;
  wait: number;
  speed: number;
}

export class GameController {
  life: LifeState | null = null;
  ui: UiState = { screen: 'title', panel: null, dialog: null, card: null, toasts: [], near: null, activity: null, ask: false, saveProblem: null, celebrate: false };
  /** Збережене життя, якщо є (для «Продовжити»), або проблема з ним. */
  saved: { state: LifeState | null; problem: string | null } = { state: null, problem: null };

  private version = 0;
  private listeners = new Set<() => void>();
  private canvas: HTMLCanvasElement | null = null;
  private raf = 0;
  private last = 0;
  private time = 0;
  private kit = new Kit();

  map: GameMap = cityMap('zhylyntsi');
  private player: Actor = { id: 'lena', x: 0, y: 0, dir: 0, moving: false, t: 0, look: lenaLook(newLife(0)) };
  private folk: Walker[] = [];
  /** Мешканці, з якими можна познайомитись: стоять біля свого місця. */
  private residents: (Walker & { home: { x: number; y: number } })[] = [];
  private extras: Actor[] = [];
  /** Бася — лише на подвір'ї; зберігається, поки Лєна там. */
  private dog: Dog | null = null;
  /** Мама Лєни: ходить подвір'ям за розкладом або відпочиває у своїй кімнаті. */
  private momA: (Actor & { target: { x: number; y: number } | null; wait: number; stuck: number; leaving: boolean; plan: MomPlan }) | null = null;
  /** Скільки ще секунд Лєна лежить, перечепившись об Басю. */
  private fallLeft = 0;
  /** Падає геть від Басі, щоб не впасти на неї. */
  private fallDir: 1 | -1 = 1;
  private dima: Actor | null = null;
  /**
   * Що Діма робить на екрані: іде за Лєною, стоїть у кімнаті (чекає вдома),
   * або підходить після дзвінка. `null` — його тут немає.
   */
  private dimaRole: 'follow' | 'room' | 'arriving' | null = null;
  private trail: { x: number; y: number }[] = [];
  private keys = new Set<string>();
  private joy: { id: number; ox: number; oy: number; dx: number; dy: number } | null = null;
  private busy = false;
  private minuteAcc = 0;
  private warnedLate = -1;
  private game: MiniGame | null = null;
  private gameDone: ((score: number) => void) | null = null;
  private waiters: { card: (() => void) | undefined; dialog: (() => void) | undefined; ask: (() => void) | undefined; intro: (() => void) | undefined } = { card: undefined, dialog: undefined, ask: undefined, intro: undefined };
  private toastId = 0;
  private cameraX = 0;
  private cameraY = 0;

  constructor() {
    this.loadSave();
  }

  // ------------------------------------------------------------
  // Підписка для React.
  // ------------------------------------------------------------
  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  snapshot = (): number => this.version;

  private emit(): void {
    this.version += 1;
    for (const fn of this.listeners) fn();
  }

  private setUi(patch: Partial<UiState>): void {
    this.ui = { ...this.ui, ...patch };
    this.emit();
  }

  // ------------------------------------------------------------
  // Сейв.
  // ------------------------------------------------------------
  private loadSave(): void {
    let raw: string | null = null;
    try {
      raw = localStorage.getItem(SAVE_KEY);
    } catch {
      this.saved = { state: null, problem: 'Браузер не дає зберігати гру в цьому вікні' };
      return;
    }
    if (!raw) return;
    try {
      this.saved = { state: parseSave(raw), problem: null };
    } catch (e) {
      this.saved = { state: null, problem: e instanceof SaveError ? e.message : 'Сейв не прочитано' };
    }
  }

  private persist(): void {
    if (!this.life) return;
    try {
      localStorage.setItem(SAVE_KEY, serialize(this.life));
      if (this.ui.saveProblem) this.setUi({ saveProblem: null });
    } catch {
      if (!this.ui.saveProblem) this.setUi({ saveProblem: 'Гра не зберігається в цьому вікні (приватний режим?)' });
    }
  }

  private commit(next: LifeState): void {
    this.life = next;
    this.player.look = lenaLook(next);
    this.syncDima();
    this.persist();
    this.emit();
  }

  /**
   * Діма на екрані відповідає правилам (власник, 2026-10-04): за Лєною — лише
   * коли вона попросила; «йди додому» — він іде й чекає вдома (у спільній
   * квартирі його видно в кімнаті); після дзвінка — підходить до неї.
   */
  private syncDima(): void {
    const life = this.life;
    if (!life || this.ui.screen !== 'world') return;
    const want: 'follow' | 'room' | null = dimaWithLena(life)
      ? 'follow'
      : life.flags.metDima && life.dima.mode === 'home' && this.map.interior && life.flags.livingWithDima
        ? 'room'
        : null;
    if (want === null) {
      this.dima = null;
      this.dimaRole = null;
      return;
    }
    if (want === 'room') {
      if (this.dimaRole !== 'room') {
        const spot = this.roomSpot();
        this.dima = { id: 'dima', x: spot.x, y: spot.y, dir: 0, moving: false, t: 0, look: DIMA };
        this.dimaRole = 'room';
      }
      return;
    }
    // follow
    if (this.dima && (this.dimaRole === 'follow' || this.dimaRole === 'arriving')) return;
    if (this.dima && this.dimaRole === 'room') { this.dimaRole = 'follow'; this.trail = []; return; }
    // Приходить здалеку: з краю видимого світу, потім іде до Лєни.
    const from = this.arrivalSpot();
    this.dima = { id: 'dima', x: from.x, y: from.y, dir: 1, moving: true, t: 0, look: DIMA };
    this.dimaRole = 'arriving';
    this.trail = [];
  }

  /** Де Діма стоїть у кімнаті: найближча вільна клітинка до середини. */
  private roomSpot(): { x: number; y: number } {
    const c = colliderFor(this.map);
    const cx = Math.floor(this.map.w / 2) + 2;
    const cy = Math.floor(this.map.h / 2);
    for (let r = 0; r < 6; r += 1) {
      for (let dx = -r; dx <= r; dx += 1) {
        for (let dy = -r; dy <= r; dy += 1) {
          const f = tileFeet(cx + dx, cy + dy);
          if (c.canStand(f.x, f.y) && Math.hypot(f.x - this.player.x, f.y - this.player.y) > 18) return f;
        }
      }
    }
    return { x: this.player.x + 16, y: this.player.y };
  }

  /** Звідки приходить Діма: вільне місце ~7 клітинок від Лєни. */
  private arrivalSpot(): { x: number; y: number } {
    const c = colliderFor(this.map);
    for (const [dx, dy] of [[7, 0], [-7, 0], [0, 6], [0, -6], [5, 5], [-5, 5], [3, 0], [-3, 0]] as const) {
      const x = this.player.x + dx * TILE;
      const y = this.player.y + dy * TILE;
      if (c.canStand(x, y)) return { x, y };
    }
    return { x: this.player.x + 16, y: this.player.y };
  }

  private async apply(outcome: Outcome): Promise<void> {
    this.commit(outcome.state);
    await this.showEvents(outcome.events);
  }

  /** Спробувати дію: правило відмовило — тост із причиною, а не тиша. */
  async attempt(fn: (s: LifeState) => Outcome): Promise<boolean> {
    if (!this.life) return false;
    try {
      await this.apply(fn(this.life));
      return true;
    } catch (e) {
      if (e instanceof LifeRuleError) { this.toast(e.message); sfx.bad(); return false; }
      throw e;
    }
  }

  // ------------------------------------------------------------
  // Початок і кінець.
  // ------------------------------------------------------------
  async start(life: LifeState, fresh: boolean): Promise<void> {
    unlockAudio();
    this.life = life;
    this.player.look = lenaLook(life);
    this.persist();
    this.setUi({ screen: 'world', panel: null, card: null, dialog: null, activity: null });
    if (life.city === life.home) this.enterHome('wake');
    else this.enterCity(life.city, 'default');
    if (fresh) await this.intro();
    await this.checkStory();
  }

  newGame(seed: number, chapter: Chapter): Promise<void> {
    return this.start(newLife(seed, chapter), true);
  }

  continueGame(): Promise<void> {
    if (!this.saved.state) return Promise.resolve();
    return this.start(this.saved.state, false);
  }

  toTitle(): void {
    this.loadSave();
    this.setUi({ screen: 'title', panel: null, activity: null, card: null, dialog: null, ask: false, celebrate: false });
    this.map = cityMap('zhylyntsi');
    this.spawnFolk();
    const f = tileFeet(20, 14);
    this.player.x = f.x;
    this.player.y = f.y;
  }

  private async intro(): Promise<void> {
    const info = today(this.life!);
    if (info.stage === 'sadok') {
      await this.say([
        ['n', 'Десь на Хмельниччині є село Жилинці.'],
        ['n', 'Тут росте дівчинка на ім\'я Лєна.'],
        ['m', 'Лєночко, вставай! Садочок чекає — і друзі теж.'],
        ['n', 'Кожен тиждень у грі — це рік життя. Вчись, грайся, заробляй, мандруй — і проживи свою історію.'],
        ['n', 'Ходи: тягни палець по екрану або стрілки/WASD. Біля дверей з\'явиться кнопка дії.'],
      ]);
    } else if (info.stage === 'school') {
      await this.say([['n', 'Перший клас! Букет, бант і новенький рюкзак.'], ['m', 'Не запізнюйся, сонечко: уроки о пів на дев\'яту.']]);
    } else if (info.stage === 'uni') {
      await this.say([['n', 'Вінниця, ВДПУ і гуртожиток. Пари о дев\'ятій.'], ['n', 'А десь у цьому місті вже ходить один хлопець з блакитними очима…']]);
    } else {
      await this.say([['n', 'Диплом є, квартира на Вишеньці — і Діма поруч.'], ['d', 'Лєно, обирай роботу до душі. Дошка вакансій — біля вокзалу.']]);
    }
  }

  // ------------------------------------------------------------
  // Мапи.
  // ------------------------------------------------------------
  private place(spawn: { x: number; y: number }): void {
    if (this.life) this.player.look = lenaLook(this.life);
    const f = tileFeet(spawn.x, spawn.y);
    this.player.x = f.x;
    this.player.y = f.y;
    this.player.moving = false;
    this.trail = [];
    this.snapCamera();
  }

  enterCity(city: CityId, spawnName: string): void {
    this.map = cityMap(city);
    this.place(this.map.spawns[spawnName] ?? this.map.spawns.default!);
    this.spawnFolk();
    this.spawnResidents();
    this.setupCompanions();
    this.ui = { ...this.ui, near: null };
    this.emit();
  }

  /** Мешканці міста стоять біля свого місця й трохи прогулюються. */
  private spawnResidents(): void {
    const life = this.life;
    this.residents = [];
    // Мешканці стоять на мапі самого міста, не на подвір'ї садиби.
    if (!life || this.map.interior || !this.map.city || this.map.id !== this.map.city) return;
    const c = colliderFor(this.map);
    for (const r of residentsIn(life, this.map.city)) {
      const look = RESIDENT_LOOKS[r.id];
      if (!look) continue;
      let spot: { x: number; y: number } | null = null;
      for (let rad = 0; rad < 6 && !spot; rad += 1) {
        for (let dx = -rad; dx <= rad && !spot; dx += 1) {
          for (let dy = -rad; dy <= rad && !spot; dy += 1) {
            const f = tileFeet(r.tile[0] + dx, r.tile[1] + dy);
            if (c.canStand(f.x, f.y)) spot = f;
          }
        }
      }
      if (!spot) continue;
      this.residents.push({ id: `res:${r.id}`, x: spot.x, y: spot.y, dir: 0, moving: false, t: 0, look, target: null, wait: 1, speed: 18, home: spot });
    }
  }

  /** Подвір'я садиби в Жилинцях (власник, 2026-10-06): хата, хліви, город, кухня, сад. */
  /** Зайти в літню кухню (з прибудови, вхід згори). */
  enterKitchen(): void {
    this.map = summerKitchenMap();
    this.place(this.map.spawns.door!);
    this.folk = [];
    this.residents = [];
    this.setupCompanions();
    this.ui = { ...this.ui, near: null };
    this.emit();
  }

  enterYard(spawnName: 'gate' | 'house' | 'kitchen'): void {
    this.map = homeYard();
    this.place(this.map.spawns[spawnName] ?? this.map.spawns.default!);
    this.folk = [];
    this.residents = [];
    this.setupCompanions();
    this.ui = { ...this.ui, near: null };
    this.emit();
  }

  enterHome(spawnName: 'wake' | 'door'): void {
    this.map = homeInterior(this.life!);
    this.place(this.map.spawns[spawnName]!);
    this.folk = [];
    this.residents = [];
    this.setupCompanions();
    this.ui = { ...this.ui, near: null };
    this.emit();
  }

  private spawnFolk(): void {
    const life = this.life;
    const r = rngFor(life?.seed ?? 0, 'folk', this.map.id, life?.day ?? 0);
    const c = colliderFor(this.map);
    this.folk = [];
    for (let k = 0; k < this.map.folk; k += 1) {
      for (let tries = 0; tries < 30; tries += 1) {
        const i = Math.floor(r() * this.map.w);
        const j = Math.floor(r() * this.map.h);
        const f = tileFeet(i, j);
        if (!c.canStand(f.x, f.y)) continue;
        this.folk.push({ id: `folk${k}`, x: f.x, y: f.y, dir: 0, moving: false, t: r() * 3, look: townsfolkLook(r), target: null, wait: r() * 2, speed: 22 + r() * 12 });
        break;
      }
    }
  }

  private setupCompanions(): void {
    const life = this.life;
    this.extras = [];
    this.dima = null;
    if (!life) return;
    const info = today(life);
    if (this.map.id === YARD_ID) {
      // Бася вибігає назустріч, щойно Лєна на подвір'ї.
      if (!this.dog) { const p = tileFeet(24, 27); this.dog = newDog(p.x, p.y, life.seed); }
    } else {
      this.dog = null;
      this.fallLeft = 0;
    }
    // Мама з'являється сама — за розкладом (`updateMom`).
    this.momA = null;
    if (this.map.id === 'zhylyntsi') {
      if (info.week < 12) {
        const o = tileFeet(36, 10);
        this.extras.push({ id: 'olya', x: o.x, y: o.y, dir: 1, moving: false, t: 0, look: { ...OLYA, kid: info.week <= 6 } });
      }
    }
    // Діма йде разом із Лєною лише тоді, коли вона його покликала.
    this.dimaRole = null;
    if (dimaWithLena(life)) {
      this.dima = { id: 'dima', x: this.player.x - 14, y: this.player.y + 2, dir: this.player.dir, moving: false, t: 0, look: DIMA };
      this.dimaRole = 'follow';
    }
    this.syncDima();
  }

  // ------------------------------------------------------------
  // Полотно, кадр, введення.
  // ------------------------------------------------------------
  attach(canvas: HTMLCanvasElement): () => void {
    this.canvas = canvas;
    this.toTitle();
    const onKeyDown = (e: KeyboardEvent) => this.keyDown(e);
    const onKeyUp = (e: KeyboardEvent) => this.keys.delete(e.key.toLowerCase());
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    canvas.addEventListener('pointerdown', this.pointerDown);
    window.addEventListener('pointermove', this.pointerMove);
    window.addEventListener('pointerup', this.pointerUp);
    window.addEventListener('pointercancel', this.pointerUp);
    const loop = (ts: number) => {
      const dt = Math.min(0.05, (ts - this.last) / 1000 || 0.016);
      this.last = ts;
      this.frame(dt);
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(this.raf);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      canvas.removeEventListener('pointerdown', this.pointerDown);
      window.removeEventListener('pointermove', this.pointerMove);
      window.removeEventListener('pointerup', this.pointerUp);
      window.removeEventListener('pointercancel', this.pointerUp);
    };
  }

  private blocked(): boolean {
    const u = this.ui;
    return this.busy || u.screen !== 'world' || !!u.panel || !!u.dialog || !!u.card || u.ask || !!u.activity;
  }

  private keyDown(e: KeyboardEvent): void {
    const k = e.key.toLowerCase();
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault();
    unlockAudio();
    if (this.ui.dialog && (k === ' ' || k === 'enter' || k === 'e')) { this.advanceDialog(); return; }
    if (this.ui.card && (k === ' ' || k === 'enter' || k === 'e')) { this.closeCard(); return; }
    if (k === 'escape' && this.ui.panel) { this.closePanel(); return; }
    if ((k === 'e' || k === ' ' || k === 'enter') && !this.blocked() && this.ui.near) { void this.interact(this.ui.near); return; }
    this.keys.add(k);
  }

  private deviceScale(): { dpr: number; w: number; h: number } {
    const c = this.canvas!;
    // Не більше 2: на айфоні щільність 3, і гра малювала б 9 пікселів на
    // кожен точковий щокадру — у 2.25 раза більше, ніж за щільності 2. Для
    // піксельної графіки різниці не видно, а батарея й кадри — видно.
    const dpr = Math.min(GAME_MAX_DPR, window.devicePixelRatio || 1);
    const w = Math.round(c.clientWidth * dpr);
    const h = Math.round(c.clientHeight * dpr);
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    return { dpr, w, h };
  }

  private pointerDown = (e: PointerEvent): void => {
    unlockAudio();
    if (this.game && this.ui.activity?.phase === 'play') {
      const { dpr } = this.deviceScale();
      const r = this.canvas!.getBoundingClientRect();
      const vx = ((e.clientX - r.left) * dpr) / this.kit.s;
      const vy = ((e.clientY - r.top) * dpr) / this.kit.s;
      if (this.kit.hitAt(vx, vy) === '__skip') { this.skipGame(); return; }
      this.game.tap(vx, vy, this.kit);
      return;
    }
    if (this.ui.dialog) { this.advanceDialog(); return; }
    if (this.blocked()) return;
    this.joy = { id: e.pointerId, ox: e.clientX, oy: e.clientY, dx: 0, dy: 0 };
  };

  private pointerMove = (e: PointerEvent): void => {
    if (!this.joy || e.pointerId !== this.joy.id) return;
    let dx = e.clientX - this.joy.ox;
    let dy = e.clientY - this.joy.oy;
    const d = Math.hypot(dx, dy);
    if (d > 44) { dx = (dx / d) * 44; dy = (dy / d) * 44; }
    this.joy.dx = dx / 44;
    this.joy.dy = dy / 44;
  };

  private pointerUp = (e: PointerEvent): void => {
    if (this.joy && e.pointerId === this.joy.id) this.joy = null;
  };

  private frame(dt: number): void {
    if (!this.canvas) return;
    this.time += dt;
    const { dpr, w, h } = this.deviceScale();
    const g = this.canvas.getContext('2d')!;
    if (this.game && this.ui.activity?.phase === 'play') {
      this.game.update(dt);
      this.renderGame(g, w, h, dpr);
      if (this.game.done && this.gameDone) {
        const done = this.gameDone;
        const score = this.game.score;
        this.gameDone = null;
        window.setTimeout(() => done(score), 650);
      }
      return;
    }
    g.setTransform(1, 0, 0, 1, 0, 0);
    if (this.ui.screen === 'title') this.titleFrame(dt);
    else this.worldFrame(dt);
    this.renderWorld(g, w, h, dpr);
  }

  private titleFrame(dt: number): void {
    // На титулі камера повільно пливе над Жилинцями.
    this.player.x += dt * 9;
    if (this.player.x > (this.map.w - 8) * TILE) this.player.x = 8 * TILE;
    this.updateFolk(dt);
  }

  private worldFrame(dt: number): void {
    const life = this.life;
    if (!life) return;
    this.player.t += dt;
    this.updateFolk(dt);
    this.updateResidents(dt);
    this.updateDog(dt);
    this.updateMom(dt);
    if (!this.blocked()) {
      if (this.fallLeft > 0) { this.fallLeft = Math.max(0, this.fallLeft - dt); this.player.moving = false; }
      else this.movePlayer(dt);
      // Час іде, поки Лєна в місті.
      this.minuteAcc += dt * MINUTES_PER_SECOND;
      if (this.minuteAcc >= 1) {
        const m = Math.floor(this.minuteAcc);
        this.minuteAcc -= m;
        this.life = passTime(life, m);
        if (Math.floor(this.life.minute / 10) !== Math.floor(life.minute / 10)) this.emit();
        // Діма дійшов після дзвінка — з'являється й підходить.
        if (!dimaArrived(life) && dimaArrived(this.life)) {
          this.syncDima();
          sfx.love();
          this.toast('Діма прийшов!');
        }
        this.timeWarnings();
      }
    } else {
      this.player.moving = false;
    }
    this.updateDima(dt);
  }

  private timeWarnings(): void {
    const life = this.life!;
    if (life.minute >= 23 * 60 && this.warnedLate !== life.day && !this.map.interior) {
      this.warnedLate = life.day;
      this.toast('Уже пізно — час додому спати');
    }
    if (mustSleep(life) && !this.busy) void this.passOut();
  }

  private movePlayer(dt: number): void {
    let vx = 0;
    let vy = 0;
    if (this.keys.has('arrowleft') || this.keys.has('a') || this.keys.has('ф')) vx -= 1;
    if (this.keys.has('arrowright') || this.keys.has('d') || this.keys.has('в')) vx += 1;
    if (this.keys.has('arrowup') || this.keys.has('w') || this.keys.has('ц')) vy -= 1;
    if (this.keys.has('arrowdown') || this.keys.has('s') || this.keys.has('і')) vy += 1;
    if (this.joy) {
      vx = Math.abs(this.joy.dx) > 0.18 ? this.joy.dx : 0;
      vy = Math.abs(this.joy.dy) > 0.18 ? this.joy.dy : 0;
    }
    const len = Math.hypot(vx, vy);
    const p = this.player;
    if (len < 0.05) { p.moving = false; this.checkZone(); return; }
    vx /= Math.max(1, len);
    vy /= Math.max(1, len);
    const bike = this.life?.owned.includes('bike') && !this.map.interior ? 1.3 : 1;
    const sp = (this.player.look.kid ? 60 : 72) * bike * dt;
    const c = colliderFor(this.map);
    if (c.canStand(p.x + vx * sp, p.y)) p.x += vx * sp;
    if (c.canStand(p.x, p.y + vy * sp)) p.y += vy * sp;
    p.moving = true;
    if (Math.abs(vx) > Math.abs(vy)) p.dir = vx > 0 ? 2 : 1;
    else p.dir = vy > 0 ? 0 : 3;
    this.trail.push({ x: p.x, y: p.y });
    if (this.trail.length > 40) this.trail.shift();
    this.checkZone();
  }

  private checkZone(): void {
    let z = zoneAt(this.map, this.player.x, this.player.y);
    // Поруч Діма й немає дверей — можна поговорити.
    const d = this.dima;
    if (!z && d && this.dimaRole !== 'arriving' && this.life?.flags.metDima && Math.hypot(d.x - this.player.x, d.y - this.player.y) < 26) {
      z = { id: 'talk:dima', x: d.x, y: d.y, w: 1, h: 1, action: { type: 'talk' }, label: 'Діма' };
    }
    // Мама — де б вона не була: на подвір'ї чи в кімнаті на ліжку.
    const mom = this.momA;
    if (!z && mom && Math.hypot(mom.x - this.player.x, mom.y - this.player.y) < (mom.inBed ? 30 : 26)) {
      z = { id: 'talk:mom', x: mom.x, y: mom.y, w: 1, h: 1, action: { type: 'mom' }, label: `Мама ${mom.plan.task}` };
    }
    // Бася поруч — погладити чи нагодувати.
    const dog = this.dog;
    if (!z && dog && Math.hypot(dog.x - this.player.x, dog.y - this.player.y) < 22) {
      z = { id: 'talk:basia', x: dog.x, y: dog.y, w: 1, h: 1, action: { type: 'dog' }, label: 'погладити чи нагодувати' };
    }
    // Мешканець поруч — підійти й заговорити.
    if (!z && this.life) {
      const near = this.residents.find((r) => Math.hypot(r.x - this.player.x, r.y - this.player.y) < 24);
      if (near) {
        const id = near.id.slice(4);
        const known = acquainted(this.life, id);
        const who = RESIDENT_BY_ID.get(id)!;
        z = { id: `talk:${id}`, x: near.x, y: near.y, w: 1, h: 1, action: { type: 'talk', who: id }, label: known ? who.name : who.female ? 'Незнайомка' : 'Незнайомець' };
      }
    }
    if (z?.id !== this.ui.near?.id) this.setUi({ near: z });
  }

  private updateDima(dt: number): void {
    const d = this.dima;
    if (!d) return;
    d.t += dt;
    if (this.dimaRole === 'room') {
      // Чекає вдома: стоїть і дивиться на Лєну.
      d.moving = false;
      const dx = this.player.x - d.x;
      const dy = this.player.y - d.y;
      d.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 2 : 1) : (dy > 0 ? 0 : 3);
      return;
    }
    if (this.dimaRole === 'arriving') {
      const dx = this.player.x - d.x;
      const dy = this.player.y - d.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 18) { this.dimaRole = 'follow'; this.trail = []; d.moving = false; return; }
      const st = Math.min(70 * dt, dist);
      d.x += (dx / dist) * st;
      d.y += (dy / dist) * st;
      d.moving = true;
      d.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 2 : 1) : (dy > 0 ? 0 : 3);
      return;
    }
    const tgt = this.trail.length > 12 ? this.trail[this.trail.length - 12]! : null;
    if (!tgt) { d.moving = false; return; }
    const dx = tgt.x - d.x;
    const dy = tgt.y - d.y;
    const dist = Math.hypot(dx, dy);
    if (dist > 3) {
      const st = Math.min(84 * dt, dist);
      d.x += (dx / dist) * st;
      d.y += (dy / dist) * st;
      d.moving = true;
      d.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 2 : 1) : (dy > 0 ? 0 : 3);
    } else d.moving = false;
  }

  private updateDog(dt: number): void {
    if (!this.dog) return;
    const c = colliderFor(this.map);
    const r = stepDog(this.dog, dt, { lena: this.player, canStand: (x, y) => c.canStand(x, y) });
    this.dog = r.dog;
    // Перечепилась — лише коли Лєна вільна (не в розмові, не в панелі).
    if (r.trip && this.fallLeft <= 0 && !this.blocked()) {
      this.fallLeft = LENA_FALL_S;
      this.fallDir = this.dog.x > this.player.x ? -1 : 1;
      sfx.oops();
    }
  }

  /**
   * Мама за розкладом (`momPlan`): на подвір'ї ходить від точки до точки
   * свого місця й трохи там стоїть, ніби порається; коли час до хати —
   * іде до ґанку й зникає; у хаті — відпочиває чи спить на своєму ліжку.
   */
  private updateMom(dt: number): void {
    const life = this.life;
    if (!life || life.home !== 'zhylyntsi') { this.momA = null; return; }
    const plan = momPlan(life.minute, today(life).season);
    const inHata = this.map.interior && this.map.id.startsWith('home:hata');
    if (inHata) {
      if (plan.spot !== 'bed') { this.momA = null; return; }
      const bx = HATA_MOM_BED.x * TILE + 8;
      const by = HATA_MOM_BED.y * TILE + 15;
      this.momA = { id: 'mom', x: bx, y: by, dir: 0, moving: false, t: (this.momA?.t ?? 0) + dt, look: MOM, inBed: HATA_MOM_BED.tint, emote: plan.task === 'спить' ? 'sleep' : null, target: null, wait: 0, stuck: 0, leaving: false, plan };
      return;
    }
    const inKitchen = this.map.id === KITCHEN_ID;
    if (this.map.id !== YARD_ID && !inKitchen) { this.momA = null; return; }
    // На подвір'ї мама — коли вона на городі, в саду, біля курей чи на
    // лавці; кухня й ліжко — під дахом, туди вона заходить дверима.
    const here = inKitchen ? plan.spot === 'kitchen' : plan.spot !== 'kitchen' && plan.spot !== 'bed';
    const spotsHere = (): readonly [number, number][] => (inKitchen ? KITCHEN_MOM_SPOTS : MOM_SPOTS[plan.spot as keyof typeof MOM_SPOTS]);
    const door = inKitchen ? tileFeet(4, 5) : tileFeet(...(plan.spot === 'kitchen' ? MOM_DOORS.kitchen : MOM_DOORS.bed));
    let m = this.momA;
    if (!m) {
      if (!here) return;
      const p0 = tileFeet(...spotsHere()[0]!);
      m = this.momA = { id: 'mom', x: p0.x, y: p0.y, dir: 0, moving: false, t: 0, look: MOM, target: null, wait: 0, stuck: 0, leaving: false, plan };
    }
    m.t += dt;
    m.plan = plan;
    m.emote = null;
    if (!here && !m.leaving) { m.leaving = true; m.target = door; }
    if (here) m.leaving = false;
    if (m.wait > 0) { m.wait -= dt; m.moving = false; return; }
    if (!m.target && here) {
      const spots = spotsHere();
      const r = rngFor(life.seed, 'mom-walk', life.day, Math.floor(m.t * 2));
      const [tx, ty] = spots[Math.floor(r() * spots.length)]!;
      m.target = tileFeet(tx, ty);
    }
    if (!m.target) return;
    const dx = m.target.x - m.x;
    const dy = m.target.y - m.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 2) {
      m.target = null;
      m.moving = false;
      if (m.leaving) { this.momA = null; return; }
      // Порається на місці кілька секунд.
      m.wait = 3 + (Math.floor(m.t * 7) % 4);
      return;
    }
    const c = colliderFor(this.map);
    const st = Math.min(44 * dt, dist);
    const sx = (dx / dist) * st;
    const sy = (dy / dist) * st;
    let moved = false;
    if (c.canStand(m.x + sx, m.y)) { m.x += sx; moved = true; }
    if (c.canStand(m.x, m.y + sy)) { m.y += sy; moved = true; }
    m.moving = moved;
    m.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 2 : 1) : (dy > 0 ? 0 : 3);
    // Застрягла за будівлею — обходить її «за кадром»: одразу на місці.
    m.stuck = moved ? 0 : m.stuck + dt;
    if (m.stuck > 1.2) { m.x = m.target.x; m.y = m.target.y; m.stuck = 0; }
  }

  private updateResidents(dt: number): void {
    const c = colliderFor(this.map);
    for (const f of this.residents) {
      f.t += dt;
      // Поки Лєна поруч — стоїть і дивиться на неї.
      const dx0 = this.player.x - f.x;
      const dy0 = this.player.y - f.y;
      if (Math.hypot(dx0, dy0) < 40) {
        f.moving = false;
        f.dir = Math.abs(dx0) > Math.abs(dy0) ? (dx0 > 0 ? 2 : 1) : (dy0 > 0 ? 0 : 3);
        continue;
      }
      if (f.wait > 0) { f.wait -= dt; f.moving = false; continue; }
      if (!f.target) {
        const r = rngFor(f.id, Math.floor(f.t * 10));
        const tx = f.home.x + (r() - 0.5) * 48;
        const ty = f.home.y + (r() - 0.5) * 32;
        if (c.canStand(tx, ty)) f.target = { x: tx, y: ty };
        else f.wait = 0.6;
        continue;
      }
      const dx = f.target.x - f.x;
      const dy = f.target.y - f.y;
      const d = Math.hypot(dx, dy);
      if (d < 2) { f.target = null; f.wait = 2 + (f.t % 3); f.moving = false; continue; }
      const nx = f.x + (dx / d) * f.speed * dt;
      const ny = f.y + (dy / d) * f.speed * dt;
      if (!c.canStand(nx, ny)) { f.target = null; f.wait = 0.8; continue; }
      f.x = nx;
      f.y = ny;
      f.moving = true;
      f.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 2 : 1) : (dy > 0 ? 0 : 3);
    }
  }

  private updateFolk(dt: number): void {
    const c = colliderFor(this.map);
    for (const f of this.folk) {
      f.t += dt;
      if (f.wait > 0) { f.wait -= dt; f.moving = false; continue; }
      if (!f.target) {
        const r = rngFor(f.id, Math.floor(f.t * 10));
        const tx = f.x + (r() - 0.5) * 120;
        const ty = f.y + (r() - 0.5) * 90;
        if (c.canStand(tx, ty)) f.target = { x: tx, y: ty };
        else f.wait = 0.4;
        continue;
      }
      const dx = f.target.x - f.x;
      const dy = f.target.y - f.y;
      const d = Math.hypot(dx, dy);
      if (d < 2) { f.target = null; f.wait = 1 + (f.t % 2); f.moving = false; continue; }
      const nx = f.x + (dx / d) * f.speed * dt;
      const ny = f.y + (dy / d) * f.speed * dt;
      if (!c.canStand(nx, ny)) { f.target = null; f.wait = 0.5; continue; }
      f.x = nx;
      f.y = ny;
      f.moving = true;
      f.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 2 : 1) : (dy > 0 ? 0 : 3);
    }
  }

  private snapCamera(): void {
    if (!this.canvas) return;
    const { w, h } = this.deviceScale();
    const scale = this.worldScale(w, h);
    const vw = w / scale;
    const vh = h / scale;
    const mw = this.map.w * TILE;
    const mh = this.map.h * TILE;
    this.cameraX = mw <= vw ? -(vw - mw) / 2 : Math.max(0, Math.min(mw - vw, this.player.x - vw / 2));
    this.cameraY = mh <= vh ? -(vh - mh) / 2 : Math.max(0, Math.min(mh - vh, this.player.y - vh / 2));
  }

  private worldScale(w: number, h: number): number {
    // ~15 клітинок на ширину телефона, ~22 — на широкому екрані. Усередині —
    // той самий масштаб, що надворі (власник: «у будинку все здається
    // занадто дрібним»): раніше камера вміщала всю ширину хати, і люди з
    // меблями ставали вдвічі меншими, ніж на вулиці.
    const tilesWide = w > h ? 24 : 14;
    return Math.max(2, Math.round(w / (tilesWide * TILE)));
  }

  private renderWorld(g: CanvasRenderingContext2D, w: number, h: number, dpr: number): void {
    const life = this.life;
    const scale = this.worldScale(w, h);
    const vw = w / scale;
    const vh = h / scale;
    const mw = this.map.w * TILE;
    const mh = this.map.h * TILE;
    const tx = mw <= vw ? -(vw - mw) / 2 : Math.max(0, Math.min(mw - vw, this.player.x - vw / 2));
    const ty = mh <= vh ? -(vh - mh) / 2 : Math.max(0, Math.min(mh - vh, this.player.y - vh / 2));
    this.cameraX += (tx - this.cameraX) * 0.15;
    this.cameraY += (ty - this.cameraY) * 0.15;
    const info = dayInfo(life?.day ?? 3);
    const actors: Actor[] = [...this.folk, ...this.residents, ...this.extras];
    if (this.momA) actors.push(this.momA);
    if (this.ui.screen === 'world') actors.push(this.fallLeft > 0 ? { ...this.player, fall: 1 - this.fallLeft / LENA_FALL_S, fallDir: this.fallDir } : this.player);
    if (this.dima) actors.push({ ...this.dima, emote: this.ui.celebrate ? 'heart' : null });
    renderScene(g, this.map, actors, {
      season: info.season,
      minute: life?.minute ?? 11 * 60,
      time: this.time,
      weather: this.map.interior ? 'clear' : this.weather(life?.seed ?? 0, info.day, info.season),
    }, { w, h, scale, camX: this.cameraX, camY: this.cameraY, dpr }, {
      target: this.ui.screen === 'world' ? this.targetZone() : null,
      near: this.ui.screen === 'world' ? this.ui.near : null,
      pets: this.dog && this.ui.screen === 'world' ? [this.dog] : [],
    });
    if (this.joy) {
      const r = this.canvas!.getBoundingClientRect();
      const cx = (this.joy.ox - r.left) * dpr;
      const cy = (this.joy.oy - r.top) * dpr;
      g.fillStyle = 'rgba(255,246,224,0.18)';
      g.beginPath();
      g.arc(cx, cy, 46 * dpr, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = 'rgba(255,246,224,0.55)';
      g.beginPath();
      g.arc(cx + this.joy.dx * 44 * dpr, cy + this.joy.dy * 44 * dpr, 20 * dpr, 0, Math.PI * 2);
      g.fill();
    }
  }

  weather(seed: number, day: number, season: Season): Weather {
    const r = rngFor(seed, 'weather', day)();
    if (season === 'winter') return r < 0.75 ? 'snow' : 'clear';
    if (season === 'autumn') return r < 0.35 ? 'leaves' : r < 0.6 ? 'rain' : 'clear';
    if (season === 'spring') return r < 0.4 ? 'petals' : r < 0.55 ? 'rain' : 'clear';
    return r < 0.1 ? 'rain' : 'clear';
  }

  /** Куди веде стрілка: обов'язок дня, а ввечері — додому. */
  targetZone(): Zone | null {
    const life = this.life;
    if (!life) return null;
    const duty = dutyToday(life);
    const check = canDoDuty(life);
    if (duty && check.ok && this.map.city === duty.city && !this.map.interior) {
      return this.map.zones.find((z) => (z.action.type === 'duty' && z.action.building === duty.building) || (z.action.type === 'workplace' && `job:${z.action.job}` === duty.building)) ?? null;
    }
    if (life.minute >= 21 * 60) {
      if (this.map.interior) return this.map.zones.find((z) => z.action.type === 'bed') ?? null;
      if (this.map.city === life.home) return this.map.zones.find((z) => z.action.type === 'home') ?? null;
    }
    return null;
  }

  /** Підказка мети дня для HUD. */
  objective(): string {
    const life = this.life;
    if (!life) return '';
    const duty = dutyToday(life);
    const check = canDoDuty(life);
    if (duty && check.ok) {
      const where = life.city === duty.city ? '' : ` · ${CITIES[duty.city].name}`;
      const by = `${Math.floor(duty.startBy / 60)}:${String(duty.startBy % 60).padStart(2, '0')}`;
      return `${duty.title} — до ${by}${where}`;
    }
    if (life.minute >= 22 * 60) return 'Пора спати — додому';
    const info = today(life);
    if (canVisitLyceum(life) || (info.week === 9 && info.weekend && !life.flags.lyceumVisit)) return 'Мама радить подивитися ліцей у Хмельницькому';
    if (info.stage === 'adult' && !life.job) return 'Обери роботу — дошка вакансій у місті';
    if (info.weekend) return 'Вихідний: гуляй, мандруй, купуй';
    return 'Вільний час';
  }

  // ------------------------------------------------------------
  // Двері-дії.
  // ------------------------------------------------------------
  async interact(zone: Zone): Promise<void> {
    const life = this.life;
    if (!life || this.blocked()) return;
    const a = zone.action;
    sfx.blip();
    switch (a.type) {
      case 'duty': return this.doDuty();
      case 'workplace': {
        if (life.job?.id === a.job && dutyToday(life)?.kind === 'work') return this.doDuty();
        this.openPanel({ kind: 'jobs', focus: a.job });
        return;
      }
      case 'home':
        if (life.home !== this.map.city) { this.toast('Тут живуть інші люди'); return; }
        this.enterHome('door');
        return;
      case 'exit':
        // З літньої кухні — на подвір'я біля неї; з хати в Жилинцях — на
        // своє подвір'я, а не одразу на сільську вулицю.
        if (this.map.id === KITCHEN_ID) this.enterYard('kitchen');
        else if (life.home === 'zhylyntsi') this.enterYard('house');
        else this.enterCity(life.home, 'home');
        await this.checkStory();
        return;
      case 'yard': this.enterYard('gate'); return;
      case 'kitchen': this.enterKitchen(); return;
      case 'village': this.enterCity('zhylyntsi', 'home'); return;
      case 'bed': this.openPanel({ kind: 'sleep' }); return;
      case 'wardrobe': this.openPanel({ kind: 'wardrobe' }); return;
      case 'station': this.openPanel({ kind: 'travel' }); return;
      case 'shop': this.openPanel({ kind: 'shop', shop: a.shop }); return;
      case 'jobs': this.openPanel({ kind: 'jobs' }); return;
      case 'realtor': this.openPanel({ kind: 'realtor' }); return;
      case 'date':
        if (!life.flags.metDima) { this.toast(life.city === 'vinnytsia' ? 'Гарне місце для побачення… колись' : 'Гарне місце'); return; }
        if (!dimaWithLena(life)) { this.toast('Без Діми — ніяк. Поклич його або подзвони'); return; }
        this.openPanel({ kind: 'date' });
        return;
      case 'mom': this.openPanel({ kind: 'mom' }); return;
      case 'dog': this.openPanel({ kind: 'dog' }); return;
      case 'talk': this.openPanel(a.who ? { kind: 'person', id: a.who } : { kind: 'dima' }); return;
      case 'laptop': this.openPanel({ kind: 'laptop' }); return;
      case 'activity': {
        const check = activityCheck(life, a.id);
        if (!check.ok) { this.toast(check.reason); return; }
        this.busy = true;
        const act = ACTIVITY_BY_ID.get(a.id)!;
        await this.showCard({ title: act.title, body: act.blurb, button: 'Далі' });
        this.busy = false;
        await this.attempt((s) => doActivity(s, a.id));
        return;
      }
      case 'decorate': this.openPanel({ kind: 'decorate' }); return;
      case 'walk': return this.goTo(a.to);
      case 'sight': return this.photo(a.sight);
      case 'friends': return this.playFriends();
      case 'lyceum': {
        if (!canVisitLyceum(life)) { this.toast(life.flags.lyceumVisit ? 'Ліцей уже відвідано' : 'Ліцей — улітку після 9 класу'); return; }
        await this.attempt(visitLyceum);
        return;
      }
      case 'stone': return this.stone();
      case 'info': this.toast(a.text); return;
    }
  }

  private async photo(sight: string): Promise<void> {
    this.busy = true;
    sfx.coin();
    await this.attempt((s) => visitSight(s, sight));
    this.busy = false;
  }

  /** Обов'язок дня: садочок, уроки, пари чи зміна. */
  private async doDuty(): Promise<void> {
    const life = this.life!;
    const check = canDoDuty(life);
    if (!check.ok) { this.toast(check.reason); return; }
    const plans = dayPlan(life);
    const duty = dutyToday(life)!;
    const scores = await this.runActivity(plans, duty.title);
    if (duty.kind === 'work') await this.attempt((s) => workShift(s, scores[0] ?? 0));
    else await this.attempt((s) => attendStudy(s, scores));
    await this.checkStory();
  }

  private async playFriends(): Promise<void> {
    const life = this.life!;
    if (life.doneToday.includes('friends')) { this.toast('Сьогодні вже гралися — завтра ще!'); return; }
    const { plan } = friendsGame(life, this.player.look);
    await this.say([['o', 'Лєно, ходи до нас! Пограємо?']]);
    await this.runActivity([plan], 'Гра з друзями');
    await this.attempt(playWithFriends);
  }

  /** Послідовність міні-ігор: вступ → ігри → оцінки. */
  runActivity(plans: PlannedGame[], title: string): Promise<number[]> {
    const life = this.life!;
    return new Promise((resolve) => {
      const scores: number[] = [];
      const playNext = (index: number) => {
        if (index >= plans.length) {
          this.game = null;
          this.setUi({ activity: null });
          this.persist();
          resolve(scores);
          return;
        }
        this.game = makeGame(life, plans[index]!, this.player.look);
        this.gameDone = (score) => {
          scores.push(score);
          this.setUi({ activity: { plans, index, phase: 'between', title, scores: [...scores] } });
          window.setTimeout(() => playNext(index + 1), 900);
        };
        this.setUi({ activity: { plans, index, phase: 'play', title, scores: [...scores] } });
      };
      this.setUi({ activity: { plans, index: 0, phase: 'intro', title, scores: [] } });
      this.waiters.intro = () => playNext(0);
    });
  }

  startActivity(): void {
    const w = this.waiters.intro;
    this.waiters.intro = undefined;
    w?.();
  }

  private skipGame(): void {
    if (!this.game || !this.gameDone) return;
    const done = this.gameDone;
    this.gameDone = null;
    done(0);
  }

  private renderGame(g: CanvasRenderingContext2D, w: number, h: number, dpr: number): void {
    const game = this.game!;
    const kit = this.kit;
    kit.begin(g, w, h, dpr, this.time);
    g.fillStyle = '#2a1a20';
    g.fillRect(0, 0, kit.W, kit.H);
    game.render(kit);
    // Табличка вгорі: назва й підказка.
    const act = this.ui.activity!;
    kit.panel(4, 4, kit.W - 8, 38, 'wood');
    kit.text(game.title, kit.W / 2, 15, { size: 11, color: '#fff2cf' });
    kit.text(game.hint, kit.W / 2, 31, { size: 7.5, color: '#fbe7b8', shadow: null, maxWidth: kit.W - 24 });
    kit.text(`${act.index + 1}/${act.plans.length}`, 16, 15, { size: 8, color: '#fbe7b8', shadow: null });
    if (!game.done) kit.button('__skip', kit.W - 36, 6, 30, 12, 'Далі', { tone: 'paper', size: 6 });
    if (game.done) {
      g.fillStyle = 'rgba(30,18,24,0.45)';
      g.fillRect(0, 0, kit.W, kit.H);
      kit.panel(kit.W / 2 - 70, kit.H / 2 - 30, 140, 60, 'paper');
      const mark = Math.max(1, Math.round(1 + game.score * 11));
      kit.text(game.score >= 0.75 ? 'Чудово!' : game.score >= 0.45 ? 'Добре!' : 'Наступного разу вийде', kit.W / 2, kit.H / 2 - 10, { size: 11, color: '#4a2a14', shadow: null });
      kit.text(`${mark} з 12`, kit.W / 2, kit.H / 2 + 12, { size: 14, color: '#b8703a', shadow: null });
    }
  }

  // ------------------------------------------------------------
  // Дорога, сон, історія.
  // ------------------------------------------------------------
  async goTo(city: CityId): Promise<void> {
    const life = this.life!;
    const before = life.city;
    const ok = await this.attempt((s) => travel(s, city));
    if (!ok) return;
    this.closePanel();
    const walked = CITIES[before].kind === 'village' && CITIES[city].kind === 'village';
    this.busy = true;
    await this.showCard({ title: `${CITIES[before].name} → ${CITIES[city].name}`, body: walked ? 'Стежкою через поле…' : 'Дорога…', button: 'Приїхали' });
    this.busy = false;
    this.enterCity(city, walked ? 'walk' : 'station');
    await this.checkStory();
  }

  async goToSleep(): Promise<void> {
    this.closePanel();
    await this.sleepNow(false);
  }

  private async passOut(): Promise<void> {
    this.busy = true;
    await this.showCard({ title: 'Лєна заснула від утоми', body: 'Наступного разу краще лягти вчасно.' });
    this.busy = false;
    await this.sleepNow(true);
  }

  private async sleepNow(passedOut: boolean): Promise<void> {
    const life = this.life!;
    let outcome: Outcome;
    try {
      outcome = sleep(life, passedOut);
    } catch (e) {
      if (e instanceof LifeRuleError) { this.toast(e.message); return; }
      throw e;
    }
    const before = today(life);
    const after = dayInfo(outcome.state.day);
    this.commit(outcome.state);
    this.minuteAcc = 0;
    const lines = [`${after.dayName}, ${after.monthName} ${after.calendarYear}`];
    if (after.week !== before.week) lines.push(`Новий рік життя: Лєні ${after.age}`);
    await this.showCard({ title: 'Добраніч…', lines, button: 'Прокинутись' });
    await this.showEvents(outcome.events);
    this.enterHome('wake');
    await this.checkStory();
  }

  /** Сцени справжньої історії, коли настає їхній час. */
  async checkStory(): Promise<void> {
    const life = this.life;
    if (!life || this.map.interior) return;
    if (meetingDue(life) && this.map.city === 'vinnytsia') await this.meetScene();
  }

  private async meetScene(): Promise<void> {
    this.busy = true;
    await this.say([['n', 'Четвертий курс. І раптом — повідомлення в дайвінчику…']]);
    this.dima = { id: 'dima', x: this.player.x + 70, y: this.player.y, dir: 1, moving: true, t: 0, look: DIMA };
    // Діма підходить.
    await new Promise<void>((resolve) => {
      const step = () => {
        const d = this.dima!;
        d.x -= 1.4;
        d.t += 0.03;
        if (d.x <= this.player.x + 20) { d.moving = false; resolve(); return; }
        requestAnimationFrame(step);
      };
      step();
    });
    this.player.dir = 2;
    sfx.love();
    this.setUi({ celebrate: true });
    await this.say([
      ['d', 'Класна ава, Лєна!'],
      ['l', 'У тебе також класна ава!'],
      ['d', 'Давай зустрічатись через дайвінчик.'],
      ['n', 'Трохи згодом…'],
      ['d', 'Бубос, люблю тебе.'],
      ['l', 'Люблю тебе, гівнюк.'],
      ['n', 'І з цього почалося все.'],
    ]);
    this.setUi({ celebrate: false });
    await this.say([['d', 'Напиши, як захочеш погуляти. Я завжди на зв\'язку.']]);
    await this.attempt(meetDima);
    this.trail = [];
    this.busy = false;
  }

  private async stone(): Promise<void> {
    const life = this.life!;
    const check = proposalCheck(life);
    if (!check.ok) {
      if (!life.photos.includes('yellowStone')) await this.attempt((s) => visitSight(s, 'yellowStone'));
      this.toast(check.reason);
      return;
    }
    this.busy = true;
    await this.showCard({ title: 'Літо 2026 · Одеса', body: 'Цілий день моря, сонця й морозива. А ввечері — Жовтий камінь на Отраді.', tone: 'gold' });
    this.life = { ...life, minute: Math.max(life.minute, 20 * 60) };
    this.emit();
    if (this.dima) { this.dima.x = this.player.x + 20; this.dima.y = this.player.y; this.dima.dir = 1; }
    this.player.dir = 2;
    await this.say([['d', 'Лєно…']]);
    sfx.love();
    await new Promise<void>((resolve) => { this.waiters.ask = resolve; this.setUi({ ask: true }); });
    await this.attempt(propose);
    sfx.tada();
    this.setUi({ celebrate: true });
    await this.showCard({ title: 'ВОНА СКАЗАЛА «ТАК»!', body: '13.07.2026 · пляж Отрада, Одеса', lines: ['Жилинці → Хмельницький → Правдівка →', 'Вінниця (ВДПУ · Вишенька · вокзал) → Одеса'], tone: 'love', button: 'Жити далі разом' });
    this.setUi({ celebrate: false });
    this.busy = false;
  }

  answerYes(): void {
    const w = this.waiters.ask;
    this.waiters.ask = undefined;
    this.setUi({ ask: false });
    w?.();
  }

  // ------------------------------------------------------------
  // Інтерфейс: тости, картки, діалоги, панелі.
  // ------------------------------------------------------------
  toast(text: string): void {
    const id = (this.toastId += 1);
    this.setUi({ toasts: [...this.ui.toasts.slice(-2), { id, text }] });
    window.setTimeout(() => this.setUi({ toasts: this.ui.toasts.filter((t) => t.id !== id) }), 2600);
  }

  showCard(card: Card): Promise<void> {
    return new Promise((resolve) => {
      this.waiters.card = resolve;
      this.setUi({ card });
    });
  }

  closeCard(): void {
    const w = this.waiters.card;
    this.waiters.card = undefined;
    this.setUi({ card: null });
    w?.();
  }

  say(lines: [Speaker, string][]): Promise<void> {
    return new Promise((resolve) => {
      this.waiters.dialog = resolve;
      this.setUi({ dialog: { lines: lines.map(([who, text]) => ({ who, text })), i: 0 } });
    });
  }

  advanceDialog(): void {
    const d = this.ui.dialog;
    if (!d) return;
    sfx.blip();
    if (d.i + 1 < d.lines.length) { this.setUi({ dialog: { ...d, i: d.i + 1 } }); return; }
    const w = this.waiters.dialog;
    this.waiters.dialog = undefined;
    this.setUi({ dialog: null });
    w?.();
  }

  private async showEvents(events: LifeEvent[]): Promise<void> {
    for (const e of events) {
      if (e.kind === 'toast') this.toast(e.text);
      if (e.kind === 'card') await this.showCard({ title: e.text });
      if (e.kind === 'milestone') { sfx.tada(); await this.showCard({ title: 'Нова сторінка альбому', body: e.text, tone: 'gold' }); }
      if (e.kind === 'story') await this.say([['n', e.text]]);
    }
  }

  openPanel(panel: Panel): void {
    this.joy = null;
    this.setUi({ panel });
  }

  closePanel(): void {
    if (this.ui.panel) this.setUi({ panel: null });
  }

  /** Дія з панелі, що змінює стан (купити, взяти роботу, переїхати…). */
  async act(fn: (s: LifeState) => Outcome): Promise<boolean> {
    return this.attempt(fn);
  }

  commitWear(next: LifeState): void {
    this.commit(next);
    sfx.blip();
  }

  /** Переставити меблі й одразу перебудувати кімнату (Лєна стоїть де стояла). */
  rearrange(slot: DecorSlot, dx: number, dy: number): void {
    const life = this.life;
    if (!life || !this.map.interior) return;
    try {
      this.commit(moveFurniture(life, slot, dx, dy));
    } catch (e) {
      if (e instanceof LifeRuleError) { this.toast(e.message); return; }
      throw e;
    }
    this.map = homeInterior(this.life!);
    this.emit();
  }

  residentLook(id: string): Look {
    return RESIDENT_LOOKS[id] ?? DIMA;
  }

  dimaLook(): Look {
    return DIMA;
  }

  /** Погладити Басю: сідає біля Лєни, над нею сердечко. */
  async petBasia(): Promise<void> {
    if (await this.attempt(petBasia) && this.dog) this.dog = { ...this.dog, happy: DOG_HAPPY_S };
  }

  /** Нагодувати Басю — раз на день. */
  async feedBasia(): Promise<void> {
    if (await this.attempt(feedBasia) && this.dog) this.dog = { ...this.dog, happy: DOG_HAPPY_S + 1 };
  }

  momLook(): Look {
    return MOM;
  }

  /** Побачення: правило → маленька сцена з сердечками. */
  async date(kind: 'walk' | 'cafe' | 'cinema', fn: (s: LifeState) => Outcome): Promise<void> {
    const ok = await this.attempt(fn);
    if (!ok) return;
    this.closePanel();
    sfx.love();
    this.setUi({ celebrate: true });
    const lines: Record<typeof kind, [Speaker, string][]> = {
      walk: [['d', 'Дивись, яке небо сьогодні.'], ['l', 'Гарне. Але з тобою — ще краще.']],
      cafe: [['d', 'Тобі капучино з корицею, як завжди?'], ['l', 'Ти пам\'ятаєш!']],
      cinema: [['n', 'Попкорн, темна зала і рука в руці.'], ['l', 'Наступного разу фільм обираю я!']],
    };
    await this.say(lines[kind]);
    this.setUi({ celebrate: false });
  }

  /** Поговорити з мамою: репліки за віком. */
  momLines(): [Speaker, string][] {
    const life = this.life!;
    const info = today(life);
    const r = rngFor(life.seed, 'mom', life.day);
    const pools: [Speaker, string][][] = info.stage === 'sadok'
      ? [[['m', 'Поїж вареничків, і бігом гратися!']], [['m', 'У садочку сьогодні буде хоровод. Ти ж підеш?']]]
      : info.stage === 'school'
        ? [[['m', 'Як уроки? Математика вже не страшна?']], [['m', 'Кишенькові — на понеділок. Не все на морозиво, добре?']], [['m', 'Оля питала про тебе. Подзвони їй.']]]
        : [[['m', 'Доню, як ти там у місті? Їси нормально?']], [['m', 'Приїжджай частіше. Пиріжки завжди чекають.']], [['m', 'Передавай Дімі привіт!']]];
    return pools[Math.floor(r() * pools.length)]!;
  }

  personName(p: PersonId): string {
    return { mom: 'Мама', dima: 'Діма', friend: 'Оля' }[p];
  }

  /** Для HUD: де Лєна зараз. */
  placeName(): string {
    return this.map.interior && this.map.id !== KITCHEN_ID ? this.life?.homeName ?? '' : this.map.name;
  }

  shiftJobTitle(): string | null {
    const job = this.life?.job ? JOB_BY_ID.get(this.life.job.id) : null;
    return job ? `${job.ranks[this.life!.job!.rank]} · ${job.place}` : null;
  }

  /** Скільки до кінця дня (для HUD). */
  static dayLeft(life: LifeState): number {
    return Math.max(0, DAY_END_MIN - life.minute);
  }

  sightName(id: string): string {
    return SIGHTS.find((s) => s.id === id)?.name ?? id;
  }
}

