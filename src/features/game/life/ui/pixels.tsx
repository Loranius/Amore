// ============================================================
// Піксельні картинки в інтерфейсі гри: піктограми й портрети.
// ============================================================
import { useEffect, useRef, useState } from 'react';
import { ICONS, bitmapSize, iconUrl } from '../render/icons';
import { type Look } from '../render/people';
import { hasHdLook, hdPortrait, hdReady } from '../render/peopleHd';

export function PixelIcon({ name, size = 2, label }: { name: keyof typeof ICONS; size?: number; label?: string }) {
  const [w, h] = bitmapSize(name);
  return <img className="lg-icon" src={iconUrl(name)} width={w * size} height={h * size} alt={label ?? ''} aria-hidden={label ? undefined : true} />;
}

/**
 * Портрет: голова й плечі (`crop`) або весь зріст, без згладжування —
 * пікселі лишаються пікселями. `scale` — пікселів екрана на світовий піксель.
 *
 * Лєна, мама, Діма й Оля — з аркушів PixelLab (власник 2026-10-31:
 * «повністю відмовляємось від 16×16»): піксель малюнка — пів світового,
 * округлений до цілих пікселів екрана; поки аркуш вантажиться, портрета ще
 * нема. Решта — 16-піксельні спрайти, доки для них нема аркушів.
 */
export function Portrait({ look, scale = 4, crop = true }: { look: Look; scale?: number; crop?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const ready = useHdReady(look);
  const pic = ready ? hdPortrait(look, crop) : null;
  const k = Math.max(1, Math.round(scale / 2));
  useEffect(() => {
    const c = ref.current;
    if (!c || !pic) return;
    const g = c.getContext('2d')!;
    g.imageSmoothingEnabled = false;
    g.clearRect(0, 0, c.width, c.height);
    g.drawImage(pic.src, pic.x, pic.y, pic.w, pic.h, 0, 0, pic.w * k, pic.h * k);
  });
  if (!pic) return null;
  return <canvas ref={ref} width={pic.w * k} height={pic.h * k} style={{ imageRendering: 'pixelated' }} aria-hidden />;
}

/** Чи готовий аркуш PixelLab цієї людини; коли довантажиться — перемалювати. */
function useHdReady(look: Look): boolean {
  const key = JSON.stringify(look);
  const ready = hasHdLook(look);
  const [, loaded] = useState(0);
  useEffect(() => {
    if (ready) return;
    let live = true;
    void hdReady(look).then((ok) => { if (live && ok) loaded((n) => n + 1); });
    return () => { live = false; };
    // `look` — свіжий об'єкт щоразу; той самий вигляд — той самий `key`.
  }, [key, ready]); // eslint-disable-line react-hooks/exhaustive-deps
  return ready;
}
