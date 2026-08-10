import { describe, expect, it } from 'vitest';
import {
  DEFAULTS,
  DEVICES,
  OptionError,
  ROUTES,
  parseShotArgs,
  plannedShots,
  routePath,
  shotName,
} from './options.mjs';

// ============================================================
// Розбір аргументів живої перевірки.
// ------------------------------------------------------------
// Тут перевіряється не зручність, а достовірність: помилка в розборі не падає,
// вона тихо знімає інший екран — і на той знімок дивляться як на правду.
// Тому кожна невідома назва мусить бути помилкою, а не мовчазним запасним
// варіантом.
// ============================================================

describe('routes', () => {
  it('accepts short names and raw hash paths', () => {
    expect(routePath('wishlist')).toBe('#/wishlist');
    expect(routePath('home')).toBe('#/');
    expect(routePath('#/wishlist?tab=partner')).toBe('#/wishlist?tab=partner');
    expect(routePath('/plans')).toBe('#/plans');
  });

  it('refuses an unknown name instead of opening something else', () => {
    // Невідомий шлях застосунок веде на головну через `*`. Мовчазний запасний
    // варіант тут означав би знімок головної, підписаний іменем модуля.
    expect(() => routePath('вішліст')).toThrow(OptionError);
    expect(() => routePath('')).toThrow(OptionError);
  });

  it('names files from the route, the device and the tier', () => {
    expect(shotName('#/wishlist', 'phone', 'high')).toBe('wishlist-phone');
    expect(shotName('#/', 'wide', 'high')).toBe('home-wide');
    // Профіль у назві лише тоді, коли він не типовий — інакше кожен знімок
    // тягав би зайве слово.
    expect(shotName('#/wishlist', 'phone', 'low')).toBe('wishlist-phone-low');
    expect(shotName('#/wishlist?tab=partner', 'phone', 'high')).toBe('wishlist-tab-partner-phone');
    // Живий і заморожений кадри того самого екрана відрізняються на десяту
    // частину пікселів — вони не мають ділити одне ім'я файлу.
    expect(shotName('#/', 'phone', 'high', { still: true })).toBe('home-phone-still');
  });
});

describe('arguments', () => {
  it('defaults to the phone and the home route', () => {
    const parsed = parseShotArgs([]);
    expect(parsed.routes).toEqual([ROUTES.home]);
    expect(parsed.devices).toHaveLength(1);
    expect(parsed.devices[0].name).toBe(DEFAULTS.device);
    expect(parsed.devices[0].width).toBe(DEVICES.phone.width);
    expect(parsed.settle).toBe(DEFAULTS.settle);
  });

  it('takes several routes and several devices at once', () => {
    const parsed = parseShotArgs(['home', 'wishlist', '--device=phone,wide']);
    expect(parsed.routes).toEqual(['#/', '#/wishlist']);
    expect(parsed.devices.map((device) => device.name)).toEqual(['phone', 'wide']);
    expect(plannedShots(parsed).map((shot) => shot.name)).toEqual([
      'home-phone', 'home-wide', 'wishlist-phone', 'wishlist-wide',
    ]);
  });

  it('carries the frozen-scene flag into the file name', () => {
    const parsed = parseShotArgs(['home', '--still']);
    expect(parsed.still).toBe(true);
    expect(plannedShots(parsed)[0].name).toBe('home-phone-still');
  });

  it('collects repeated probes', () => {
    const parsed = parseShotArgs(['wishlist', '--probe=.wl-sphere', '--probe=.wl-world-nav']);
    expect(parsed.probes).toEqual(['.wl-sphere', '.wl-world-nav']);
  });

  it('carries the device profile the engine reads', () => {
    // Якість сцени вибирається з `navigator.deviceMemory` і
    // `hardwareConcurrency`; без підміни перевірялась би завжди одна гілка.
    expect(parseShotArgs(['--tier=low']).tier).toMatchObject({ name: 'low', memory: 4, cores: 4 });
    expect(parseShotArgs([]).tier.name).toBe('high');
  });

  it('refuses nonsense rather than guessing', () => {
    expect(() => parseShotArgs(['--device=watch'])).toThrow(OptionError);
    expect(() => parseShotArgs(['--tier=ultra'])).toThrow(OptionError);
    expect(() => parseShotArgs(['--theme=neon'])).toThrow(OptionError);
    expect(() => parseShotArgs(['--port=nope'])).toThrow(OptionError);
    expect(() => parseShotArgs(['--settle=-1'])).toThrow(OptionError);
    expect(() => parseShotArgs(['--zoom=2'])).toThrow(OptionError);
  });
});
