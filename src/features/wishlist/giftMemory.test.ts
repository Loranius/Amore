import { describe, expect, it } from 'vitest';
import {
  giftMemoryAssetFingerprint,
  isStorageObjectAlreadyExistsError,
} from './giftMemoryRetry';

describe('Gift Memory retry paths', () => {
  it('keeps the same fingerprint for the same file metadata', () => {
    const first = new File(['same'], 'reaction.jpg', {
      type: 'image/jpeg',
      lastModified: 1_700_000_000_000,
    });
    const retry = new File(['same'], 'reaction.jpg', {
      type: 'image/jpeg',
      lastModified: 1_700_000_000_000,
    });

    expect(giftMemoryAssetFingerprint(retry)).toBe(giftMemoryAssetFingerprint(first));
  });

  it('changes the fingerprint when the selected file changes', () => {
    const first = new File(['first'], 'reaction.jpg', {
      type: 'image/jpeg',
      lastModified: 1_700_000_000_000,
    });
    const replacement = new File(['replacement'], 'reaction-new.jpg', {
      type: 'image/jpeg',
      lastModified: 1_700_000_000_001,
    });

    expect(giftMemoryAssetFingerprint(replacement)).not.toBe(giftMemoryAssetFingerprint(first));
  });

  it.each([
    { statusCode: '409', message: 'The resource already exists' },
    { status: 409, message: 'Conflict' },
    { message: 'Resource exists' },
  ])('recognizes retry-safe existing-object conflicts', (error) => {
    expect(isStorageObjectAlreadyExistsError(error)).toBe(true);
  });

  it('does not swallow unrelated Storage failures', () => {
    expect(isStorageObjectAlreadyExistsError({ statusCode: '403', message: 'Forbidden' })).toBe(false);
  });
});
