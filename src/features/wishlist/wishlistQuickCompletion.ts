interface PendingQuickCompletion {
  idempotencyKey: string;
  createdAt: number;
}

const DEFAULT_REQUEST_TTL_MS = 15 * 60 * 1000;

export class WishlistQuickCompletionTracker {
  private readonly pending = new Map<number, PendingQuickCompletion>();

  constructor(
    private readonly makeId: () => string = () => crypto.randomUUID(),
    private readonly now: () => number = () => Date.now(),
    private readonly ttlMs = DEFAULT_REQUEST_TTL_MS,
  ) {}

  acquire(wishId: number): string {
    const currentTime = this.now();
    const existing = this.pending.get(wishId);

    if (existing && currentTime - existing.createdAt < this.ttlMs) {
      return existing.idempotencyKey;
    }

    const idempotencyKey = this.makeId();
    this.pending.set(wishId, { idempotencyKey, createdAt: currentTime });
    return idempotencyKey;
  }

  release(wishId: number): void {
    this.pending.delete(wishId);
  }
}
