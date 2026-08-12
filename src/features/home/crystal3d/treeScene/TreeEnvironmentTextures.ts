import { useEffect, useMemo } from 'react';
import * as THREE from 'three';

type Theme = 'light' | 'dark';

type EnvironmentTextures = {
  ground: THREE.CanvasTexture;
  grassBlade: THREE.CanvasTexture;
  sky: THREE.CanvasTexture;
};

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

const hash2 = (x: number, y: number, salt: number) => {
  const value = Math.sin(x * 127.1 + y * 311.7 + salt * 74.7) * 43758.5453123;
  return value - Math.floor(value);
};

const rgba = (hex: string, alpha = 1) => {
  const color = new THREE.Color(hex);
  return `rgba(${Math.round(color.r * 255)}, ${Math.round(color.g * 255)}, ${Math.round(color.b * 255)}, ${alpha})`;
};

const mixHex = (a: string, b: string, t: number) => {
  const color = new THREE.Color(a).lerp(new THREE.Color(b), clamp01(t));
  return `rgb(${Math.round(color.r * 255)}, ${Math.round(color.g * 255)}, ${Math.round(color.b * 255)})`;
};

const texturePalette = {
  light: {
    grassA: '#657f4c',
    grassB: '#82985d',
    grassDark: '#49633c',
    dryGrass: '#9a9368',
    earthA: '#68533c',
    earthB: '#8a6d4d',
    earthDark: '#4f4031',
    pebble: '#9b927f',
    skyTop: '#69aeda',
    skyHorizon: '#d7e9e9',
    cloud: '#f6f7ef',
  },
  dark: {
    grassA: '#4c673c',
    grassB: '#68834b',
    grassDark: '#354d31',
    dryGrass: '#807b59',
    earthA: '#594634',
    earthB: '#725a41',
    earthDark: '#40352b',
    pebble: '#817b70',
    skyTop: '#5897bf',
    skyHorizon: '#bdcfca',
    cloud: '#e4e9e1',
  },
} as const;

function makeCanvas(width: number, height: number) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function configureTexture(texture: THREE.CanvasTexture, srgb = true) {
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = 4;
  if (srgb) texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function buildGroundTexture(theme: Theme) {
  const palette = texturePalette[theme];
  const size = 512;
  const canvas = makeCanvas(size, size);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas unavailable for tree ground texture');

  const image = ctx.createImageData(size, size);
  const data = image.data;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const u = x / size;
      const v = y / size;
      const worldX = (u - 0.5) * 16;
      const worldZ = (v - 0.5) * 16;
      const radial = Math.hypot(worldX, worldZ);
      const rootEarth = clamp01(1 - (radial - 0.7) / 1.75);
      const patch = hash2(Math.floor(x / 18), Math.floor(y / 18), 19);
      const patchFine = hash2(Math.floor(x / 6), Math.floor(y / 6), 23);
      const earthWeight = clamp01(rootEarth * 0.88 + Math.max(0, patch - 0.76) * 1.55);
      const dryWeight = clamp01(Math.max(0, patchFine - 0.7) * 0.65);

      const grassBase = new THREE.Color(palette.grassA)
        .lerp(new THREE.Color(palette.grassB), hash2(x, y, 31) * 0.42)
        .lerp(new THREE.Color(palette.dryGrass), dryWeight);
      const earthBase = new THREE.Color(palette.earthA)
        .lerp(new THREE.Color(palette.earthB), hash2(x, y, 37) * 0.5)
        .lerp(new THREE.Color(palette.earthDark), hash2(x, y, 41) * 0.16);
      const color = grassBase.lerp(earthBase, earthWeight);
      const grain = (hash2(x * 2, y * 2, 43) - 0.5) * (earthWeight > 0.5 ? 0.16 : 0.08);
      color.offsetHSL(0, 0, grain);

      const offset = (y * size + x) * 4;
      data[offset] = Math.round(clamp01(color.r) * 255);
      data[offset + 1] = Math.round(clamp01(color.g) * 255);
      data[offset + 2] = Math.round(clamp01(color.b) * 255);
      data[offset + 3] = 255;
    }
  }

  ctx.putImageData(image, 0, 0);

  // Grass fibres: tiny directional strokes break the painted-plastic look.
  ctx.lineCap = 'round';
  for (let i = 0; i < 1850; i += 1) {
    const x = hash2(i, 1, 101) * size;
    const y = hash2(i, 2, 103) * size;
    const cx = (x / size - 0.5) * 16;
    const cy = (y / size - 0.5) * 16;
    const root = clamp01(1 - (Math.hypot(cx, cy) - 0.7) / 1.75);
    if (root > 0.72 && hash2(i, 3, 107) < root) continue;
    const len = 2.2 + hash2(i, 4, 109) * 5.8;
    const angle = -1.28 + (hash2(i, 5, 113) - 0.5) * 0.6;
    ctx.strokeStyle = rgba(hash2(i, 6, 127) > 0.52 ? palette.grassDark : palette.grassB, 0.22);
    ctx.lineWidth = 0.45 + hash2(i, 7, 131) * 0.75;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(angle) * len, y + Math.sin(angle) * len);
    ctx.stroke();
  }

  // Soil grains / micro pebbles around the root zone and random exposed patches.
  for (let i = 0; i < 520; i += 1) {
    const angle = hash2(i, 1, 151) * Math.PI * 2;
    const radius = Math.sqrt(hash2(i, 2, 157)) * 96;
    const x = size * 0.5 + Math.cos(angle) * radius;
    const y = size * 0.5 + Math.sin(angle) * radius;
    const r = 0.45 + hash2(i, 3, 163) * 1.25;
    ctx.fillStyle = rgba(hash2(i, 4, 167) > 0.72 ? palette.pebble : palette.earthDark, 0.28);
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  const texture = configureTexture(new THREE.CanvasTexture(canvas));
  texture.repeat.set(1, 1);
  return texture;
}

function buildGrassBladeTexture(theme: Theme) {
  const palette = texturePalette[theme];
  const canvas = makeCanvas(64, 256);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas unavailable for grass texture');

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const gradient = ctx.createLinearGradient(0, canvas.height, 0, 0);
  gradient.addColorStop(0, rgba(palette.grassDark, 1));
  gradient.addColorStop(0.48, rgba(palette.grassA, 1));
  gradient.addColorStop(1, rgba(palette.grassB, 0.96));

  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.moveTo(20, 256);
  ctx.bezierCurveTo(18, 170, 20, 70, 31, 2);
  ctx.bezierCurveTo(40, 76, 46, 178, 44, 256);
  ctx.closePath();
  ctx.fill();

  // Midrib + tiny tonal breaks make the blade read as organic instead of a card.
  ctx.strokeStyle = rgba(palette.grassB, 0.34);
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(32, 248);
  ctx.quadraticCurveTo(31, 130, 31, 12);
  ctx.stroke();

  for (let i = 0; i < 22; i += 1) {
    const y = 28 + hash2(i, 1, 181) * 204;
    const alpha = 0.07 + hash2(i, 2, 191) * 0.09;
    ctx.strokeStyle = rgba(palette.grassDark, alpha);
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.moveTo(25 + hash2(i, 3, 193) * 3, y);
    ctx.lineTo(39 + hash2(i, 4, 197) * 3, y - 6 - hash2(i, 5, 199) * 7);
    ctx.stroke();
  }

  const texture = configureTexture(new THREE.CanvasTexture(canvas));
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}

function cloudBlob(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, alpha: number, color: string) {
  const gradient = ctx.createRadialGradient(x, y, radius * 0.08, x, y, radius);
  gradient.addColorStop(0, rgba(color, alpha));
  gradient.addColorStop(0.52, rgba(color, alpha * 0.55));
  gradient.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = gradient;
  ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
}

function buildSkyTexture(theme: Theme) {
  const palette = texturePalette[theme];
  const width = 1024;
  const height = 512;
  const canvas = makeCanvas(width, height);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas unavailable for sky texture');

  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, palette.skyTop);
  gradient.addColorStop(0.52, mixHex(palette.skyTop, palette.skyHorizon, 0.56));
  gradient.addColorStop(0.78, palette.skyHorizon);
  gradient.addColorStop(1, mixHex(palette.skyHorizon, '#ffffff', 0.14));
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  // Large, low-contrast cloud wisps. They are baked into one sky map, so they
  // cost no extra draw calls and never compete with the tree silhouette.
  for (let band = 0; band < 7; band += 1) {
    const baseX = hash2(band, 1, 211) * width;
    const baseY = 205 + hash2(band, 2, 223) * 145;
    const blobs = 5 + Math.floor(hash2(band, 3, 227) * 4);
    for (let j = 0; j < blobs; j += 1) {
      const x = (baseX + (j - blobs * 0.5) * (38 + hash2(j, band, 229) * 28) + width) % width;
      const y = baseY + (hash2(j, band, 233) - 0.5) * 30;
      const radius = 70 + hash2(j, band, 239) * 72;
      cloudBlob(ctx, x, y, radius, 0.08 + hash2(j, band, 241) * 0.055, palette.cloud);
      if (x < radius) cloudBlob(ctx, x + width, y, radius, 0.09, palette.cloud);
      if (x > width - radius) cloudBlob(ctx, x - width, y, radius, 0.09, palette.cloud);
    }
  }

  // Barely visible atmospheric grain removes the perfectly flat digital sky.
  const image = ctx.getImageData(0, 0, width, height);
  const data = image.data;
  for (let y = 0; y < height; y += 2) {
    for (let x = 0; x < width; x += 2) {
      const amount = (hash2(x, y, 251) - 0.5) * 4;
      for (let oy = 0; oy < 2; oy += 1) {
        for (let ox = 0; ox < 2; ox += 1) {
          const px = x + ox;
          const py = y + oy;
          if (px >= width || py >= height) continue;
          const offset = (py * width + px) * 4;
          data[offset] = Math.max(0, Math.min(255, data[offset] + amount));
          data[offset + 1] = Math.max(0, Math.min(255, data[offset + 1] + amount));
          data[offset + 2] = Math.max(0, Math.min(255, data[offset + 2] + amount));
        }
      }
    }
  }
  ctx.putImageData(image, 0, 0);

  const texture = configureTexture(new THREE.CanvasTexture(canvas));
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}

export function useTreeEnvironmentTextures(theme: Theme): EnvironmentTextures {
  const textures = useMemo(() => ({
    ground: buildGroundTexture(theme),
    grassBlade: buildGrassBladeTexture(theme),
    sky: buildSkyTexture(theme),
  }), [theme]);

  useEffect(() => () => {
    textures.ground.dispose();
    textures.grassBlade.dispose();
    textures.sky.dispose();
  }, [textures]);

  return textures;
}
