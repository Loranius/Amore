import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SHARED_ARTIFACT_KEY } from './sharedArtifact';
import { HOME_ARTIFACT_STORAGE_KEY } from '@/features/home/homeArtifact';

// ============================================================
// Вид артефакта — вибір ПАРИ (ADR-0209 §17).
// ------------------------------------------------------------
// ВИМОГА, І ВОНА Є РІШЕННЯМ ВЛАСНИКА (2026-09-26). ADR-0081 лишив вибір
// у `localStorage` і назвав це межею дослівно: «вибір, перенесений у
// settings, став би спільним — а чи цього хоче пара, вирішує власник».
// Вирішено: спільний. До цього один партнер міг обрати дерево, а другий
// на своєму телефоні й далі бачив кристал.
//
// Перевірка статична: у наборі немає DOM, а це React-провайдер. Саму
// поведінку виміряно на живому порталі з перехопленим записом — у базу
// пари не пішло нічого.
// ============================================================

const world = readFileSync(join(__dirname, 'ArtifactWorld.tsx'), 'utf8')
  // Коментарі знімаються: вони цитують і старий, і новий код.
  .replace(/\/\*[\s\S]*?\*\//g, (match) => match.replace(/[^\n]/g, ' '))
  .replace(/(^|[^:])\/\/[^\n]*/g, (_match, lead: string) => lead);

const module = readFileSync(join(__dirname, 'sharedArtifact.ts'), 'utf8');

describe('вибір живе в settings, а не на пристрої', () => {
  it('ключ названий і стоїть поруч із датою початку', () => {
    expect(SHARED_ARTIFACT_KEY).toBe('home_artifact');
    expect(module).toContain("from('settings')");
    expect(module).toContain('upsert(');
    expect(module).toContain("onConflict: 'key'");
  });

  it('провайдер більше не читає й не пише localStorage напряму', () => {
    // Саме це й робило вибір пристроєвим.
    expect(world).not.toContain('localStorage.setItem');
    expect(world).not.toContain('localStorage.getItem');
  });

  it('місцеве сховище лишилось КЕШЕМ під тим самим ключем', () => {
    // Інакше пара, яка вже обрала вид, побачила б стрибок із кристала на
    // першому кадрі кожного відкриття.
    expect(module).toContain('HOME_ARTIFACT_STORAGE_KEY');
    expect(HOME_ARTIFACT_STORAGE_KEY).toBe('amore:home-artifact');
    expect(world).toContain('cachedArtifact()');
  });

  it('дотик записує спільний вибір', () => {
    expect(world).toContain('void saveShared(next)');
  });
});

describe('адреса лабораторії перемагає спільний вибір', () => {
  /*
   * ЦЕ НЕ ОБЕРЕЖНІСТЬ, А ЗАХИСТ ВІД НАЗВАНОЇ ПАСТКИ. `?artifact=` і
   * `?engine=` — ручки лабораторії (`resolveHomeArtifact`), і знімок,
   * зроблений із ними, мусить показувати те, що просили. Без цієї умови
   * будь-який прогін лабораторії тихо повертався б до спільного виду —
   * рівно пастка №9 з `scripts/live/README.md`: три однакові кадри, з
   * яких мало не народилось «ручка мертва».
   *
   * Виміряно живцем: зі спільним «дерево» адреса `?artifact=reef` дає
   * `reef`.
   */
  it('перейняття спільного вибору пропускається, коли адреса його називає', () => {
    const effect = world.slice(world.indexOf('useEffect(() => {'));
    const body = effect.slice(0, effect.indexOf('}, [shared.data])'));
    expect(body).toContain('HOME_ARTIFACT_QUERY_KEY');
    expect(body).toContain("params.get('engine')");
    // Саме `return` — не «перезаписати потім», а не чіпати зовсім.
    expect(body).toMatch(/!== null\) return;/);
  });

  it('сторож справді дивиться в потрібні файли', () => {
    expect(world).toContain('ArtifactWorldProvider');
    expect(world.length).toBeGreaterThan(3000);
    expect(module.length).toBeGreaterThan(2000);
  });
});
