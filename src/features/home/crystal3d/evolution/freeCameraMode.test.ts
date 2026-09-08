import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// ============================================================
// Вільна камера конструктора не може бути лише декоративною кнопкою.
// ------------------------------------------------------------
// WebGL у тестовому DOM відсутній, тому тут стережемо весь провід стану:
// конструктор → preview → PortalStage → OrbitControls/PortalCameraRig.
// Саме розрив такого проводу вже залишав інтерактивні режими, які в UI
// вмикались, але полотно про них ніколи не дізнавалось.
// ============================================================

const home = join(__dirname, '../..');
const read = (relative: string) => readFileSync(join(home, relative), 'utf8');

describe('вільна камера конструктора', () => {
  it('має окремий вхід і доступний хрестик виходу', () => {
    const constructor = read('EvolutionConstructor.tsx');
    expect(constructor).toContain('>Вільна камера<');
    expect(constructor).toContain('aria-label="Вийти з режиму вільної камери"');
    expect(constructor).toContain("setAttribute('data-free-camera', 'true')");
    expect(constructor).toMatch(/if \(!visible\) setOpen\(false\)/);
    expect(constructor).not.toMatch(/artifactKey !== 'crystal'\) setOpen\(false\)/);
  });

  it('передає режим із preview до сцени', () => {
    const preview = read('crystal3d/evolution/EvolutionCrystalPreviewScene.tsx');
    expect(preview).toMatch(/const \{ freeCameraActive \} = useEvolutionSandbox\(\)/);
    expect(preview).toMatch(/freeCamera=\{freeCameraActive\}/);
  });

  it('відпускає режисер і вмикає три жести OrbitControls', () => {
    const stage = read('crystal3d/scene/PortalStage.tsx');
    const rig = read('crystal3d/scene/PortalEnvironment.tsx');

    expect(stage).toMatch(/enableRotate=\{freeCamera \|\| allowOrbit\}/);
    /*
     * МАСШТАБ БІЛЬШЕ НЕ ОЗНАКА ЦЬОГО РЕЖИМУ (ADR-0160).
     *
     * Тут стояло `enableZoom={freeCamera}`, і це було вірно, поки масштаб
     * існував ТІЛЬКИ в конструкторі. Власник попросив зум на головній
     * («на х5 вперед і назад»), тож ознакою став `handZoom` — вільна
     * камера АБО дозволена орбіта. Що лишилось ознакою саме цього режиму —
     * зсув: він зрушує точку прицілу, тобто дозволяє загубити артефакт за
     * краєм кадру, і парі такого жесту не дають.
     */
    expect(stage).toMatch(/const handZoom = freeCamera \|\| allowOrbit;/);
    expect(stage).toMatch(/enableZoom=\{handZoom\}/);
    expect(stage).toMatch(/enablePan=\{freeCamera\}/);
    // Власні межі огляду конструктора не з'їдені спільною ×5: 0.16 ближче
    // за 1/5, і саме заради цього числа режим існує.
    expect(stage).toContain('Math.max(0.6, frame.distance * 0.16)');
    expect(stage).toContain('frame.distance * 3.2');
    expect(rig).toMatch(/if \(freeCamera\) \{[\s\S]*?return;/);
    expect(rig).toMatch(/if \(wasFreeCamera\.current\) \{[\s\S]*?createSceneDirector\(target\)/);
  });
});
