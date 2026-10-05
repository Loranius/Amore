// ============================================================
// GamePage — «Дєвочка в городі» (ADR-0239)
// ------------------------------------------------------------
// Гра — окрема сторінка збірки `game.html` (симулятор життя Лєни). У
// React лінивість досягається природно: iframe монтується лише коли
// відкрито цей роут, тож портал не тягне гру за собою. BASE_URL — щоб
// шлях працював і під підкаталогом на GitHub Pages.
// ============================================================
import { gameSrc } from './gameSrc';

const GAME_SRC = gameSrc(import.meta.env.BASE_URL, __BUILD_ID__);

export function GamePage() {
  return (
    <section className="game">
      <iframe className="game-frame" src={GAME_SRC} title="Дєвочка в городі" />
    </section>
  );
}
