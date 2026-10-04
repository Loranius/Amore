// ============================================================
// Зовнішність мешканців (знайомства, 2026-10-04): кожен упізнаваний
// здалеку, як персонажі Stardew Valley — зачіска, колір і аксесуар.
// ============================================================
import type { Look } from './people';

const SKIN = '#f2c9a0';

export const RESIDENT_LOOKS: Record<string, Look> = {
  hanna: { skin: '#f0c4a0', hair: '#c8c4bc', hairStyle: 'bun', top: '#7a4a6a', bottom: '#3a3550', dress: true, shoes: '#3a2f28', eyes: '#3a2a22', glasses: true, scarf: '#d9534f' },
  petro: { skin: '#e2ae84', hair: '#5a4030', hairStyle: 'short', top: '#3f6a8a', bottom: '#4a3a2a', shoes: '#3a2f28', eyes: '#3a2a22', beard: true, hat: '#3a6a3a' },
  nina: { skin: SKIN, hair: '#4a3020', hairStyle: 'bob', top: '#f4f4f7', bottom: '#2e3550', dress: true, shoes: '#3a2f28', eyes: '#3a5a8a', glasses: true, accent: '#b8323a' },
  marko: { skin: '#e8b48a', hair: '#2b1d16', hairStyle: 'spiky', top: '#2f6a5a', bottom: '#2e3550', shoes: '#f4f4f7', eyes: '#3a7a4a', hoodie: true, scarf: '#e0a43c' },
  sofia: { skin: SKIN, hair: '#c0503a', hairStyle: 'long', top: '#7fbf6a', bottom: '#f6f1e6', dress: true, shoes: '#c46b8f', eyes: '#3a7a4a', bow: '#ff8fb0' },
  iryna: { skin: SKIN, hair: '#2b1d16', hairStyle: 'ponytail', top: '#8a5ab5', bottom: '#2e3550', shoes: '#f4f4f7', eyes: '#5a3a26', glasses: true },
  taras: { skin: '#e8b48a', hair: '#6e4a2a', hairStyle: 'short', top: '#5a3a26', bottom: '#2e3550', shoes: '#3a2f28', eyes: '#3a2a22', beard: true, hat: '#d9534f' },
  anya: { skin: '#f6d5b5', hair: '#7a4ab5', hairStyle: 'bob', top: '#2e2e3a', bottom: '#3d5a8c', shoes: '#f4f4f7', eyes: '#4a90d9', hoodie: true, glasses: true },
  ostap: { skin: SKIN, hair: '#9c7a45', hairStyle: 'short', top: '#3a5ab5', bottom: '#4a3a2a', shoes: '#5a3a26', eyes: '#4a90d9', scarf: '#b8323a', accent: '#f4f4f7' },
  katya: { skin: '#e2ae84', hair: '#e8c26a', hairStyle: 'long', top: '#3ab5c4', bottom: '#f7d36a', shoes: '#f4f4f7', eyes: '#3a7a8a' },
};
