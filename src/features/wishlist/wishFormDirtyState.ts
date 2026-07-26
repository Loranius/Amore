export interface WishFormDraftSnapshot {
  scope: string;
  title: string;
  link: string;
  imageUrl: string;
  imagePreference: string;
  price: string;
  priority: string;
  description: string;
}

const SNAPSHOT_KEYS = [
  'scope',
  'title',
  'link',
  'imageUrl',
  'imagePreference',
  'price',
  'priority',
  'description',
] as const satisfies ReadonlyArray<keyof WishFormDraftSnapshot>;

export function hasUnsavedWishChanges(
  initial: WishFormDraftSnapshot,
  current: WishFormDraftSnapshot,
  hasPendingFile: boolean,
): boolean {
  return hasPendingFile || SNAPSHOT_KEYS.some((key) => initial[key] !== current[key]);
}
