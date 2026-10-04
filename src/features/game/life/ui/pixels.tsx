// ============================================================
// Піксельні картинки в інтерфейсі гри: піктограми й портрети.
// ============================================================
import { useEffect, useRef } from 'react';
import { ICONS, bitmapSize, iconUrl } from '../render/icons';
import { sheetFor, type Look } from '../render/people';

export function PixelIcon({ name, size = 2, label }: { name: keyof typeof ICONS; size?: number; label?: string }) {
  const [w, h] = bitmapSize(name);
  return <img className="lg-icon" src={iconUrl(name)} width={w * size} height={h * size} alt={label ?? ''} aria-hidden={label ? undefined : true} />;
}

/**
 * Портрет зі спрайта: голова й плечі (`crop`) або весь зріст. Малюється
 * без згладжування — пікселі лишаються пікселями.
 */
export function Portrait({ look, scale = 4, crop = true }: { look: Look; scale?: number; crop?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const img = sheetFor(look)[0]![0]!;
  const h = crop ? Math.min(img.height, look.kid ? 17 : 21) : img.height;
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const g = c.getContext('2d')!;
    g.imageSmoothingEnabled = false;
    g.clearRect(0, 0, c.width, c.height);
    g.drawImage(img, 0, 0, img.width, h, 0, 0, img.width * scale, h * scale);
  }, [img, h, scale]);
  return <canvas ref={ref} width={img.width * scale} height={h * scale} style={{ imageRendering: 'pixelated' }} aria-hidden />;
}
