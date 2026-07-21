// ============================================================
// useWebglSupport — фіче-детект WebGL перед монтуванням 3D-сцени
// ------------------------------------------------------------
// Якщо канвас не може отримати webgl2/webgl-контекст — HomePage одразу
// рендерить SVG-кристал (Crystal.tsx), без спроби змонтувати Canvas.
// ============================================================
import { useState } from 'react';

function detectWebgl(): boolean {
  if (typeof document === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    return !!(canvas.getContext('webgl2') || canvas.getContext('webgl'));
  } catch {
    return false;
  }
}

export function useWebglSupport(): boolean {
  const [supported] = useState(detectWebgl);
  return supported;
}
