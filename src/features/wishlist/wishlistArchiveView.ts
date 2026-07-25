export type WishlistArchiveViewMode = 'bubbles' | 'feed' | 'polaroid';

const STORAGE_KEY = 'amore:wishlist:archive-view-modes:v1';

type StoredArchiveViews = Partial<Record<'personal' | 'shared', WishlistArchiveViewMode>>;

export function normalizeWishlistArchiveView(value: unknown): WishlistArchiveViewMode | null {
  if (value === 'table') return 'feed';
  return value === 'bubbles' || value === 'feed' || value === 'polaroid' ? value : null;
}

function readStoredArchiveViews(): StoredArchiveViews {
  if (typeof window === 'undefined') return {};

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const stored: StoredArchiveViews = {};
    const personal = normalizeWishlistArchiveView(parsed.personal);
    const shared = normalizeWishlistArchiveView(parsed.shared);
    if (personal) stored.personal = personal;
    if (shared) stored.shared = shared;
    return stored;
  } catch {
    return {};
  }
}

export function readWishlistArchiveView(scope: 'personal' | 'shared'): WishlistArchiveViewMode {
  return readStoredArchiveViews()[scope] ?? 'bubbles';
}

export function writeWishlistArchiveView(
  scope: 'personal' | 'shared',
  view: WishlistArchiveViewMode,
): void {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...readStoredArchiveViews(), [scope]: view }),
    );
  } catch {
    // The selected view still works for this session when storage is unavailable.
  }
}

export function freshArchivePolaroidSeed(): number {
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const value = new Uint32Array(1);
    crypto.getRandomValues(value);
    return value[0] ?? Date.now();
  }

  return (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
}

export function archivePolaroidLayout(seed: number, id: number, index: number) {
  let hash = 2166136261;
  const value = `${seed}:${id}:${index}`;
  for (let offset = 0; offset < value.length; offset += 1) {
    hash ^= value.charCodeAt(offset);
    hash = Math.imul(hash, 16777619);
  }
  hash >>>= 0;

  const direction = (hash & 1) === 0 ? -1 : 1;
  return {
    rotate: ((hash >>> 1) & 1) === 0 ? -4 : 4,
    x: direction * (8 + ((hash >>> 4) % 17)),
    y: ((hash >>> 9) % 15) - 7,
    tapeRotate: ((hash >>> 14) % 7) - 3,
  };
}
