// ============================================================
// Каустика: сітка світла, яку хвиля кидає на дно.
// ------------------------------------------------------------
// Це ГОЛОВНА ознака того, що дія відбувається під водою. Не колір, не
// туман і не риби: рухома сітка світла на піску — те, чого немає ніде,
// крім як під поверхнею. На всіх п'яти референсах вона є.
//
// Малюється в полотні один раз при завантаженні і повторюється по дну.
// Ніякого шейдера, ніякого зовнішнього файлу: текстура з інтерфейсу
// самого браузера, 256×256, приблизно чверть мегабайта пам'яті.
//
// ФОРМУЛА. Каустика — це перетин світлових променів, зібраних лінзою
// хвилі. Дешева підробка, яку в іграх використовують уже тридцять
// років: сума двох синусоїд, у яких аргумент зіпсований третьою, а
// результат піднесений до високого степеня. Степінь і робить із
// плавної хвилі різкі жилки.
// ============================================================
import { CanvasTexture, RepeatWrapping, type Texture } from 'three';

const SIZE = 256;

/** Наскільки різкі жилки: більший степінь — тонші й яскравіші. */
const VEIN_SHARPNESS = 3.4;

/**
 * Текстура каустики або `null`, якщо полотна немає.
 *
 * `null` — не мовчазний провал, а єдина чесна відповідь у середовищі
 * без DOM (тести, серверний рендер). Сцена від того лишається без
 * каустики й нічого не ламає.
 */
export function buildReefCausticsTexture(): Texture | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const context = canvas.getContext('2d');
  if (!context) return null;

  const image = context.createImageData(SIZE, SIZE);
  for (let y = 0; y < SIZE; y += 1) {
    for (let x = 0; x < SIZE; x += 1) {
      // Кути в обертах, щоб малюнок стикався сам із собою по краях:
      // текстура повторюється, і шов було б видно через усе дно.
      const u = (x / SIZE) * Math.PI * 2;
      const v = (y / SIZE) * Math.PI * 2;
      const warpX = Math.sin(v * 2 + 1.3) * 0.6;
      const warpY = Math.sin(u * 3 - 0.7) * 0.5;
      const wave = Math.sin(u * 3 + warpX) + Math.sin(v * 4 + warpY)
        + 0.7 * Math.sin((u + v) * 2 + warpX + warpY);
      const bright = Math.max(0, wave / 2.7) ** VEIN_SHARPNESS;
      const value = Math.min(255, Math.round(bright * 255));
      const at = (y * SIZE + x) * 4;
      image.data[at] = 255;
      image.data[at + 1] = 255;
      image.data[at + 2] = 255;
      image.data[at + 3] = value;
    }
  }
  context.putImageData(image, 0, 0);

  const texture = new CanvasTexture(canvas);
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  return texture;
}
