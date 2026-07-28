// ============================================================
// Маркери на карті: імперативний шар між mapbox і станом React.
// ------------------------------------------------------------
// Винесено з MapPage, бо це єдине місце, де змішані DOM, mapbox і
// скупчення — і саме його треба вміти запустити на справжній карті в
// стенді, а не переписувати там копію тих самих сорока рядків.
//
// Чиста частина (хто з ким злипається, що перемальовувати) живе в
// mapPinView.ts і покрита юніт-тестами; тут лишається тільки робота з
// вузлами й самою картою.
// ============================================================
import mapboxgl from 'mapbox-gl';
import { pinCategoryNode } from '@/components/icons/MapIcon';
import { CATEGORIES, CLUSTER_RADIUS_PX, PIN_TIP_OFFSET } from './mapConstants';
import { clusterPins, clusterSignature, planSync } from './mapPinView';
import type { MapPinRow } from '@/types';

/** Намальовані маркери: ключ скупчення → сам маркер і підпис вигляду. */
export type MarkerStore = Map<string, { marker: mapboxgl.Marker; sig: string }>;

interface SyncOptions {
  map: mapboxgl.Map;
  pins: readonly MapPinRow[];
  store: MarkerStore;
  onOpenPin: (pin: MapPinRow) => void;
}

/** Звести маркери на карті до поточного набору міток. */
export function syncPinMarkers({ map, pins, store, onOpenPin }: SyncOptions): void {
  // Порядок входу визначає склад скупчень, тому сортуємо за id: інакше
  // зміна порядку в масиві переклеювала б ключі на кожному запиті.
  const ordered = [...pins].sort((a, b) => a.id - b.id);
  const clusters = clusterPins(
    ordered.map((pin) => {
      const pt = map.project([pin.lng, pin.lat]);
      return { pin, x: pt.x, y: pt.y };
    }),
    CLUSTER_RADIUS_PX,
  );

  const byKey = new Map(clusters.map((c) => [c.key, c]));
  const wanted = new Map(clusters.map((c) => [c.key, clusterSignature(c)]));
  const drawn = new Map([...store].map(([key, m]) => [key, m.sig]));
  const plan = planSync(drawn, wanted);
  if (!plan.add.length && !plan.remove.length) return;

  for (const key of plan.remove) {
    store.get(key)?.marker.remove();
    store.delete(key);
  }

  for (const key of plan.add) {
    const cluster = byKey.get(key);
    if (!cluster) continue;
    const single = cluster.pins.length === 1 ? cluster.pins[0]! : null;
    const el = document.createElement('div');

    if (single) {
      const cat = CATEGORIES[single.category];
      el.className = 'map-marker';
      el.style.background = cat.color;
      // Значок в окремому елементі: сама крапля повернута на -45°, і без
      // зворотного повороту всередині іконка стояла перекошеною.
      const icon = document.createElement('span');
      icon.className = 'map-marker-icon';
      icon.appendChild(pinCategoryNode(single.category, 15));
      el.appendChild(icon);
      el.setAttribute('aria-label', single.title);
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        onOpenPin(single);
      });
    } else {
      el.className = 'map-cluster';
      el.textContent = String(cluster.pins.length);
      el.title = cluster.pins.map((p) => p.title).join(', ');
      // Тап по скупченню — не модалка, а наближення: показуємо те, що
      // під ним, і даємо вибрати самому.
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const bounds = new mapboxgl.LngLatBounds();
        cluster.pins.forEach((p) => bounds.extend([p.lng, p.lat]));
        map.fitBounds(bounds, { padding: 80, maxZoom: 17, duration: 500 });
      });
    }

    const at = single
      ? new mapboxgl.LngLat(single.lng, single.lat)
      : map.unproject([cluster.x, cluster.y]);
    // Крапля зсувається так, щоб на координаті стояло її вістря; коло
    // скупчення лишається центром на центроїді — воно ні на що не вказує.
    const marker = single
      ? new mapboxgl.Marker({ element: el, offset: PIN_TIP_OFFSET })
      : new mapboxgl.Marker(el);
    store.set(key, { marker: marker.setLngLat(at).addTo(map), sig: wanted.get(key)! });
  }
}
