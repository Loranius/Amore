import type { WishlistMutationPayload } from './wishlistRpc';

export interface WishlistCreateRequestInput {
  payload: WishlistMutationPayload;
  ownerId: number;
  shared: boolean;
}

interface PendingCreateRequest {
  requestId: string;
  createdAt: number;
}

const DEFAULT_REQUEST_TTL_MS = 15 * 60 * 1000;

function normalizedImageKey(value: string | null): string | null {
  if (!value) return null;
  return value.includes('/storage/v1/object/public/wishlist-photos/')
    ? '__uploaded_wishlist_photo__'
    : value;
}

export function wishlistCreateRequestKey(input: WishlistCreateRequestInput): string {
  return JSON.stringify([
    input.ownerId,
    input.shared,
    input.payload.title,
    input.payload.description,
    input.payload.link,
    normalizedImageKey(input.payload.image_url),
    input.payload.price,
    input.payload.priority,
  ]);
}

export class WishlistCreateRequestTracker {
  private readonly pending = new Map<string, PendingCreateRequest>();

  constructor(
    private readonly makeId: () => string = () => crypto.randomUUID(),
    private readonly now: () => number = () => Date.now(),
    private readonly ttlMs = DEFAULT_REQUEST_TTL_MS,
  ) {}

  acquire(input: WishlistCreateRequestInput): { key: string; requestId: string } {
    const key = wishlistCreateRequestKey(input);
    const currentTime = this.now();
    const existing = this.pending.get(key);

    if (existing && currentTime - existing.createdAt < this.ttlMs) {
      return { key, requestId: existing.requestId };
    }

    const requestId = this.makeId();
    this.pending.set(key, { requestId, createdAt: currentTime });
    return { key, requestId };
  }

  release(key: string): void {
    this.pending.delete(key);
  }
}
