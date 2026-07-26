import { readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';

function argument(name, fallback) {
  const prefix = `--${name}=`;
  const value = process.argv.find((entry) => entry.startsWith(prefix))?.slice(prefix.length);
  return value || fallback;
}

function normalizeBase(value) {
  const withLeadingSlash = value.startsWith('/') ? value : `/${value}`;
  return withLeadingSlash.endsWith('/') ? withLeadingSlash : `${withLeadingSlash}/`;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function exists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

const base = normalizeBase(argument('base', '/Amore/'));
const dist = resolve(argument('dist', 'dist'));
const indexPath = resolve(dist, 'index.html');
const manifestPath = resolve(dist, 'manifest.webmanifest');
const serviceWorkerPath = resolve(dist, 'sw.js');

assert(await exists(indexPath), 'pages_build_missing_index');
assert(await exists(manifestPath), 'pages_build_missing_manifest');
assert(await exists(serviceWorkerPath), 'pages_build_missing_service_worker');

const indexHtml = await readFile(indexPath, 'utf8');
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));

assert(indexHtml.includes('id="root"'), 'pages_build_missing_root');
assert(
  indexHtml.includes(`${base}icons/icon-192.png`),
  `pages_build_icon_not_base_aware:${base}`,
);
assert(!indexHtml.includes('href="/icons/'), 'pages_build_contains_root_icon_path');
assert(
  manifest.start_url === base,
  `pages_build_wrong_start_url:${String(manifest.start_url)}`,
);
assert(
  manifest.scope === base,
  `pages_build_wrong_scope:${String(manifest.scope)}`,
);

const localReferences = [...indexHtml.matchAll(/(?:src|href)="([^"]+)"/g)]
  .map((match) => match[1])
  .filter((value) => value && !/^(?:https?:|data:|#|mailto:|tel:)/.test(value));

for (const reference of localReferences) {
  if (reference.startsWith('/')) {
    assert(
      reference.startsWith(base),
      `pages_build_asset_outside_base:${reference}`,
    );
  }
}

const icons = Array.isArray(manifest.icons) ? manifest.icons : [];
assert(icons.some((icon) => icon?.sizes === '192x192'), 'pages_build_missing_192_icon');
assert(icons.some((icon) => icon?.sizes === '512x512'), 'pages_build_missing_512_icon');

console.log(`GitHub Pages build verified for ${base}`);
