import { useState } from 'react';
import { Lightbox } from '@/components/ui/Lightbox';
import { WishlistPage as WishlistPageBase } from './WishlistPageBase';
import './wishlistArchiveCollaborative.css';

// ============================================================
// Вішліст — сторінка поверх бази.
// ------------------------------------------------------------
// Тут стояла окрема кнопка «Виконані бажання: …», яку портал вставляв у
// панель вкладок, і власне вікно архіву партнера під нею. Власник попросив її
// прибрати: «Виконані» тепер доступні просто в аркуші налаштувань, на всіх
// трьох вкладках — і «Мої», і партнера, і спільних. Один шлях замість двох.
// ============================================================

export function WishlistPage() {
  const [lightbox, setLightbox] = useState<string | null>(null);

  return (
    <>
      <WishlistPageBase />
      <Lightbox src={lightbox} onClose={() => setLightbox(null)} />
    </>
  );
}
