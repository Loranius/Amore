// ============================================================
// PortalBackdrop — небо й віньєтка навколо 3D-сцени.
// ------------------------------------------------------------
// Це те, що видно, ПОКИ сцена вантажиться (чанк, дані, шейдери), і
// єдине небо без WebGL. Тож воно мусить бути ТИМ САМИМ небом, яке потім
// намалює діорама (ADR-0220), — інакше при кожному перемиканні між
// кристалом, деревом і рифом спершу блимає чуже.
//
// Так і було: тут жили палітра й намальована картина неба ПОПЕРЕДНЬОГО
// кристала (ADR-0165, ADR-0210), і власник бачив їх між перемиканнями
// («сміття, яке лишилось від попереднього варіанту кристала, його фон і
// кольори»). Тепер кольори беруться з `DIORAMA_PALETTES` обраного виду.
// ============================================================
import { type CSSProperties } from 'react';
import { useTheme } from '@/providers/ThemeProvider';
import { DIORAMA_PALETTES } from './diorama/dioramaStyle';
import type { HomeArtifact } from './homeArtifact';
import './portalBackdrop.css';

/**
 * Кольори неба й віньєтки під сценою. Віньєтка — затемнений низ неба того
 * ж виду, напівпрозорий: вона досі бралась із `--scene-vignette`, а дерево
 * своїх сценних кольорів не має й успадковувало нічну фіолетову віньєтку
 * СТАРОГО кристала — вона лягала на денне небо дерева брудними кутами.
 */
export function portalBackdropColours(artifact: HomeArtifact, theme: 'light' | 'dark') {
  const palette = DIORAMA_PALETTES[artifact][theme];
  const hex = palette.bottom.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => Math.round(parseInt(hex.slice(i, i + 2), 16) * 0.55));
  const vignette = `rgba(${r}, ${g}, ${b}, 0.28)`;
  return { top: palette.top, bottom: palette.bottom, glow: palette.glow, vignette };
}

export function PortalBackdrop({ artifact }: { artifact: HomeArtifact }) {
  const { theme } = useTheme();
  const colours = portalBackdropColours(artifact, theme);
  return (
    <>
      <div
        className="portal-backdrop"
        aria-hidden="true"
        data-portal-backdrop={artifact}
        style={{
          '--portal-sky-top': colours.top,
          '--portal-sky-bottom': colours.bottom,
          '--portal-sky-glow': colours.glow,
        } as CSSProperties}
      >
        <div className="portal-backdrop__sky" />
      </div>
      <div
        className="portal-vignette"
        aria-hidden="true"
        style={{ '--portal-vignette': colours.vignette } as CSSProperties}
      />
    </>
  );
}
