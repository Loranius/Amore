// ============================================================
// HomePage — головна: Кристал Amore
// ------------------------------------------------------------
// Замість лічильника/фотохмари/віджетів — генеративний SVG-кристал,
// що відображає спільну історію пари (Crystal.tsx + useCrystalDNA).
// ============================================================
import { useStartDate } from './useHome';
import { formatSinceDate, nextAnniversaryLabel } from './homeUtils';
import { Crystal } from './Crystal';
import { PortalDecor } from '@/features/auth/PortalDecor';

export function HomePage() {
  const startDate = useStartDate();

  return (
    <section className="home">
      <PortalDecor density="light" parallax={false} />
      <h1 className="home-title">Кристал Amore</h1>
      {startDate && (
        <p className="home-subtitle">
          Разом з {formatSinceDate(startDate)} · {nextAnniversaryLabel(startDate)}
        </p>
      )}
      <Crystal />
    </section>
  );
}
