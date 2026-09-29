import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ARTIFACT_EXPLORER_USER_ID, canSwitchArtifact } from './artifactChoice';

// ============================================================
// ADR-0234: після вибору пара бачить лише свій вид; перемикач видів і
// `?artifact=` в адресі — тільки власнику порталу.
// ============================================================

const src = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('хто перемикає вид', () => {
  it('лише власник (users.id = 1); інші й невідомий — ні', () => {
    expect(ARTIFACT_EXPLORER_USER_ID).toBe(1);
    expect(canSwitchArtifact(1)).toBe(true);
    for (const other of [2, 9, 11, 0, null, undefined]) expect(canSwitchArtifact(other)).toBe(false);
  });

  it('обидва місця з перемикачем питають те саме правило', () => {
    // Головна й «Заповнити минулі роки» — єдині екрани з перемикачем.
    expect(src('src/features/home/HomePage.tsx')).toMatch(/explorer && <HomeArtifactSwitcher/);
    const sweep = src('src/features/onboarding/SweepSpecies.tsx');
    expect(sweep).toContain('canSwitchArtifact(');
    expect(sweep.indexOf('if (!explorer)')).toBeLessThan(sweep.indexOf('<HomeArtifactSwitcher'));
  });

  it('адреса не перебиває вибір пари для не-власника', () => {
    expect(src('src/features/world/ArtifactWorld.tsx')).toMatch(/if \(explorer && typeof window/);
  });

  it('пошти власника в коді сайту немає', () => {
    for (const file of ['src/features/home/artifactChoice.ts', 'src/features/home/HomePage.tsx', 'src/features/world/ArtifactWorld.tsx']) {
      expect(src(file)).not.toMatch(/@gmail\.com/);
    }
  });
});
