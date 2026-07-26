// ============================================================
// Регресія: конвеєр зображень бажань не сміє зависати назавжди.
// ------------------------------------------------------------
// Баг, від якого страхують ці тести. Обробка картинок іде через ОДНУ
// послідовну чергу, і в ній було чотири нічим не обмежені очікування:
// `fetch` до CDN магазину, виклик Edge-проксі, `await requestAnimationFrame`
// і динамічний `import()` моделі сегментації. Будь-яке з них, застрягши,
// назавжди зупиняло обробку ВСІХ інших картинок — саме це користувач бачив
// як «частина бажань вічно вантажиться».
//
// Найпідступніше — rAF: планувальник перевіряє видимість вкладки ПЕРЕД
// постановкою в чергу, але вкладку можна згорнути через мить після
// перевірки, а у прихованій вкладці rAF не викликається взагалі.
// ============================================================
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  nextWishlistImageFrame,
  WishlistImageTimeoutError,
  withWishlistImageTimeout,
} from './wishlistImageTimeouts';
import { WishlistImageProcessingQueue } from './wishlistImageProcessingScheduler';

const never = (): Promise<never> => new Promise<never>(() => undefined);

describe('обмеження часу в конвеєрі зображень', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('проміс, що не завершується, все одно падає за стелею часу', async () => {
    const guarded = withWishlistImageTimeout(never(), 1000, 'image_fetch_timeout');
    const assertion = expect(guarded).rejects.toBeInstanceOf(WishlistImageTimeoutError);
    await vi.advanceTimersByTimeAsync(1000);
    await assertion;
  });

  it('успішний результат проходить як є і не чіпається таймером', async () => {
    const guarded = withWishlistImageTimeout(Promise.resolve('ready'), 1000, 'image_fetch_timeout');
    await expect(guarded).resolves.toBe('ready');
    // Таймер знято: далі час можна крутити скільки завгодно без відхилень.
    await vi.advanceTimersByTimeAsync(5000);
  });

  it('код помилки зберігається — по ньому видно, ЩО саме зависло', async () => {
    const guarded = withWishlistImageTimeout(never(), 50, 'portrait_model_timeout');
    const assertion = expect(guarded).rejects.toThrow('portrait_model_timeout');
    await vi.advanceTimersByTimeAsync(50);
    await assertion;
  });
});

describe('очікування кадру у прихованій вкладці', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('завершується навіть якщо requestAnimationFrame мовчить (згорнута вкладка)', async () => {
    // Точна модель прихованої вкладки: rAF зареєстрований і НІКОЛИ не
    // викликається. Стара версія (`await new Promise(r => rAF(r))`) тут
    // висіла б вічно й замикала чергу.
    vi.stubGlobal('requestAnimationFrame', () => 1);
    let done = false;
    void nextWishlistImageFrame(200).then(() => {
      done = true;
    });

    await vi.advanceTimersByTimeAsync(199);
    expect(done, 'відпустило раніше за стелю').toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(done).toBe(true);
  });

  it('коли кадр приходить — чекаємо саме його, а не стелю', async () => {
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      setTimeout(() => cb(0), 5);
      return 1;
    });
    let done = false;
    void nextWishlistImageFrame(200).then(() => {
      done = true;
    });

    await vi.advanceTimersByTimeAsync(5);
    expect(done).toBe(true);
  });

  it('без rAF узагалі (не-браузерне середовище) — просто йдемо далі', async () => {
    vi.stubGlobal('requestAnimationFrame', undefined);
    await expect(nextWishlistImageFrame(200)).resolves.toBeUndefined();
  });
});

describe('черга обробки — одне завдання не блокує решту', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('зависле завдання відпускає чергу за стелею, наступне виконується', async () => {
    // Головна регресія фази: раніше таке завдання зупиняло конвеєр до
    // перезавантаження сторінки.
    const queue = new WishlistImageProcessingQueue(1000);
    const stuck = queue.enqueue(() => never());
    const next = queue.enqueue(async () => 'ready');

    const stuckAssertion = expect(stuck).rejects.toBeInstanceOf(WishlistImageTimeoutError);
    await vi.advanceTimersByTimeAsync(1000);
    await stuckAssertion;
    await expect(next).resolves.toBe('ready');
  });

  it('стеля не зачіпає нормальні завдання', async () => {
    const queue = new WishlistImageProcessingQueue(1000);
    const task = queue.enqueue(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      return 'ok';
    });
    await vi.advanceTimersByTimeAsync(10);
    await expect(task).resolves.toBe('ok');
  });
});
