import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// ============================================================
// Wish Spheres — вимоги власника до вигляду й ціни сфер.
// ------------------------------------------------------------
// Три з них не можна перевірити нічим, крім самого файлу стилів: сфера не
// має бути аватаркою, вона не має коштувати як друга сцена, і приглушення
// фону не має дотягтись до головної. Кожна названа вимогою, а не смаком.
// ============================================================

const ROOT = join(__dirname, '../../..');
const CSS = readFileSync(join(ROOT, 'src/features/wishlist/wishlistSpheres.css'), 'utf8');
const BARE = CSS.replace(/\/\*[\s\S]*?\*\//g, '');

function block(selector: string): string {
  const at = BARE.indexOf(`${selector} {`);
  expect(at, selector).toBeGreaterThan(-1);
  const body = BARE.slice(at);
  return body.slice(body.indexOf('{'), body.indexOf('}'));
}

describe('the sphere is glass, not an avatar', () => {
  it('fills the whole ball with the photo, and keeps the glass on top of it', () => {
    // ЗМІНЕНА ВИМОГА, і змінив її власник: «зроби фото в сфері круглими, щоб
    // фото в кулі виглядало органічно без кутів, фото розтягни рівномірно по
    // кулі, щоб ціла куля відображала своє фото».
    //
    // Тут стояла протилежна перевірка: зображення мусило вписуватись цілком
    // (`contain`), займати менше за кулю й гаснути маскою — початковий бриф
    // забороняв кругле обрізання прямим текстом, бо куля перетворювалась би на
    // аватарку.
    //
    // Заборона не зникла, а переїхала. Різницю між «предмет під склом» і
    // «аватарка в рамці» тепер тримає не розмір фото, а те, що лежить ПОВЕРХ
    // нього, — і саме це перевіряється нижче. Приберуть шар скла — тест
    // впаде, бо тоді в кулі справді лишиться сама лиш кругла фотографія.
    const image = block('.wl-sphere-field .wl-sphere__image');
    expect(image).toMatch(/object-fit:\s*cover/);
    expect(image).toMatch(/inset:\s*0/);
    expect(image).toMatch(/border-radius:\s*50%/);

    // Скло поверх фото: рожева димка, світло згори й товща знизу — в одному
    // шарі, і він мусить лежати вище за фото.
    const glass = block('.wl-sphere-field .wl-sphere__body::after');
    expect(glass).toMatch(/z-index:\s*[1-9]/);
    expect(glass).toMatch(/radial-gradient/);
    // Рожева димка названа вимогою окремо, тож і перевіряється окремо: у
    // шарі мусить бути справді рожевий, а не ще один бузковий.
    const pinks = [...glass.matchAll(/rgba\((\d+),\s*(\d+),\s*(\d+)/g)]
      .map(([, r, g, b]) => ({ r: Number(r), g: Number(g), b: Number(b) }));
    expect(pinks.some((c) => c.r > 200 && c.b > 150 && c.r - c.g > 60)).toBe(true);

    // І блік — над усім: скло перед предметом, а не поруч із ним.
    const specular = block('.wl-sphere-field .wl-sphere__body::before');
    expect(specular).toMatch(/z-index:\s*[1-9]/);
  });

  it('keeps the object recognisable rather than turning it into a pink blur', () => {
    // «Не перетворюй його на сіру/рожеву пляму», і числа названі: насиченість
    // 70–90%, непрозорість 80–95%, трохи менший контраст.
    const image = block('.wl-sphere-field .wl-sphere__image');
    const saturation = /saturate\(([\d.]+)\)/.exec(image);
    const opacity = /opacity:\s*([\d.]+)/.exec(image);
    expect(saturation).not.toBeNull();
    expect(Number(saturation![1])).toBeGreaterThanOrEqual(0.7);
    expect(Number(saturation![1])).toBeLessThanOrEqual(0.9);
    expect(opacity).not.toBeNull();
    expect(Number(opacity![1])).toBeGreaterThanOrEqual(0.8);
    expect(Number(opacity![1])).toBeLessThanOrEqual(0.95);
    expect(image).not.toMatch(/filter:[^;]*blur\(/);
  });

  it('draws the rim as a hairline arc, not as a border', () => {
    const rim = block('.wl-sphere-field .wl-sphere__rim');
    expect(rim).not.toMatch(/\bborder:\s*[^;]*px/);
    expect(rim).toMatch(/mask:\s*radial-gradient/);
  });
});

describe('the price stays low (§18)', () => {
  it('never puts a backdrop pass on a sphere', () => {
    // Двадцять прозорих кіл із власним `backdrop-filter` — це двадцять
    // проходів по фону за кадр на телефоні. Скло тут робиться градієнтами.
    expect(BARE).not.toContain('backdrop-filter');
  });

  it('blurs the background lightly, and not at all on a weak device', () => {
    // Змінена вимога, і змінив її власник: «додай легенький блюр на фоні в
    // вішлисті, щоб трішки відділити модуль від фону».
    //
    // Раніше тут стояла заборона: жодного фільтра по полотну. Причина була
    // правильна — розмиття повноекранного анімованого полотна браузер
    // перераховує щокадру. Тому заборона не зникла, а звузилась до того, де
    // вона справді потрібна: на слабкому профілі розмиття немає.
    //
    // Правила переїхали з файлу вішліста у `features/world/worldDim.css`, коли
    // того самого приглушення забажав другий модуль. Перевіряються там, де
    // живуть, — але перевіряються ті самі властивості.
    const dim = readFileSync(join(ROOT, 'src/features/world/worldDim.css'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '');
    const at = dim.indexOf("[data-world-scene='dim'] .artifact-world {");
    expect(at, 'правило розмиття має існувати').toBeGreaterThan(-1);
    const scene = dim.slice(at, dim.indexOf('}', at));
    expect(dim).toMatch(/\.artifact-world::after \{[^}]*background:/);
    const radius = /blur\((\d+(?:\.\d+)?)px\)/.exec(scene);
    expect(radius, 'фон має розмиватись').not.toBeNull();
    // «Легенький»: фон лишається впізнаваним, а не перетворюється на пляму.
    expect(Number(radius![1])).toBeGreaterThan(0);
    expect(Number(radius![1])).toBeLessThanOrEqual(6);
    // Без масштабу розмиття лишає світлу смугу по краях екрана: `blur()` бере
    // за межами елемента прозорість.
    expect(scene).toMatch(/transform:\s*scale\(1\.0[1-9]\)/);

    // Слабкий профіль розмиття не платить.
    const spared = dim.slice(dim.indexOf("[data-world-quality='low']"));
    expect(spared).toMatch(/filter:\s*none/);
    expect(dim).toContain("[data-world-quality='fallback']");
  });
});

describe('the wishlist changes nothing on Home', () => {
  it('reaches the shared scene only through the module marker', () => {
    // Головна має виглядати так само, як до цієї роботи. Це і є та вимога,
    // заради якої перевірка існує, — і вона не змінилась від переїзду правил
    // у спільний файл: сам вішліст спільної сцени більше не торкається взагалі,
    // а те, що торкається, стоїть під маркером, який ставить і знімає сторінка
    // модуля.
    expect(BARE).not.toContain('.artifact-world');
    const dim = readFileSync(join(ROOT, 'src/features/world/worldDim.css'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '');
    for (const line of dim.split('\n')) {
      if (!line.includes('.artifact-world')) continue;
      expect(line, line).toContain("[data-world-scene='dim']");
    }
  });
});

describe('reduced motion (§20)', () => {
  it('keeps the spatial composition but stops the drift', () => {
    const at = BARE.indexOf('@media (prefers-reduced-motion: reduce)');
    expect(at).toBeGreaterThan(-1);
    const body = BARE.slice(at);
    expect(body).toMatch(/animation:\s*none/);

    // Позиції лишаються: сузір'я — це композиція, а не анімація, і ховати його
    // разом із рухом означало б забрати в §20 сам модуль.
    //
    // Перевірка звузилась із «жодного display: none у блоці» до «жодного на
    // самій сфері», і це не послаблення. З'явився шар-двійник прощання: він
    // існує РІВНО заради вильоту, і без руху йому нема чого показувати —
    // сховати його тут правильно, а тримати на екрані нерухомим було б гірше
    // за будь-яку анімацію.
    for (const rule of body.split('}')) {
      if (!/display:\s*none/.test(rule)) continue;
      // Останній селектор перед оголошеннями: у блоці всередині @media
      // перший шматок — сам медіазапит, а не те, до чого правило застосоване.
      const selector = rule.split('{').at(-2) ?? '';
      expect(selector, rule).toContain('farewell');
    }
  });
});
