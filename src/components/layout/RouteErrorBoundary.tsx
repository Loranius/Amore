// ============================================================
// RouteErrorBoundary — розділ, що впав, не забирає з собою портал.
// ------------------------------------------------------------
// У роутера не було жодного errorElement, тож будь-яка помилка рендера в
// будь-якому розділі піднімалась до кореня, і react-router малював свій
// службовий екран «Unexpected Application Error!» замість застосунку —
// без нижньої навігації, без теми, без шляху назад. Це не гіпотеза: так
// падає «Наша карта», щойно Mapbox лишається без токена.
//
// Тепер помилка зупиняється тут: показуємо, що саме не працює, і лишаємо
// портал на місці, щоб можна було піти в інший розділ.
// ============================================================
import { isRouteErrorResponse, useNavigate, useRouteError } from 'react-router-dom';

function describe(error: unknown): string {
  if (isRouteErrorResponse(error)) return `${error.status} ${error.statusText}`;
  if (error instanceof Error) return error.message;
  return 'Невідома помилка.';
}

export function RouteErrorBoundary() {
  const error = useRouteError();
  const navigate = useNavigate();

  return (
    <section className="pink-page route-error">
      <div className="route-error-card" role="alert">
        <h1 className="route-error-title">Цей розділ не відкрився</h1>
        <p className="route-error-text">{describe(error)}</p>
        <div className="route-error-actions">
          <button type="button" className="btn" onClick={() => navigate('/')}>
            На головну
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => navigate(0)}>
            Спробувати ще раз
          </button>
        </div>
      </div>
    </section>
  );
}
