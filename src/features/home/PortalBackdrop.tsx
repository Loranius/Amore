// ============================================================
// PortalBackdrop — небо й віньєтка навколо 3D-сцени.
// ------------------------------------------------------------
// Раніше цей компонент малював усю декорацію: зорі, підлогу, колони,
// серпанок — пласкими шарами з паралаксом за вказівником. Вони давали
// натяк на глибину, але не могли зійтися з артефактом, бо той живе в
// WebGL-камері: варто було крутнути орбіту, і кристал їхав по нерухомій
// картинці.
//
// Тепер уся геометрія сцени — у тому ж <Canvas>, що й кристал
// (crystal3d/scene/). Тут лишились рівно два шари, які в 3D коштували б
// дорожче, ніж дають: градієнт неба (він же — видимий фон, поки полотно
// вантажиться, і єдиний фон без WebGL) і віньєтка, яка в 3D була б
// повноекранним постпроцесом.
// ============================================================
import { type CSSProperties } from 'react';
import { useTheme } from '@/providers/ThemeProvider';
import { PORTAL_PALETTES } from './crystal3d/scene/portalScene';
import './portalBackdrop.css';

export function PortalBackdrop() {
  const { theme } = useTheme();
  return (
    <>
      <div
        className="portal-backdrop"
        aria-hidden="true"
        // Небо мусить зустрітися з туманом 3D-сцени в один колір, інакше
        // на лінії, де далина тане в туман, з'явиться шов. Тримати те саме
        // значення в двох місцях означало б чекати, поки хтось поправить
        // одне й забуде інше, — тож УСІ зупинки неба приходять із тієї ж
        // палітри, що й туман (ADR-0165), а не лише горизонт.
        style={{
          '--portal-sky-deep': PORTAL_PALETTES[theme].skyDeep,
          '--portal-sky-mid': PORTAL_PALETTES[theme].skyMid,
          '--portal-sky-glow': PORTAL_PALETTES[theme].skyGlow,
          '--portal-sky-horizon': PORTAL_PALETTES[theme].fog,
        } as CSSProperties}
      >
        <div className="portal-backdrop__sky" />
      </div>
      <div className="portal-vignette" aria-hidden="true" />
    </>
  );
}
