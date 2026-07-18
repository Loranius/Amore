// ============================================================
// BootScreen — повноекранний завантажувач (заміна #boot-loader)
// ------------------------------------------------------------
// Показується, поки AuthProvider перевіряє збережену сесію.
// ============================================================
export function BootScreen() {
  return (
    <div className="boot-screen" role="status" aria-live="polite">
      <span className="boot-heart" aria-hidden="true">
        ♡
      </span>
      <span className="sr-only">Завантаження…</span>
    </div>
  );
}
