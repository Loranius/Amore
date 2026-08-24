// ============================================================
// BootScreen — повноекранний завантажувач (заміна #boot-loader)
// ------------------------------------------------------------
// Показується, поки AuthProvider перевіряє збережену сесію.
// ============================================================
import { HeartIcon } from '@/components/icons/NavIcon';

export function BootScreen() {
  return (
    <div className="boot-screen" role="status" aria-live="polite">
      <span className="boot-heart" aria-hidden="true">
        <HeartIcon size={48} filled />
      </span>
      <span className="sr-only">Завантаження…</span>
    </div>
  );
}
