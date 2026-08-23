// ============================================================
// CulinaryPage — «Кулінарія» (порт вкладок random.js)
// ------------------------------------------------------------
// Дві сабвкладки: Конструктор (AI-майстер) і Улюблені (пул страв).
// ============================================================
import { useState } from 'react';
import { Constructor } from './Constructor';
import { Favorites } from './Favorites';
import { TabBar } from '@/components/ui/TabBar';

type Tab = 'constructor' | 'favorites';

import { PageHeader } from '@/components/ui/PageHeader';
import { HeartIcon, PotIcon } from '@/components/icons/NavIcon';

export function CulinaryPage() {
  const [tab, setTab] = useState<Tab>('constructor');

  return (
    <section className="culinary pink-page">
      {/* Надзаголовок НЕ «Що готуємо» — конструктор нижче ставить це
          питання дослівно, і два однакові рядки поспіль читаються як
          збій верстки. Та сама пастка, що й у «Скарбничці». */}
      <PageHeader title="Кулінарія" eyebrow="Рецепти й ідеї" />
      <TabBar<Tab>
        value={tab}
        onChange={setTab}
        items={[
          { value: 'constructor', label: 'Конструктор', icon: <PotIcon size={16} /> },
          { value: 'favorites', label: 'Улюблені', icon: <HeartIcon size={16} filled /> },
        ]}
      />

      {tab === 'constructor' ? <Constructor /> : <Favorites />}
    </section>
  );
}
