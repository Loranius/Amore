// ============================================================
// GAME MODULE — «Наша історія»
// Піксельна гра (game.html) у вкладці через iframe.
// Iframe вантажиться ліниво — лише при першому відкритті вкладки,
// щоб не тягнути гру на кожному завантаженні порталу.
// ============================================================

const Game = (() => {
  let loaded = false;

  function init() {
    window.addEventListener('portal:view', (e) => {
      if (e.detail.view !== 'game' || loaded) return;
      const frame = document.getElementById('game-frame');
      if (!frame) return;
      frame.src = 'game.html?v=1';
      loaded = true;
    });
  }

  return { init };
})();
