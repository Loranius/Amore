import {
  withWishlistImageTimeout,
  WISHLIST_IMAGE_TASK_TIMEOUT_MS,
} from './wishlistImageTimeouts';

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

  constructor(private readonly taskTimeoutMs: number = WISHLIST_IMAGE_TASK_TIMEOUT_MS) {}

  enqueue<T>(task: () => Promise<T>): Promise<T> {
    // Черга НАВМИСНО послідовна: паралельна сегментація вбила б телефон.
    // Ціна цього — одне завдання, що не завершилось, зупиняє обробку всіх
    // наступних картинок до перезавантаження сторінки. Тому кожне завдання
    // має стелю часу: конкретні необмежені очікування вже полагоджені
    // (див. wishlistImageTimeouts.ts), а це — остання лінія оборони, щоб
    // наступне таке не змогло знову заморозити конвеєр.
    const result = this.tail.then(
      () => withWishlistImageTimeout(task(), this.taskTimeoutMs, 'image_task_timeout'),
      () => withWishlistImageTimeout(task(), this.taskTimeoutMs, 'image_task_timeout'),
    );
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
