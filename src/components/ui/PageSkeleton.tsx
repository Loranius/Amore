// ============================================================
// PageSkeleton — те, що стоїть на місці розділу, поки їде його чанк.
// ------------------------------------------------------------
// Розділи вантажаться ліниво (app/routes.tsx), і на повільній мережі між
// натисканням і сторінкою є пауза. Порожній екран у цій паузі читається
// як «нічого не сталось», тож тут — той самий фон сторінки й кілька
// прямокутників у ритмі майбутнього вмісту.
//
// aria-hidden і aria-busy: для читача з екрана це не вміст, а стан
// очікування, і озвучувати порожні плитки не треба.
// ============================================================
export function PageSkeleton() {
  return (
    <section className="pink-page page-skeleton" aria-busy="true">
      <div className="page-skeleton-block page-skeleton-block--head" aria-hidden="true" />
      <div className="page-skeleton-block" aria-hidden="true" />
      <div className="page-skeleton-block" aria-hidden="true" />
    </section>
  );
}
