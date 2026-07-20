// ============================================================
// CulinaryPage — «Кулінарія» (порт вкладок random.js)
// ------------------------------------------------------------
// Дві сабвкладки: Конструктор (AI-майстер) і Улюблені (пул страв).
// ============================================================
import { useState } from 'react';
import { Constructor } from './Constructor';
import { Favorites } from './Favorites';
import { PortalDecor } from '@/features/auth/PortalDecor';

type Tab = 'constructor' | 'favorites';

export function CulinaryPage() {
  const [tab, setTab] = useState<Tab>('constructor');

  return (
    <section className="culinary pink-page">
      <PortalDecor density="light" parallax={false} />
      <div className="cul-tabs">
        <button
          type="button"
          className={`cul-tab${tab === 'constructor' ? ' active' : ''}`}
          onClick={() => setTab('constructor')}
        >
          🔮 Конструктор
        </button>
        <button
          type="button"
          className={`cul-tab${tab === 'favorites' ? ' active' : ''}`}
          onClick={() => setTab('favorites')}
        >
          ❤️ Улюблені
        </button>
      </div>

      {tab === 'constructor' ? <Constructor /> : <Favorites />}
    </section>
  );
}
