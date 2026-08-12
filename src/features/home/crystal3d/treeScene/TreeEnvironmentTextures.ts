import { useEffect, useMemo } from 'react';
import * as THREE from 'three';

type Theme = 'light' | 'dark';

const PALETTE = {
  light: {
    grassA: '#647e4c', grassB: '#82975e', grassDark: '#425b37', dry: '#918c68',
    earthA: '#674f38', earthB: '#8a6b4c', earthDark: '#45372b', pebble: '#a39a87',
    skyTop: '#68add9', skyHorizon: '#d5e8e8', cloud: '#f7f7ef',
  },
  dark: {
    grassA: '#4b663b', grassB: '#68824b', grassDark: '#30472e', dry: '#7d7858',
    earthA: '#574333', earthB: '#725940', earthDark: '#3c3028', pebble: '#817a6d',
    skyTop: '#5797bf', skyHorizon: '#bdcfca', cloud: '#e7ebe3',
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
      const radial = Math.hypot(wx, wz);
      const rootMask = clamp01(1 - (radial - soilRadius * 0.68) / Math.max(0.5, soilRadius * 1.35));
      const coarse = hash2(Math.floor(x / 18), Math.floor(y / 18), 13);
      const fine = hash2(Math.floor(x / 5), Math.floor(y / 5), 17);
      const earthMask = clamp01(rootMask * 0.9 + Math.max(0, coarse - 0.77) * 1.65);
      const dryMask = clamp01(Math.max(0, fine - 0.72) * 0.72);
      const color = grassA.clone()
        .lerp(grassB, hash2(x, y, 23) * 0.44)
        .lerp(dry, dryMask);
      const earth = earthA.clone()
        .lerp(earthB, hash2(x, y, 29) * 0.52)
        .lerp(earthDark, hash2(x * 2, y * 2, 31) * 0.17);
      color.lerp(earth, earthMask);
      color.offsetHSL(0, 0, (hash2(x * 3, y * 3, 37) - 0.5) * (earthMask > 0.45 ? 0.13 : 0.065));
      const i = (y * size + x) * 4;
      image.data[i] = Math.round(clamp01(color.r) * 255);
      image.data[i + 1] = Math.round(clamp01(color.g) * 255);
      image.data[i + 2] = Math.round(clamp01(color.b) * 255);
      image.data[i + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);

  ctx.lineCap = 'round';
  for (let i = 0; i < 1700; i += 1) {
    const x = hash2(i, 1, 41) * size;
    const y = hash2(i, 2, 43) * size;
    const wx = (x / size - 0.5) * hillRadius * 2;
    const wz = (y / size - 0.5) * hillRadius * 2;
    const rootMask = clamp01(1 - (Math.hypot(wx, wz) - soilRadius * 0.68) / Math.max(0.5, soilRadius * 1.35));
    if (rootMask > 0.62 && hash2(i, 3, 47) < rootMask) continue;
    const len = 2 + hash2(i, 4, 53) * 6;
    ctx.strokeStyle = rgba(hash2(i, 5, 59) > 0.5 ? p.grassDark : p.grassB, 0.24);
    ctx.lineWidth = 0.45 + hash2(i, 6, 61) * 0.7;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (hash2(i, 7, 67) - 0.42) * 2.5, y - len);
    ctx.stroke();
  }

  for (let i = 0; i < 460; i += 1) {
    const a = hash2(i, 1, 71) * Math.PI * 2;
    const r = Math.sqrt(hash2(i, 2, 73)) * Math.min(110, 58 + soilRadius * 24);
    const x = size * 0.5 + Math.cos(a) * r;
    const y = size * 0.5 + Math.sin(a) * r;
    const radius = 0.45 + hash2(i, 3, 79) * 1.25;
    ctx.fillStyle = rgba(hash2(i, 4, 83) > 0.74 ? p.pebble : p.earthDark, 0.31);
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  return configure(new THREE.CanvasTexture(el));
}

export function createGrassBladeTexture(theme: Theme) {
  const p = PALETTE[theme];
  const el = canvas(64, 256);
  const ctx = el.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D unavailable');
  ctx.clearRect(0, 0, 64, 256);
  const g = ctx.createLinearGradient(0, 256, 0, 0);
  g.addColorStop(0, rgba(p.grassDark, 1));
  g.addColorStop(0.5, rgba(p.grassA, 1));
  g.addColorStop(1, rgba(p.grassB, 0.96));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(20, 256);
  ctx.bezierCurveTo(19, 182, 20, 80, 31, 2);
  ctx.bezierCurveTo(40, 82, 46, 184, 44, 256);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = rgba(p.grassB, 0.34);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(32, 248);
  ctx.quadraticCurveTo(31, 128, 31, 10);
  ctx.stroke();
  for (let i = 0; i < 18; i += 1) {
    const y = 28 + hash2(i, 1, 89) * 206;
    ctx.strokeStyle = rgba(p.grassDark, 0.07 + hash2(i, 2, 97) * 0.1);
    ctx.lineWidth = 0.55;
    ctx.beginPath();
    ctx.moveTo(25, y);
    ctx.lineTo(40, y - 7 - hash2(i, 3, 101) * 7);
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
  g.addColorStop(0.58, new THREE.Color(p.skyTop).lerp(new THREE.Color(p.skyHorizon), 0.62).getStyle());
  g.addColorStop(0.82, p.skyHorizon);
  g.addColorStop(1, new THREE.Color(p.skyHorizon).lerp(new THREE.Color('#ffffff'), 0.12).getStyle());
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  const blob = (x: number, y: number, r: number, alpha: number) => {
    const rg = ctx.createRadialGradient(x, y, r * 0.08, x, y, r);
    rg.addColorStop(0, rgba(p.cloud, alpha));
    rg.addColorStop(0.55, rgba(p.cloud, alpha * 0.48));
    rg.addColorStop(1, rgba(p.cloud, 0));
    ctx.fillStyle = rg;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  };
  for (let band = 0; band < 7; band += 1) {
    const baseX = hash2(band, 1, 109) * w;
    const baseY = 210 + hash2(band, 2, 113) * 140;
    for (let j = 0; j < 6; j += 1) {
      const x = (baseX + (j - 3) * (44 + hash2(j, band, 127) * 30) + w) % w;
      const y = baseY + (hash2(j, band, 131) - 0.5) * 28;
      blob(x, y, 72 + hash2(j, band, 137) * 70, 0.07 + hash2(j, band, 139) * 0.045);
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
