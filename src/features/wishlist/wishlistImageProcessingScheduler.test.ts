import { describe, expect, it } from 'vitest';
import {
  WishlistImageProcessingQueue,
  wishlistImageProcessingEnvironmentReady,
} from './wishlistImageProcessingScheduler';

describe('wishlist image processing scheduler', () => {
  it('runs expensive image jobs one at a time', async () => {
    const queue = new WishlistImageProcessingQueue();
    let active = 0;
    let maxActive = 0;
    const order: string[] = [];

    const run = (name: string, delay: number) => queue.enqueue(async () => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      order.push(`${name}:start`);
      await new Promise((resolve) => setTimeout(resolve, delay));
      order.push(`${name}:end`);
      active -= 1;
      return name;
    });

    const results = await Promise.all([
      run('first', 8),
      run('second', 1),
      run('third', 1),
    ]);

    expect(results).toEqual(['first', 'second', 'third']);
    expect(maxActive).toBe(1);
    expect(order).toEqual([
      'first:start',
      'first:end',
      'second:start',
      'second:end',
      'third:start',
      'third:end',
    ]);
  });

  it('continues after a failed job', async () => {
    const queue = new WishlistImageProcessingQueue();
    const failed = queue.enqueue(async () => {
      throw new Error('expected');
    });
    const recovered = queue.enqueue(async () => 'ready');

    await expect(failed).rejects.toThrow('expected');
    await expect(recovered).resolves.toBe('ready');
  });

  it('waits while the app is hidden or offline', () => {
    expect(wishlistImageProcessingEnvironmentReady({ visible: true, online: true })).toBe(true);
    expect(wishlistImageProcessingEnvironmentReady({ visible: false, online: true })).toBe(false);
    expect(wishlistImageProcessingEnvironmentReady({ visible: true, online: false })).toBe(false);
  });
});
