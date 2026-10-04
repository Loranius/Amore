// ============================================================
// Піксельні піктограми «Життя Лєни» (ADR-0239): на вивісках будинків і
// в інтерфейсі гри — замість емодзі, що в кожній системі виглядають
// інакше й не належать світу гри.
// ============================================================
import type { SignIcon } from '../world/types';
import { canvas, ctx2d } from './pixel';

/** Кожна піктограма — рядки, де символ → колір з `palette`. «.» — прозоро. */
interface Bitmap {
  rows: readonly string[];
  palette: Record<string, string>;
}

const K = '#3a2a2a';

export const ICONS: Record<SignIcon | UiIcon, Bitmap> = {
  bread: { rows: ['..aaaa..', '.abbbba.', 'abcbcbba', 'abbbbbba', '.aaaaaa.'], palette: { a: '#8a5a24', b: '#e3a85a', c: '#f6d08a' } },
  shirt: { rows: ['aa.bb.aa', 'aaaaaaaa', '.aaaaaa.', '.aaaaaa.', '.aaaaaa.', '.aaaaaa.'], palette: { a: '#5aa7e0', b: '#f4f4f7' } },
  book: { rows: ['aaaaaaa.', 'abbbbbaa', 'abbbbbaa', 'abbbbbaa', 'abbbbbaa', 'aaaaaaa.'], palette: { a: '#b8323a', b: '#f4ecd8' } },
  cup: { rows: ['.c.c....', '..c.c...', 'aaaaaa..', 'abbbbaaa', 'abbbba.a', 'abbbbaaa', '.aaaa...'], palette: { a: '#f4f4f7', b: '#8a5a34', c: '#d8d8e8' } },
  flower: { rows: ['..aa....', '.abba.c.', '..aa.cc.', '...d.c..', '...dd...', '..eeee..', '..eeee..'], palette: { a: '#ff7aa8', b: '#f6d55c', c: '#ffb3cf', d: '#3f8a43', e: '#b8703a' } },
  tv: { rows: ['..a..a..', '...aa...', 'bbbbbbbb', 'bccccccb', 'bccccccb', 'bbbbbbbb', '.b....b.'], palette: { a: '#5a5a64', b: '#2b2b33', c: '#6fc3e8' } },
  sofa: { rows: ['.aaaaaa.', 'abbbbbba', 'abbbbbba', 'aaaaaaaa', 'a......a'], palette: { a: '#8a5ab5', b: '#b088d6' } },
  gift: { rows: ['..a.a...', 'bbbabbbb', 'cccacccc', 'cccacccc', 'cccacccc'], palette: { a: '#f6d55c', b: '#d9534f', c: '#ff7aa8' } },
  letter: { rows: ['aaaaaaaa', 'abaaaaba', 'aabaabaa', 'aaabbaaa', 'aaaaaaaa'], palette: { a: '#f4ecd8', b: '#b8323a' } },
  briefcase: { rows: ['..aaaa..', '..a..a..', 'bbbbbbbb', 'bbbccbbb', 'bbbbbbbb', 'bbbbbbbb'], palette: { a: '#5a3a24', b: '#8a5a34', c: '#f6d55c' } },
  key: { rows: ['.aaa....', 'a...a...', 'a...aaaa', 'a...a.a.', '.aaa..a.'], palette: { a: '#f6c14e' } },
  bus: { rows: ['aaaaaaaa', 'abbabbaa', 'abbabbaa', 'aaaaaaaa', 'aaaaaaaa', '.c....c.'], palette: { a: '#3a6fd8', b: '#dff0ff', c: K } },
  train: { rows: ['.aaaaaa.', 'abbaabba', 'abbaabba', 'aaaaaaaa', 'aaccaaca', '.c....c.'], palette: { a: '#c2494f', b: '#dff0ff', c: K } },
  cake: { rows: ['...a....', '..bbb...', '.ccccc..', 'dddddddd', 'cccccccc', 'dddddddd'], palette: { a: '#f6d55c', b: '#ff7aa8', c: '#fff4e6', d: '#e3a85a' } },
  pencil: { rows: ['......ab', '.....aaa', '....aaa.', '...aaa..', '..aaa...', '.caa....', 'cc......'], palette: { a: '#f6c14e', b: '#ff7aa8', c: '#3a2a2a' } },
  star: { rows: ['...a....', '...a....', 'aaaaaaa.', '.aaaaa..', '.aa.aa..', 'a.....a.'], palette: { a: '#f6c14e' } },
  coin: { rows: ['..aaaa..', '.abbbba.', 'abbcbbba', 'abcbbbba', 'abbbbbba', '.abbbba.', '..aaaa..'], palette: { a: '#a8741a', b: '#f6c14e', c: '#fff2b0' } },
  bolt: { rows: ['....aa', '...aa.', '..aaaa', '...aa.', '..aa..', '.aa...', 'a.....'], palette: { a: '#7ed957' } },
  heart: { rows: ['.aa.aa.', 'abbabba', 'abbbbba', '.abbba.', '..aba..', '...a...'], palette: { a: '#b8323a', b: '#ff5d8f' } },
  sun: { rows: ['a..a..a', '.a.a.a.', '..bbb..', 'aabbbaa', '..bbb..', '.a.a.a.', 'a..a..a'], palette: { a: '#f6c14e', b: '#ffdf7a' } },
  moon: { rows: ['..aaa..', '.aab...', 'aab....', 'aab....', 'aab....', '.aab...', '..aaa..'], palette: { a: '#f4ecb8', b: '#d8cf98' } },
  bag: { rows: ['..aaaa..', '.a....a.', 'bbbbbbbb', 'bccbbccb', 'bbbbbbbb', 'bbbbbbbb'], palette: { a: '#5a3a24', b: '#b8703a', c: '#e3a85a' } },
  map: { rows: ['aabbbcca', 'abbbccca', 'abdbccca', 'abbbccda', 'abbbccca', 'aabbbcca'], palette: { a: '#c9a46a', b: '#8fd0a0', c: '#7fc0ec', d: '#d9534f' } },
  album: { rows: ['aaaaaaa.', 'abbbbbaa', 'abcccbaa', 'abcdcbaa', 'abbbbbaa', 'aaaaaaa.'], palette: { a: '#5a7fc4', b: '#f4ecd8', c: '#ff7aa8', d: '#f6d55c' } },
  phone: { rows: ['aaaaa', 'abbba', 'abbba', 'abbba', 'abbba', 'aacaa'], palette: { a: '#2b2b33', b: '#7fc0ec', c: '#8a8a94' } },
  smile: { rows: ['.aaaaa.', 'abbbbba', 'abababa', 'abbbbba', 'ababbba', 'abbaaba', '.aaaaa.'], palette: { a: '#a8741a', b: '#f6d55c' } },
  sleep: { rows: ['aaaa....', '..a.....', '.a..bbb.', 'aaaa..b.', '.....b..', '....bbb.'], palette: { a: '#b8c4ff', b: '#8a96e0' } },
  arrow: { rows: ['aaaaaaa', '.abbba.', '..aba..', '...a...'], palette: { a: '#a8741a', b: '#f6c14e' } },
  cross: { rows: ['a....a', '.a..a.', '..aa..', '..aa..', '.a..a.', 'a....a'], palette: { a: '#ffffff' } },
  ring: { rows: ['..bcb..', '...b...', '.aaaaa.', 'a.....a', 'a.....a', 'a.....a', '.aaaaa.'], palette: { a: '#e8b83a', b: '#bfe8ff', c: '#ffffff' } },
};

export type UiIcon = 'coin' | 'bolt' | 'heart' | 'sun' | 'moon' | 'bag' | 'map' | 'album' | 'phone' | 'smile' | 'sleep' | 'arrow' | 'cross' | 'ring';

export function drawBitmap(g: CanvasRenderingContext2D, name: keyof typeof ICONS, x: number, y: number): void {
  const bm = ICONS[name];
  bm.rows.forEach((row, j) => {
    for (let i = 0; i < row.length; i += 1) {
      const c = bm.palette[row[i]!];
      if (!c) continue;
      g.fillStyle = c;
      g.fillRect(x + i, y + j, 1, 1);
    }
  });
}

export function bitmapSize(name: keyof typeof ICONS): [number, number] {
  const bm = ICONS[name];
  return [Math.max(...bm.rows.map((r) => r.length)), bm.rows.length];
}

const urlCache = new Map<string, string>();

/** Піктограма як data-URL для `<img>` в інтерфейсі (масштабується без згладжування). */
export function iconUrl(name: keyof typeof ICONS): string {
  const hit = urlCache.get(name);
  if (hit) return hit;
  const [w, h] = bitmapSize(name);
  const c = canvas(w, h);
  drawBitmap(ctx2d(c), name, 0, 0);
  const url = c.toDataURL('image/png');
  urlCache.set(name, url);
  return url;
}
