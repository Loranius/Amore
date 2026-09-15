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
    expect(stage).toMatch(/portalHandZoomBounds\(zoomAnchor\)/);
  });

  it('орбіта й директор тримають ОДНУ межу, а не дві однакові', () => {
    // Два числа розійшлись би, і між ними з'явилась би мертва зона: орбіта
    // вже спинилась, директор іще ні — палець тягне, камера стоїть.
    //
    // Арифметика переїхала у `portalOrbit.ts` (ADR-0193), бо ті самі ×5
    // тепер мають риф і дерево. Межа лишилась одна — просто тепер вона
    // одна на ТРИ види, а не на один.
    const orbit = read('portalOrbit.ts');
    expect(orbit).toContain("import { MANUAL_ZOOM_RANGE } from '@/features/world/sceneDirector'");
    expect(orbit).toMatch(/nearest: anchor \/ MANUAL_ZOOM_RANGE/);
    expect(orbit).toMatch(/anchor \* MANUAL_ZOOM_RANGE/);
    expect(MANUAL_ZOOM_RANGE).toBe(5);
  });

  it('усі три види беруть межу з ОДНІЄЇ функції', () => {
    /*
     * **ВИМОГА ВЛАСНИКА (ADR-0193): «додай можливість зуму на риф і
     * дерево, як на кристалі».** Дослівно «як на кристалі» — тобто не
     * свої числа кожному виду.
     *
     * Тест дивиться в текст, бо саме поява ДРУГОЇ арифметики й була б
     * вадою: три копії ×5 розійшлись би так само тихо, як розійшлись
     * дванадцять копій приймального присуду дерева (ADR-0192 §3c).
     */
    const sources = {
      кристал: read('PortalStage.tsx'),
      дерево: readFileSync(join(scene, '../treeScene/TreeTexturedStage.tsx'), 'utf8'),
      риф: readFileSync(
        join(scene, '../../reef3d/world/ReefWorld.tsx'),
        'utf8',
      ),
    };
    for (const [species, source] of Object.entries(sources)) {
      expect(source, species).toMatch(/portalHandZoomBounds\(/);
      expect(source, species).toMatch(/zoomSpeed=\{PORTAL_ZOOM_SPEED\}/);
      expect(source, species).not.toMatch(/enableZoom=\{false\}/);
    }
  });

  it('директор питає камеру про відстань, а не лише про кути', () => {
    // Без цього зчитування жест стерся б наступним же кадром — рівно так,
    // як стирався б оберт до ADR-0022.
    const rig = read('PortalEnvironment.tsx');
    expect(rig).toMatch(/written = useRef<\{ azimuth: number; elevation: number; distance: number \}/);
    expect(rig).toMatch(/zoom: written\.current\.distance > 1e-6 \? actual\.distance \/ written\.current\.distance : 1/);
  });
});
