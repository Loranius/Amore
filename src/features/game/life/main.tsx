// ============================================================
// Вхід гри «Життя Лєни» (ADR-0239): окрема сторінка `game.html`, яку
// портал відкриває в iframe на `/game` лише для пари 1.
// ============================================================
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { LifeGame } from './ui/LifeGame';

const root = document.getElementById('root');
if (!root) throw new Error('game.html: немає #root');
createRoot(root).render(
  <StrictMode>
    <LifeGame />
  </StrictMode>,
);
