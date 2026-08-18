import { describe, expect, it } from 'vitest';
import { MAX_PIXEL_RATIO, stepFor, thumbUrl } from './imageCdn';

const OBJECT = 'https://x.supabase.co/storage/v1/object/public/photo-calendar/2026/08/a.webp';
const RENDER = 'https://x.supabase.co/storage/v1/render/image/public/photo-calendar/2026/08/a.webp';

describe('сходинки ширини', () => {
  it('бере найменшу, якої вистачає', () => {
    expect(stepFor(100)).toBe(128);
    expect(stepFor(128)).toBe(128);
    expect(stepFor(129)).toBe(192);
    expect(stepFor(500)).toBe(512);
  });

  it('округлення справді склеює сусідні ширини в одну сходинку', () => {
    /*
     * Головна причина, чому сходинки взагалі існують. Кожна пара
     * (файл, ширина) — окремий запис у кеші CDN; без округлення 118, 124 і
     * 127 пікселів дали б три різні файли на трьох телефонах, і жоден не
     * влучив би в чужий прогрітий кеш.
     *
     * Перевіряємо саме проміжок МІЖ сходинками: на самій межі (129) перехід
     * на наступну сходинку правильний, і склеювати там нічого не треба.
     */
    expect(new Set([118, 124, 127, 128].map(stepFor)).size).toBe(1);
    expect(new Set([200, 240, 256].map(stepFor)).size).toBe(1);
  });

  it('понад найбільшу сходинку не просить', () => {
    // Знімки стискаються при завантаженні до ~1280–1600 по довгій стороні;
    // просити більше — це просити те, чого у файлі немає.
    expect(stepFor(5000)).toBe(1600);
  });

  it('безглузда ширина не дає NaN в адресі', () => {
    expect(stepFor(0)).toBe(128);
    expect(stepFor(-10)).toBe(128);
    expect(stepFor(Number.NaN)).toBe(128);
  });
});

describe('адреса мініатюри', () => {
  it('публічний обʼєкт сховища йде через render', () => {
    const url = thumbUrl(OBJECT, 128, { dpr: 1 });
    expect(url).toContain('/storage/v1/render/image/public/');
    expect(url).toContain('width=128');
    expect(url).toContain('quality=72');
  });

  it('режим масштабування заданий — інакше сервер ОБРІЗАЄ кадр', () => {
    /*
     * Регресія на мовчазну ваду, яку видно лише у виміряних байтах.
     *
     * Supabase із самою `width` не масштабує знімок пропорційно: він лишає
     * оригінальну висоту й вирізає вертикальну смугу посередині. Виміряно
     * на файлі 1200×1600:
     *
     *   ?width=384                → 384×1600 (смуга з середини)
     *   ?width=384&resize=contain → 384×512  (той самий кадр, менший)
     *
     * Перша редакція параметра не ставила, і галерея показала б усі
     * фотографії обрізаними по боках.
     */
    expect(thumbUrl(OBJECT, 128, { dpr: 1 })).toContain('resize=contain');
  });

  it('щільність екрана множить ширину', () => {
    expect(thumbUrl(OBJECT, 128, { dpr: 2 })).toContain('width=256');
  });

  it('щільність вища за дві не оплачується трафіком', () => {
    /*
     * На DPR 3 «чесна» ширина важила б у 2.25 раза більше, а різницю на
     * фотографії побачити майже неможливо. Стеля — свідомий компроміс на
     * користь того, хто дивиться галерею з мобільного інтернету.
     */
    expect(MAX_PIXEL_RATIO).toBe(2);
  });

  it('чужий CDN лишається недоторканим', () => {
    // Дописаний `?width=` до підписаного URL у кращому разі буде
    // проігнорований, у гіршому — зламає підпис.
    const cloudinary = 'https://res.cloudinary.com/demo/image/upload/v1/a.jpg';
    expect(thumbUrl(cloudinary, 128)).toBe(cloudinary);
    expect(thumbUrl('blob:http://localhost/abc', 128)).toBe('blob:http://localhost/abc');
    expect(thumbUrl('data:image/png;base64,AAA', 128)).toBe('data:image/png;base64,AAA');
  });

  it('уже трансформована адреса не обробляється вдруге', () => {
    const once = `${RENDER}?width=256&quality=72`;
    expect(thumbUrl(once, 128)).toBe(once);
  });

  it('власні параметри вихідної адреси зберігаються', () => {
    /*
     * `?t=…` дописує сам застосунок після перезавантаження знімка — саме
     * він робить URL унікальним і пробиває кеш браузера. Якби мініатюра
     * його з'їдала, пара бачила б старе фото після заміни.
     */
    const url = thumbUrl(`${OBJECT}?t=1782236632436`, 128, { dpr: 1 });
    expect(url).toContain('t=1782236632436');
    expect(url).toContain('width=128');
  });

  it('порожнє значення не дає рядка «undefined» в атрибуті src', () => {
    expect(thumbUrl(null, 128)).toBe('');
    expect(thumbUrl(undefined, 128)).toBe('');
    expect(thumbUrl('', 128)).toBe('');
  });

  it('якість можна знизити там, де кадр іде під затемненням', () => {
    expect(thumbUrl(OBJECT, 128, { dpr: 1, quality: 55 })).toContain('quality=55');
  });

  it('шлях до файлу не спотворюється', () => {
    const url = thumbUrl(OBJECT, 128, { dpr: 1 });
    expect(url).toContain('photo-calendar/2026/08/a.webp');
  });
});
