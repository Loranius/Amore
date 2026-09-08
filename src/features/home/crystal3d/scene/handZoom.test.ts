import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MANUAL_ZOOM_RANGE } from '@/features/world/sceneDirector';

// ============================================================
// Зум рукою — провід від жесту до директора (ADR-0160).
// ------------------------------------------------------------
// Що саме зум РОБИТЬ із камерою, перевіряє `sceneDirector.test.ts`
// арифметикою. Тут стережеться інше — те, чого без WebGL не видно взагалі:
// що жест увімкнено, що межа в орбіти й у директора ОДНА, і що директор
// справді питає камеру про відстань.
//
// Розрив саме такого проводу — найдорожча вада цього класу: усе
// компілюється, тести арифметики зелені, а на екрані нічого не рухається.
// Вільна камера конструктора вже жила так (`freeCameraMode.test.ts`).
// ============================================================

const scene = __dirname;
const read = (name: string) => readFileSync(join(scene, name), 'utf8');

describe('зум рукою', () => {
  it('увімкнений там, де пара вже може крутити сцену', () => {
    // Той самий дозвіл, що й на оберт: удома можна, у модулі камера стає в
    // позу маршруту й лишається там. Окрема ознака означала б екран, на
    // якому сцену крутити можна, а наблизити ні, — і жодної причини, чому.
    const stage = read('PortalStage.tsx');
    expect(stage).toMatch(/const handZoom = freeCamera \|\| allowOrbit;/);
    expect(stage).toMatch(/enableZoom=\{handZoom\}/);
  });

  it('не вмикає разом із масштабом ЗСУВ', () => {
    // Зсув рухає точку прицілу, тобто дозволяє вивести артефакт за край
    // кадру й лишити пару дивитись у порожнє небо без способу повернутись.
    const stage = read('PortalStage.tsx');
    expect(stage).toMatch(/enablePan=\{freeCamera\}/);
  });

  it('міряє межу від кадру маршруту, а не від сталої в одиницях сцени', () => {
    // Кадр їде за віком кристала. Стала означала б, що «×5 назад» на
    // молодій парі показує пів неба, а на дорослій — ледве відступ.
    const stage = read('PortalStage.tsx');
    expect(stage).toMatch(
      /const zoomAnchor = frame\.distance \* \(pose\?\.distance \?\? CRYSTAL_CENTRE_POSE\.distance\);/,
    );
    expect(stage).toMatch(/zoomAnchor \/ MANUAL_ZOOM_RANGE/);
    expect(stage).toMatch(/zoomAnchor \* MANUAL_ZOOM_RANGE/);
  });

  it('орбіта й директор тримають ОДНУ межу, а не дві однакові', () => {
    // Два числа розійшлись би, і між ними з'явилась би мертва зона: орбіта
    // вже спинилась, директор іще ні — палець тягне, камера стоїть.
    const stage = read('PortalStage.tsx');
    expect(stage).toContain("MANUAL_ZOOM_RANGE, type WorldMotionMode } from '@/features/world/sceneDirector'");
    expect(MANUAL_ZOOM_RANGE).toBe(5);
  });

  it('директор питає камеру про відстань, а не лише про кути', () => {
    // Без цього зчитування жест стерся б наступним же кадром — рівно так,
    // як стирався б оберт до ADR-0022.
    const rig = read('PortalEnvironment.tsx');
    expect(rig).toMatch(/written = useRef<\{ azimuth: number; elevation: number; distance: number \}/);
    expect(rig).toMatch(/zoom: written\.current\.distance > 1e-6 \? actual\.distance \/ written\.current\.distance : 1/);
  });
});
