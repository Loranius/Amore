// ============================================================
// Лабораторія реєстрації нової пари (ADR-0230) — екран без мережі.
// ------------------------------------------------------------
// Справжню реєстрацію в пісочниці не пройти: код приходить на пошту. А
// CLAUDE.md §8 вимагає бачити на екрані все, що побачить пара. Тому тут
// малюється СПРАВЖНІЙ `LoginPage` одразу на кроці нової пари, з
// підставленою автентифікацією:
//   • `createCouple` відповідає успіхом через пів секунди;
//   • записи в `settings` (минулі роки, вид) перехоплено до мережі й
//     записано в `window.__labWrites` — жоден рядок бази не пишеться;
//   • `enterPortal` лише ставить `data-lab-entered` на <html>.
//
//   npm run live -- /new-couple-lab.html --no-login \
//     --tap=.auth-choice-btn --fill=.reg-input=Олена --tap=.reg-next …
//
// Сторінка не входить у збірку продукту: лише dev-сервер.
// ============================================================

declare global {
  interface Window { __labWrites: { url: string; body: string }[] }
}

// Перехоплення ДО імпорту клієнта Supabase: він запам'ятовує `fetch` у
// мить створення, тож пізніша підміна його б не зачепила.
window.__labWrites = [];
const realFetch = window.fetch.bind(window);
window.fetch = async (input, init) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  if (url.includes('/rest/v1/')) {
    window.__labWrites.push({ url, body: typeof init?.body === 'string' ? init.body : '' });
    return new Response('', { status: 201 });
  }
  return realFetch(input, init);
};

void (async () => {
  // Загальні стилі — ПЕРШИМИ, як у порталі (`main.tsx`): інакше вони
  // перебивають стилі входу, і лабораторія показує розкладку, якої пара не
  // побачить (перший кадр: картка вибору не опустилась донизу).
  await import('@/index.css');
  const [{ createRoot }, { MemoryRouter }, rq, { ThemeProvider }, auth, { LoginPage }, { toAppUser }] = await Promise.all([
    import('react-dom/client'),
    import('react-router-dom'),
    import('@tanstack/react-query'),
    import('@/providers/ThemeProvider'),
    import('@/providers/AuthProvider'),
    import('@/features/auth/LoginPage'),
    import('@/lib/guards'),
  ]);
  const refuse = async () => { throw new Error('лабораторія: не для цього екрана'); };
  const value: import('@/providers/AuthProvider').AuthContextValue = {
    user: null,
    status: 'unauthenticated',
    login: refuse,
    registrationOpen: async () => true,
    loginWithEmail: refuse,
    sendCode: refuse,
    verifyCode: refuse,
    setPassword: refuse,
    linkAccount: async () => ({ ok: true, state: 'new' }),
    claimSeat: refuse,
    createCouple: async ({ name }) => {
      await new Promise((resolve) => setTimeout(resolve, 500));
      const user = toAppUser({ id: 9001, name: name.trim() });
      return user ? { ok: true, user } : { ok: false, reason: 'bad_request' };
    },
    enterPortal: () => { document.documentElement.dataset.labEntered = 'true'; },
    logout: async () => {},
  };

  const client = new rq.QueryClient();
  createRoot(document.getElementById('root')!).render(
    <rq.QueryClientProvider client={client}>
      <ThemeProvider>
        <auth.AuthContext.Provider value={value}>
          <MemoryRouter>
            <LoginPage initialStep={{ kind: 'new' }} />
          </MemoryRouter>
        </auth.AuthContext.Provider>
      </ThemeProvider>
    </rq.QueryClientProvider>,
  );
})();

export {};
