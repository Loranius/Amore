// Конфігурація вибору вигляду «Спогадів» для спільного механізму
// `_shared/viewPreference` — того самого, яким користуються дошка й архів
// вішлиста. Свого сховища модуль не заводить.
import { useViewPreference, type ViewPreferenceConfig } from '@/features/_shared/viewPreference';

export type MemoriesViewMode = 'feed' | 'album' | 'mosaic';

/** Область одна: архів у пари спільний, окремих вкладок у нього немає. */
type MemoriesScope = 'archive';

const CONFIG: ViewPreferenceConfig<MemoriesViewMode> = {
  storageKey: 'amore:memories:view-mode:v1',
  modes: ['feed', 'album', 'mosaic'],
  // Стрічка — єдиний вигляд, що витримує архів на роки; альбом і мозаїка
  // гарніші, але їх обирають свідомо.
  fallback: 'feed',
};

export function useMemoriesView(): readonly [MemoriesViewMode, (view: MemoriesViewMode) => void] {
  return useViewPreference<MemoriesViewMode, MemoriesScope>(CONFIG, 'archive');
}
