// ============================================================
// PortalConfetti — святкові пелюстки на екрані «Портал відкрито».
// ------------------------------------------------------------
// Тут жив ще й PortalDecor: плаваючий шар сердечок, квітів, тортів,
// ромбів і хвильок на кожній сторінці порталу. Його прибрано на вимогу
// власника — і це не втрата, а звільнене місце: він лежав під кожним
// розділом і сперечався з їхнім власним вмістом.
//
// Конфеті лишилось, бо це не шпалери, а момент: воно з'являється рівно
// раз, коли пін зійшовся, і зникає само.
// ============================================================

const CONFETTI_COLORS = ['#d2a6f2', '#dcb8f6', '#c58feb', '#ecd6fb'];
const CONFETTI = Array.from({ length: 10 }, (_, i) => ({
  x: (i * 97) % 100,
  size: 8 + (i % 3) * 3,
  dur: 3 + (i % 4) * 0.6,
  delay: i * 0.25,
  color: CONFETTI_COLORS[i % CONFETTI_COLORS.length]!,
}));

/** Падаючі серця-конфеті на екрані «Портал відкрито». */
export function PortalConfetti() {
  return (
    <div className="auth-confetti-layer" aria-hidden="true">
      {CONFETTI.map((cf, i) => (
        <div
          key={i}
          className="auth-confetti-piece"
          style={{
            left: `${cf.x}%`,
            background: cf.color,
            ['--size' as string]: `${cf.size}px`,
            ['--piece-color' as string]: cf.color,
            ['--dur' as string]: `${cf.dur}s`,
            ['--delay' as string]: `${cf.delay}s`,
          }}
        />
      ))}
    </div>
  );
}
