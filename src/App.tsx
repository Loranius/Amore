// ============================================================
// APP — кореневий роутинг
// ------------------------------------------------------------
// Провайдери (Theme/Toast/Query/Auth) піднімає main.tsx; тут — лише
// RouterProvider з деревом роутів (app/routes.tsx).
//
// React Query Devtools вантажаться ЛІНИВО й лише в dev — статичний
// import тягнув би їх у продакшн-бандл, тому lazy + прапорець DEV.
// ============================================================
import { lazy, Suspense } from 'react';
import { RouterProvider } from 'react-router-dom';
import { router } from '@/app/routes';

const Devtools = import.meta.env.DEV
  ? lazy(() =>
      import('@tanstack/react-query-devtools').then((m) => ({
        default: m.ReactQueryDevtools,
      })),
    )
  : null;

export default function App() {
  return (
    <>
      <RouterProvider router={router} />
      {Devtools && (
        <Suspense fallback={null}>
          <Devtools initialIsOpen={false} />
        </Suspense>
      )}
    </>
  );
}
