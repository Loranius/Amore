const FNV_OFFSET_BASIS = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

/** Stable 32-bit FNV-1a hash. Never replace without bumping engineVersion. */
export function stableHash32(value: string): number {
  let hash = FNV_OFFSET_BASIS;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, FNV_PRIME);
  }
  return hash >>> 0;
}

export function artifactSeed(coupleId: string, engineVersion: string): number {
  return stableHash32(`${coupleId}\u001f${engineVersion}`);
}
