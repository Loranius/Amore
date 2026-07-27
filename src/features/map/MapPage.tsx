// ============================================================
// MapPage — карта спогадів і планів.
// ------------------------------------------------------------
// mapbox-gl керується імперативно через refs; маркери синкаються під
// стан React. Три правила, кожне з них — виправлення реального болю:
//
// 1. Камера рухається лише тоді, коли її про це просять: перше
//    завантаження, зміна фільтра, перехід за карткою. Раніше fitBounds
//    висів на `visiblePins`, а будь-яка мутація робить invalidate — тож
//    після кожного збереження оцінки карту відкидало на загальний план.
// 2. Маркери оновлюються різницею (planMarkerSync), а не «знищити все й
//    створити наново».
// 3. Нове місце ставиться ЯВНО — режимом прицілу. Раніше будь-який тап
//    по карті відкривав модалку створення, і промах пальцем під час
//    панорамування коштував модалки.
// ============================================================
import { useEffect, useMemo, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { MAPBOX_TOKEN, geocodePlaces } from '@/lib/mapbox';
import { useUsers } from '@/features/_shared/useUsers';
import {
  CATEGORIES,
  DEFAULT_CENTER,
  USER_LOCATION_STYLES,
} from './mapConstants';
import { markerSignature, planMarkerSync } from './mapPinView';
import { useMapPins, useMapPinMutations, useCityBackfill } from './useMapPins';
import { useUserLocations, useCheckin } from './useLocations';
import { CatFilterBar, PinCards } from './MapPanels';
import { PinModal } from './PinModal';
import { AddPinModal } from './AddPinModal';
import { LocationHistoryModal } from './LocationHistoryModal';
import { PortalDecor } from '@/features/auth/PortalDecor';
import { useConfirm } from '@/providers/ConfirmProvider';
import type { MapPinRow, PinCategory, MapboxFeature } from '@/types';

export function MapPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const pinMarkers = useRef(new Map<number, { marker: mapboxgl.Marker; sig: string }>());
  const locMarkers = useRef<mapboxgl.Marker[]>([]);
  /** Фільтр, під який камеру вже зводили. Стереже від повторних стрибків. */
  const fittedFor = useRef<string | null>(null);

  const { data: pins = [] } = useMapPins();
  const { data: users = [] } = useUsers();
  const { data: locations = [] } = useUserLocations();
  const { add, update, remove } = useMapPinMutations();
  const checkin = useCheckin();
  const confirmDialog = useConfirm();
  useCityBackfill(pins);

  const [filter, setFilter] = useState<'all' | PinCategory>('all');
  const [search, setSearch] = useState('');
  const [geoResults, setGeoResults] = useState<MapboxFeature[]>([]);
  const [addAt, setAddAt] = useState<{ lat: number; lng: number; title?: string } | null>(null);
  const [placing, setPlacing] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [focusedId, setFocusedId] = useState<number | null>(null);

  // Модалка тримає id, а не знімок рядка: маркер живе довше за одне
  // перемальовування, і колишній `setViewPin(pin)` показував би дані,
  // застиглі на момент створення маркера.
  const [viewPinId, setViewPinId] = useState<number | null>(null);
  const [justAdded, setJustAdded] = useState<MapPinRow | null>(null);
  const viewPin =
    pins.find((p) => p.id === viewPinId) ??
    (justAdded && justAdded.id === viewPinId ? justAdded : null);

  const visiblePins = useMemo(
    () => (filter === 'all' ? pins : pins.filter((p) => p.category === filter)),
    [pins, filter],
  );

  // ── Ініт карти (один раз) ──────────────────────────────────
  useEffect(() => {
    if (mapRef.current || !containerRef.current) return;
    mapboxgl.accessToken = MAPBOX_TOKEN;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: DEFAULT_CENTER,
      zoom: 5,
    });
    map.addControl(new mapboxgl.NavigationControl(), 'top-right');
    const geo = new mapboxgl.GeolocateControl({
      positionOptions: { enableHighAccuracy: true },
      showUserLocation: true,
    });
    map.addControl(geo, 'top-right');
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      pinMarkers.current.clear();
    };
  }, []);

  // ── Синк маркерів пінів (різницею) ─────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const drawn = new Map([...pinMarkers.current].map(([id, m]) => [id, m.sig]));
    const plan = planMarkerSync(drawn, visiblePins);
    if (!plan.add.length && !plan.remove.length) return;

    for (const id of plan.remove) {
      pinMarkers.current.get(id)?.marker.remove();
      pinMarkers.current.delete(id);
    }

    const byId = new Map(visiblePins.map((p) => [p.id, p]));
    for (const id of plan.add) {
      const pin = byId.get(id);
      if (!pin) continue;
      const cat = CATEGORIES[pin.category];
      const elMarker = document.createElement('div');
      elMarker.className = 'map-marker';
      elMarker.style.background = cat.color;
      // Емодзі в окремому елементі: сама крапля повернута на -45°, і без
      // зворотного повороту всередині іконка стояла перекошеною.
      const elIcon = document.createElement('span');
      elIcon.className = 'map-marker-icon';
      elIcon.textContent = cat.emoji;
      elMarker.appendChild(elIcon);
      elMarker.addEventListener('click', (e) => {
        e.stopPropagation();
        setFocusedId(pin.id);
        setViewPinId(pin.id);
      });
      const marker = new mapboxgl.Marker(elMarker).setLngLat([pin.lng, pin.lat]).addTo(map);
      pinMarkers.current.set(pin.id, { marker, sig: markerSignature(pin) });
    }
  }, [visiblePins]);

  // ── Камера: лише перше зведення на кожен фільтр ────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || visiblePins.length === 0) return;
    if (fittedFor.current === filter) return;
    fittedFor.current = filter;

    if (visiblePins.length === 1) {
      const p = visiblePins[0]!;
      map.flyTo({ center: [p.lng, p.lat], zoom: 12 });
      return;
    }
    const bounds = new mapboxgl.LngLatBounds();
    visiblePins.forEach((p) => bounds.extend([p.lng, p.lat]));
    map.fitBounds(bounds, { padding: 60, maxZoom: 13, duration: 600 });
  }, [filter, visiblePins]);

  // ── Синк маркерів геолокації партнерів ─────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    locMarkers.current.forEach((m) => m.remove());
    locMarkers.current = [];

    const sortedUsers = [...users].sort((a, b) => a.name.localeCompare(b.name));
    for (const loc of locations) {
      const idx = sortedUsers.findIndex((u) => u.id === loc.user_id);
      const style = USER_LOCATION_STYLES[idx] ?? USER_LOCATION_STYLES[0];
      const elMarker = document.createElement('div');
      elMarker.className = 'map-location-marker';
      elMarker.style.background = style.color;
      elMarker.textContent = style.emoji;
      const marker = new mapboxgl.Marker(elMarker).setLngLat([loc.lng, loc.lat]).addTo(map);
      locMarkers.current.push(marker);
    }
  }, [locations, users]);

  // ── Пошук місць (debounce) ─────────────────────────────────
  useEffect(() => {
    const q = search.trim();
    if (q.length < 3) {
      setGeoResults([]);
      return;
    }
    const t = setTimeout(async () => setGeoResults(await geocodePlaces(q)), 350);
    return () => clearTimeout(t);
  }, [search]);

  const flyTo = (lng: number, lat: number, zoom = 15) =>
    mapRef.current?.flyTo({ center: [lng, lat], zoom });

  const onCardClick = (pin: MapPinRow) => {
    setFocusedId(pin.id);
    flyTo(pin.lng, pin.lat);
    setViewPinId(pin.id);
  };

  const pickGeoResult = (f: MapboxFeature) => {
    const [lng, lat] = f.center;
    setGeoResults([]);
    setSearch('');
    flyTo(lng, lat, 14);
    setAddAt({ lat, lng, title: f.text ?? f.place_name ?? '' });
  };

  /** Підтвердити місце під прицілом — координати беремо з центра карти. */
  const confirmPlacement = () => {
    const c = mapRef.current?.getCenter();
    setPlacing(false);
    if (c) setAddAt({ lat: c.lat, lng: c.lng });
  };

  return (
    <section className="map pink-page">
      <PortalDecor density="light" parallax={false} />
      <div className="map-search-wrap">
        <input
          id="map-search"
          name="search"
          type="text"
          className="map-search-inp"
          placeholder="Пошук місця або фільтр збережених…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {geoResults.length > 0 && (
          <div className="map-geo-dropdown">
            {geoResults.map((f, i) => (
              <button key={i} type="button" className="map-geo-item" onClick={() => pickGeoResult(f)}>
                <b>{f.text}</b>
                <span className="map-geo-sub">{f.place_name}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="map-stage">
        <div ref={containerRef} className="map-container" />
        {placing ? (
          <>
            <div className="map-crosshair" aria-hidden="true" />
            <div className="map-place-bar">
              <span>Наведіть карту на місце</span>
              <button type="button" className="map-place-cancel" onClick={() => setPlacing(false)}>
                Скасувати
              </button>
              <button type="button" className="map-place-ok" onClick={confirmPlacement}>
                Тут
              </button>
            </div>
          </>
        ) : (
          <button type="button" className="map-fab" onClick={() => setPlacing(true)}>
            + Місце
          </button>
        )}
      </div>

      <div className="map-actions-row">
        <button type="button" className="btn" onClick={() => checkin.mutate(undefined, {
          onSuccess: (c) => flyTo(c.lng, c.lat, 14),
        })} disabled={checkin.isPending}>
          {checkin.isPending ? '⏳' : '📍 Я тут'}
        </button>
        <button type="button" className="btn-secondary" onClick={() => setHistoryOpen(true)}>
          📋 Архів 24 год
        </button>
      </div>

      <CatFilterBar pins={pins} active={filter} onChange={setFilter} />
      <PinCards
        allPins={pins}
        visiblePins={visiblePins}
        search={search}
        focusedId={focusedId}
        onCardClick={onCardClick}
      />

      {addAt && (
        <AddPinModal
          lat={addAt.lat}
          lng={addAt.lng}
          initialTitle={addAt.title}
          onClose={() => setAddAt(null)}
          onSubmit={(payload) =>
            add.mutate(
              { ...payload, lat: addAt.lat, lng: addAt.lng },
              {
                onSuccess: (fresh) => {
                  if (!fresh) return;
                  // Свіжий рядок тримаємо окремо: invalidate ще не встиг
                  // повернути список, а модалка має відкритись одразу.
                  setJustAdded(fresh);
                  setViewPinId(fresh.id);
                  setFocusedId(fresh.id);
                },
              },
            )
          }
        />
      )}
      {viewPin && (
        <PinModal
          pin={viewPin}
          onClose={() => { setViewPinId(null); setFocusedId(null); }}
          onSave={(patch) => update.mutate({ id: viewPin.id, patch })}
          onDelete={async () => {
            if (await confirmDialog('Видалити це місце?')) {
              remove.mutate(viewPin.id);
              setViewPinId(null);
              setFocusedId(null);
            }
          }}
        />
      )}
      {historyOpen && <LocationHistoryModal onClose={() => setHistoryOpen(false)} />}
    </section>
  );
}
