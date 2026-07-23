// ============================================================
// QUERY KEYS — типобезпечна фабрика ключів React Query
// ------------------------------------------------------------
// Заміна рядкових ключів DataCache ('shopping:items', 'wishlist:123',
// 'media:movie:want' …). Ієрархічні масиви дають часткову
// інвалідацію: invalidateQueries({ queryKey: qk.media() }) скидає
// усі media-під-ключі. Мапу «старий ключ → новий» див. STRUCTURE.md.
// ============================================================
import type { MediaType } from '@/types';

export const qk = {
  users: () => ['users'] as const,

  events: () => ['events'] as const,
  plans: () => ['plans'] as const,

  shopping: () => ['shopping'] as const,

  wishlist: (ownerId?: number) =>
    (ownerId === undefined ? (['wishlist'] as const) : (['wishlist', ownerId] as const)),
  wishlistFulfilled: (ownerId: number) => ['wishlist', 'fulfilled', ownerId] as const,
  wishlistShared: () => ['wishlist', 'shared'] as const,
  wishlistStats: () => ['wishlist', 'stats'] as const,

  notifications: () => ['notifications'] as const,
  notificationsFeed: () => ['notifications', 'feed'] as const,
  notificationsUnread: () => ['notifications', 'unread'] as const,

  media: (type?: MediaType) =>
    (type === undefined ? (['media'] as const) : (['media', type] as const)),

  dishes: () => ['dishes'] as const,

  schedule: (month: string) => ['schedule', month] as const,
  photoCalendar: (month: string) => ['photoCalendar', month] as const,
  photoCalendarAll: () => ['photoCalendar', 'all'] as const,
  photos: () => ['photos'] as const,

  freeLimit: () => ['freeLimit'] as const,
  savingsGoals: () => ['savingsGoals'] as const,
  dates: () => ['dates'] as const,
  sharedDaysOff: () => ['sharedDaysOff'] as const,

  mapPins: () => ['mapPins'] as const,
  userLocations: () => ['userLocations'] as const,

  swipeVotes: (userId: number) => ['swipeVotes', userId] as const,

  settings: () => ['settings'] as const,
  userSizes: (userId: number) => ['userSizes', userId] as const,

  whereto: () => ['whereto'] as const,
} as const;

/** Ключі, за якими інвалідувати кеш при realtime-зміні кожної таблиці. */
export const realtimeInvalidation: Record<
  import('@/types').RealtimeTable,
  ReadonlyArray<readonly unknown[]>
> = {
  events: [qk.events(), qk.plans()],
  free_limit: [qk.freeLimit()],
  savings_goals: [qk.savingsGoals()],
  dates: [qk.dates()],
  media_items: [qk.media()],
  dishes: [qk.dishes()],
  wishlist_items: [['wishlist']],
  app_notifications: [qk.notifications()],
  shopping_items: [qk.shopping()],
  photo_calendar: [['photoCalendar']],
  work_schedule: [['schedule'], qk.sharedDaysOff()],
  map_pins: [qk.mapPins()],
  user_locations: [qk.userLocations()],
};
