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
  planTasks: (planId?: number) =>
    (planId === undefined ? (['planTasks'] as const) : (['planTasks', planId] as const)),
  // Зв'язки читаються однією таблицею на всі плани: рядків одиниці, а
  // окремий запит на кожен план означав би N запитів на списку.
  planLinks: () => ['planLinks'] as const,

  shopping: () => ['shopping'] as const,

  wishlist: (ownerId?: number) =>
    (ownerId === undefined ? (['wishlist'] as const) : (['wishlist', ownerId] as const)),
  wishlistFulfilled: (ownerId: number) => ['wishlist', 'fulfilled', ownerId] as const,
  wishlistShared: () => ['wishlist', 'shared'] as const,
  wishlistSharedFulfilled: () => ['wishlist', 'shared', 'fulfilled'] as const,
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

  // «Спогади». Стрічка гортає всю хронологію одним запитом, місяць —
  // окремим: календарю не потрібні тисячі рядків, щоб намалювати сітку.
  memories: () => ['memories'] as const,
  memoriesMonth: (month: string) => ['memories', 'month', month] as const,
  memoriesDay: (date: string) => ['memories', 'day', date] as const,

  freeLimit: () => ['freeLimit'] as const,
  savingsGoals: () => ['savingsGoals'] as const,
  savingsGoalContributions: (goalId?: string) =>
    (goalId === undefined
      ? (['savingsGoalContributions'] as const)
      : (['savingsGoalContributions', goalId] as const)),
  sharedDaysOff: () => ['sharedDaysOff'] as const,
  scheduleTogetherness: () => ['scheduleTogetherness'] as const,

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
  events: [qk.events()],
  free_limit: [qk.freeLimit()],
  savings_goals: [qk.savingsGoals()],
  media_items: [qk.media()],
  dishes: [qk.dishes()],
  wishlist_items: [['wishlist']],
  shopping_items: [qk.shopping()],
  photo_calendar: [['photoCalendar']],
  memories: [['memories']],
  memory_links: [['memories']],
  memory_days: [['memories']],
  plans: [qk.plans()],
  plan_tasks: [qk.planTasks()],
  plan_links: [qk.planLinks()],
  work_schedule: [['schedule'], qk.sharedDaysOff(), qk.scheduleTogetherness()],
  map_pins: [qk.mapPins()],
  user_locations: [qk.userLocations()],
} as const;
