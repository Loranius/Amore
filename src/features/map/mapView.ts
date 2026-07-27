// Конфігурація вибору вигляду карти для спільного механізму
// `_shared/viewPreference` — того самого, яким користуються вішлист і
// «Спогади». Свого сховища модуль не заводить.
import { useViewPreference, type ViewPreferenceConfig } from '@/features/_shared/viewPreference';

export type MapViewMode = 'map' | 'timeline' | 'cities';

/** Область одна: карта в пари спільна, окремих вкладок у неї немає. */
type MapScope = 'places';

const CONFIG: ViewPreferenceConfig<MapViewMode> = {
  storageKey: 'amore:map:view-mode:v1',
  modes: ['map', 'timeline', 'cities'],
  // Карта — те, заради чого модуль існує; решта відповідає на питання,
  // на які карта не відповідає, і їх обирають свідомо.
  fallback: 'map',
};

export function useMapView(): readonly [MapViewMode, (view: MapViewMode) => void] {
  return useViewPreference<MapViewMode, MapScope>(CONFIG, 'places');
}
