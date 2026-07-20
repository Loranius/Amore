// ============================================================
// CulinaryPage — «Кулінарія» (порт вкладок random.js)
// ------------------------------------------------------------
// Дві сабвкладки: Конструктор (AI-майстер) і Улюблені (пул страв).
// ============================================================
import { useState } from 'react';
import { Constructor } from './Constructor';
import { Favorites } from './Favorites';
import { PortalDecor } from '@/features/auth/PortalDecor';
import { TabBar } from '@/components/ui/TabBar';

type Tab = 'constructor' | 'favorites';

export function CulinaryPage() {
  const [tab, setTab] = useState<Tab>('constructor');

  return (
    <section className="culinary pink-page">
      <PortalDecor density="light" parallax={false} />
      <TabBar<Tab>
        value={tab}
        onChange={setTab}
        items={[
          { value: 'constructor', label: 'Конструктор', icon: '🔮' },
          { value: 'favorites', label: 'Улюблені', icon: '❤️' },
        ]}
      />

      {tab === 'constructor' ? <Constructor /> : <Favorites />}
    </section>
  );
}
