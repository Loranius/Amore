export interface WishlistImageProcessingEnvironment {
  visible: boolean;
  online: boolean;
}

export function wishlistImageProcessingEnvironmentReady(
  environment: WishlistImageProcessingEnvironment,
): boolean {
  return environment.visible && environment.online;
}

export function currentWishlistImageProcessingEnvironment(): WishlistImageProcessingEnvironment {
  const visible = typeof document === 'undefined' || document.visibilityState !== 'hidden';
  const online = typeof navigator === 'undefined' || navigator.onLine !== false;
  return { visible, online };
}

export class WishlistImageProcessingQueue {
  private tail: Promise<void> = Promise.resolve();

  enqueue<T>(task: () => Promise<T>): Promise<T> {
    const result = this.tail.then(task, task);
    this.tail = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }
}

const wishlistImageProcessingQueue = new WishlistImageProcessingQueue();

export function scheduleWishlistImageProcessing<T>(task: () => Promise<T>): Promise<T> {
  return wishlistImageProcessingQueue.enqueue(task);
}
