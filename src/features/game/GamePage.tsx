// ============================================================
// GamePage — «Наша історія» (порт game.js)
// ------------------------------------------------------------
// Піксельна гра — самодостатній game.html у public/. У React лінивість
// із оригіналу досягається природно: iframe монтується лише коли
// відкрито цей роут. BASE_URL — щоб шлях працював і під підкаталогом
// на GitHub Pages.
// ============================================================
const GAME_SRC = `${import.meta.env.BASE_URL}game.html?v=3`;

export function GamePage() {
  return (
    <section className="game">
      <iframe className="game-frame" src={GAME_SRC} title="Наша історія" />
    </section>
  );
}
