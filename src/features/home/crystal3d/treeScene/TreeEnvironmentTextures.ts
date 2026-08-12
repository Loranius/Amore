import { useEffect, useMemo } from 'react';
import * as THREE from 'three';

type Theme = 'light' | 'dark';

const PALETTE = {
  light: {
    grassA: '#718d55', grassB: '#93aa6c', grassDark: '#536d42', dry: '#a39b72',
    earthA: '#7b6148', earthB: '#9b7b59', earthDark: '#5b4938', pebble: '#aaa18f',
    skyTop: '#72b8e8', skyMid: '#a9d4ea', skyHorizon: '#deedf0', cloud: '#f8f9f2',
  },
  dark: {
    grassA: '#5f7c48', grassB: '#7f9b5e', grassDark: '#48623a', dry: '#918a64',
    earthA: '#6d5743', earthB: '#8b7053', earthDark: '#514236', pebble: '#948d80',
    skyTop: '#63abe0', skyMid: '#96c9df', skyHorizon: '#d2e6ea', cloud: '#eef3ef',
  },
} as const;

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const hash2 = (x: number, y: number, salt: number) => {
  const n = Math.sin(x * 127.1 + y * 311.7 + salt * 74.7) * 43758.5453123;
  return n - Math.floor(n);
};
const rgba = (hex: string, a: number) => {
  const c = new THREE.Color(hex);
  return `rgba(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)},${a})`;
};
const canvas = (w: number, h: number) => {
  const el = document.createElement('canvas');
  el.width = w;
  el.height = h;
  return el;
};
const configure = (texture: THREE.CanvasTexture, repeat = false) => {
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = 4;
  texture.wrapS = repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  texture.wrapT = repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  texture.needsUpdate = true;
  return texture;
};

function irregularRootMask(wx: number, wz: number, soilRadius: number) {
  const radial = Math.hypot(wx, wz);
  const angle = Math.atan2(wz, wx);
  const lobe = Math.sin(angle * 5 + 0.7) * 0.13 + Math.sin(angle * 9 - 1.1) * 0.055;
  const localNoise = (hash2(Math.floor(wx * 1.45), Math.floor(wz * 1.45), 7) - 0.5) * 0.15;
  const edge = soilRadius * (0.72 + lobe + localNoise);
  const fade = Math.max(0.42, soilRadius * 0.58);
  return clamp01(1 - (radial - edge) / fade);
}

function groundTexture(theme: Theme, hillRadius: number, soilRadius: number) {
  const p = PALETTE[theme];
  const size = 512;
  const el = canvas(size, size);
  const ctx = el.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D unavailable');
  const image = ctx.createImageData(size, size);
  const grassA = new THREE.Color(p.grassA);
  const grassB = new THREE.Color(p.grassB);
  const dry = new THREE.Color(p.dry);
  const earthA = new THREE.Color(p.earthA);
  const earthB = new THREE.Color(p.earthB);
  const earthDark = new THREE.Color(p.earthDark);

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const wx = (x / (size - 1) - 0.5) * hillRadius * 2;
      const wz = (y / (size - 1) - 0.5) * hillRadius * 2;
      const rootMask = irregularRootMask(wx, wz, soilRadius);
      const coarse = hash2(Math.floor(x / 22), Math.floor(y / 22), 13);
      const fine = hash2(Math.floor(x / 6), Math.floor(y / 6), 17);
      const earthPatch = Math.max(0, coarse - 0.83) * 1.15;
      const earthMask = clamp01(rootMask * 0.7 + earthPatch);
      const dryMask = clamp01(Math.max(0, fine - 0.76) * 0.55);

      const color = grassA.clone()
        .lerp(grassB, 0.18 + hash2(x, y, 23) * 0.48)
        .lerp(dry, dryMask);
      const earth = earthA.clone()
        .lerp(earthB, 0.18 + hash2(x, y, 29) * 0.5)
        .lerp(earthDark, hash2(x * 2, y * 2, 31) * 0.08);
      color.lerp(earth, earthMask);
      color.offsetHSL(0, 0, (hash2(x * 3, y * 3, 37) - 0.5) * (earthMask > 0.5 ? 0.075 : 0.045));

      const i = (y * size + x) * 4;
      image.data[i] = Math.round(clamp01(color.r) * 255);
      image.data[i + 1] = Math.round(clamp01(color.g) * 255);
      image.data[i + 2] = Math.round(clamp01(color.b) * 255);
      image.data[i + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);

  ctx.lineCap = 'round';
  for (let i = 0; i < 2050; i += 1) {
    const x = hash2(i, 1, 41) * size;
    const y = hash2(i, 2, 43) * size;
    const wx = (x / size - 0.5) * hillRadius * 2;
    const wz = (y / size - 0.5) * hillRadius * 2;
    const rootMask = irregularRootMask(wx, wz, soilRadius);
    if (rootMask > 0.58 && hash2(i, 3, 47) < rootMask * 0.82) continue;
    const len = 2.5 + hash2(i, 4, 53) * 6.5;
    ctx.strokeStyle = rgba(hash2(i, 5, 59) > 0.43 ? p.grassDark : p.grassB, 0.28);
    ctx.lineWidth = 0.55 + hash2(i, 6, 61) * 0.82;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (hash2(i, 7, 67) - 0.42) * 3, y - len);
    ctx.stroke();
  }

  for (let i = 0; i < 380; i += 1) {
    const a = hash2(i, 1, 71) * Math.PI * 2;
    const irregular = 0.82 + Math.sin(a * 5 + 0.7) * 0.14 + (hash2(i, 8, 77) - 0.5) * 0.18;
    const r = Math.sqrt(hash2(i, 2, 73)) * Math.min(104, 52 + soilRadius * 22) * irregular;
    const x = size * 0.5 + Math.cos(a) * r;
    const y = size * 0.5 + Math.sin(a) * r;
    const radius = 0.4 + hash2(i, 3, 79) * 1.05;
    ctx.fillStyle = rgba(hash2(i, 4, 83) > 0.76 ? p.pebble : p.earthDark, 0.25);
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  return configure(new THREE.CanvasTexture(el));
}

export function createGrassBladeTexture(theme: Theme) {
  const p = PALETTE[theme];
  const el = canvas(96, 256);
  const ctx = el.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D unavailable');
  ctx.clearRect(0, 0, el.width, el.height);

  const g = ctx.createLinearGradient(0, 256, 0, 0);
  g.addColorStop(0, rgba(p.grassDark, 1));
  g.addColorStop(0.42, rgba(p.grassA, 1));
  g.addColorStop(1, rgba(p.grassB, 1));
  ctx.fillStyle = g;

  ctx.beginPath();
  ctx.moveTo(22, 256);
  ctx.bezierCurveTo(20, 184, 28, 78, 45, 3);
  ctx.bezierCurveTo(61, 88, 70, 190, 68, 256);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = rgba(p.grassB, 0.42);
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(46, 247);
  ctx.quadraticCurveTo(45, 126, 45, 12);
  ctx.stroke();

  for (let i = 0; i < 22; i += 1) {
    const y = 30 + hash2(i, 1, 89) * 202;
    ctx.strokeStyle = rgba(p.grassDark, 0.055 + hash2(i, 2, 97) * 0.08);
    ctx.lineWidth = 0.65;
    ctx.beginPath();
    ctx.moveTo(33 + hash2(i, 4, 99) * 5, y);
    ctx.lineTo(58 + hash2(i, 5, 100) * 4, y - 8 - hash2(i, 3, 101) * 8);
    ctx.stroke();
  }

  return configure(new THREE.CanvasTexture(el));
}

function skyTexture(theme: Theme) {
  const p = PALETTE[theme];
  const w = 1024;
  const h = 512;
  const el = canvas(w, h);
  const ctx = el.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D unavailable');

  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, p.skyTop);
  g.addColorStop(0.48, p.skyMid);
  g.addColorStop(0.8, p.skyHorizon);
  g.addColorStop(1, new THREE.Color(p.skyHorizon).lerp(new THREE.Color('#ffffff'), 0.08).getStyle());
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  const blob = (x: number, y: number, r: number, alpha: number) => {
    const rg = ctx.createRadialGradient(x, y, r * 0.08, x, y, r);
    rg.addColorStop(0, rgba(p.cloud, alpha));
    rg.addColorStop(0.52, rgba(p.cloud, alpha * 0.46));
    rg.addColorStop(1, rgba(p.cloud, 0));
    ctx.fillStyle = rg;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  };

  for (let band = 0; band < 5; band += 1) {
    const baseX = hash2(band, 1, 109) * w;
    const baseY = 230 + hash2(band, 2, 113) * 118;
    for (let j = 0; j < 5; j += 1) {
      const x = (baseX + (j - 2) * (52 + hash2(j, band, 127) * 30) + w) % w;
      const y = baseY + (hash2(j, band, 131) - 0.5) * 24;
      blob(x, y, 72 + hash2(j, band, 137) * 68, 0.045 + hash2(j, band, 139) * 0.035);
    }
  }

  const texture = configure(new THREE.CanvasTexture(el));
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}

export function useTreeEnvironmentTextures(theme: Theme, hillRadius: number, soilRadius: number) {
  const textures = useMemo(() => ({
    ground: groundTexture(theme, hillRadius, soilRadius),
    grassBlade: createGrassBladeTexture(theme),
    sky: skyTexture(theme),
  }), [theme, hillRadius, soilRadius]);

  useEffect(() => () => {
    textures.ground.dispose();
    textures.grassBlade.dispose();
    textures.sky.dispose();
  }, [textures]);

  return textures;
}
