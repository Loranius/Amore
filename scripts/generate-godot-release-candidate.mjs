import { createHash } from 'node:crypto';
import { readFile, rename, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

const REQUIRED_ASSETS = ['index.html', 'index.js', 'index.wasm', 'index.pck'];
const root = path.resolve(process.env.GODOT_RC_ROOT || 'dist/godot/evolution-engine');
const releaseId = (
  process.env.GODOT_RC_RELEASE_ID
  || process.env.VITE_EVOLUTION_GODOT_RELEASE_ID
  || ''
).trim();
const acceptanceDigest = (
  process.env.GODOT_RC_ACCEPTANCE_SHA256
  || process.env.VITE_EVOLUTION_GODOT_ACCEPTANCE_SHA256
  || ''
).trim().toLowerCase();
const buildSha = (
  process.env.GODOT_RC_BUILD_SHA
  || process.env.GITHUB_SHA
  || ''
).trim().toLowerCase();
const generatedAt = process.env.GODOT_RC_GENERATED_AT || new Date().toISOString();

if (!/^[a-z0-9][a-z0-9._-]{2,63}$/i.test(releaseId)) {
  throw new Error('GODOT_RC_RELEASE_ID must be a valid bounded release ID.');
}
if (!/^[0-9a-f]{64}$/.test(acceptanceDigest)) {
  throw new Error('GODOT_RC_ACCEPTANCE_SHA256 must be a 64-character SHA-256 digest.');
}
if (!/^[0-9a-f]{7,64}$/.test(buildSha)) {
  throw new Error('GODOT_RC_BUILD_SHA must be a hexadecimal Git commit SHA.');
}
if (Number.isNaN(Date.parse(generatedAt))) {
  throw new Error('GODOT_RC_GENERATED_AT must be an ISO-compatible timestamp.');
}

const assets = [];
for (const file of REQUIRED_ASSETS) {
  const filePath = path.join(root, file);
  const fileStat = await stat(filePath);
  if (!fileStat.isFile() || fileStat.size <= 0) {
    throw new Error(`Required Godot release asset is empty or missing: ${file}`);
  }
  const bytes = await readFile(filePath);
  assets.push({
    file,
    bytes: fileStat.size,
    sha256: createHash('sha256').update(bytes).digest('hex'),
  });
}

const manifest = {
  version: 'godot-release-candidate-v1',
  phase: 15,
  runtimeVersion: '4.7.1',
  releaseId,
  acceptanceDigest,
  buildSha,
  generatedAt: new Date(generatedAt).toISOString(),
  assets,
  totalBytes: assets.reduce((sum, asset) => sum + asset.bytes, 0),
};

const outputPath = path.join(root, 'release-manifest.json');
const temporaryPath = `${outputPath}.tmp`;
await writeFile(temporaryPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
await rename(temporaryPath, outputPath);

console.log(`Phase 15 release candidate: ${releaseId}`);
console.log(`Build SHA: ${buildSha}`);
console.log(`Physical acceptance digest: ${acceptanceDigest}`);
for (const asset of assets) {
  console.log(`${asset.file} ${asset.bytes} bytes sha256:${asset.sha256}`);
}
console.log(`Manifest: ${outputPath}`);
