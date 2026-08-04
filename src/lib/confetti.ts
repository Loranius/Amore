// ============================================================
// CONFETTI — святковий сплеск частинок (порт lib/confetti.js)
// ------------------------------------------------------------
// Fire-and-forget ефект: додає частинки в <body> і сам прибирає їх.
// Стан React тут не потрібен — це разова глобальна анімація.
// CSS (.confetti-piece + keyframes) — в index.css.
// ============================================================
const COLORS = [
  '#C16BFF', '#bd82e8', '#985bc4', '#DFB3FF',
  '#FFD700', '#CC85FF', '#E5C0FF', '#d7a8f9',
  '#A8D8EA', '#FFE066',
];

const rand = (min: number, max: number) => Math.random() * (max - min) + min;
const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)]!;

function createPiece(): HTMLDivElement {
  const el = document.createElement('div');
  el.className = 'confetti-piece';

  const size = rand(6, 13);
  const isRect = Math.random() > 0.4;
  el.style.cssText = `
    left: ${rand(5, 95)}%;
    width: ${size}px;
    height: ${isRect ? size * 0.55 : size}px;
    background: ${pick(COLORS)};
    border-radius: ${isRect ? '2px' : '50%'};
    --fall-dur: ${rand(1.4, 2.4)}s;
    --fall-delay: ${rand(0, 0.5)}s;
    --sway-dur: ${rand(0.7, 1.5)}s;
  `;
  return el;
}

export function burstConfetti(count = 60): void {
  // Повага до налаштування «менше руху».
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

  const pieces: HTMLDivElement[] = [];
  for (let i = 0; i < count; i++) {
    const p = createPiece();
    document.body.appendChild(p);
    pieces.push(p);
  }
  setTimeout(() => pieces.forEach((p) => p.remove()), 3200);
}
