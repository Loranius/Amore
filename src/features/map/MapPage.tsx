// ============================================================
// MapPage — карта спогадів і планів (порт map.js UI/оркестрація)
// ------------------------------------------------------------
// mapbox-gl керується імперативно через refs; піни/маркери синкаються
// в ефектах під стан React. Клік по карті → додати місце. Клік по
// картці: 1-й — політ, 2-й — модалка (focusedPinId).
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
import { useMapPins, useMapPinMutations, useCityBackfill } from './useMapPins';
import { useUserLocations, useCheckin } from './useLocations';
import { CatFilterBar, PinCards } from './MapPanels';
import { PinModal } from './PinModal';
import { AddPinModal } from './AddPinModal';
import { LocationHistoryModal } from './LocationHistoryModal';
import type { MapPinRow, PinCategory, MapboxFeature } from '@/types';

export function MapPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const pinMarkers = useRef<mapboxgl.Marker[]>([]);
  const locMarkers = useRef<mapboxgl.Marker[]>([]);

  const { data: pins = [] } = useMapPins();
  const { data: users = [] } = useUsers();
  const { data: locations = [] } = useUserLocations();
  const { add, update, remove } = useMapPinMutations();
  const checkin = useCheckin();
  useCityBackfill(pins);

  const [filter, setFilter] = useState<'all' | PinCategory>('all');
  const [search, setSearch] = useState('');
  const [geoResults, setGeoResults] = useState<MapboxFeature[]>([]);
  const [addAt, setAddAt] = useState<{ lat: number; lng: number; title?: string } | null>(null);
  const [viewPin, setViewPin] = useState<MapPinRow | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const focusedPinId = useRef<number | null>(null);

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
    map.on('click', (e) => setAddAt({ lat: e.lngLat.lat, lng: e.lngLat.lng }));
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // ── Синк маркерів пінів ────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    pinMarkers.current.forEach((m) => m.remove());
    pinMarkers.current = [];

    for (const pin of visiblePins) {
      const cat = CATEGORIES[pin.category];
      const elMarker = document.createElement('div');
      elMarker.className = 'map-marker';
      elMarker.style.background = cat.color;
      elMarker.textContent = cat.emoji;
      elMarker.addEventListener('click', (e) => {
        e.stopPropagation();
        focusedPinId.current = null;
        setViewPin(pin);
      });
      const marker = new mapboxgl.Marker(elMarker).setLngLat([pin.lng, pin.lat]).addTo(map);
      pinMarkers.current.push(marker);
    }

    // Автозум під наявні піни.
    if (visiblePins.length === 1) {
      const p = visiblePins[0]!;
      map.flyTo({ center: [p.lng, p.lat], zoom: 12 });
    } else if (visiblePins.length > 1) {
      const bounds = new mapboxgl.LngLatBounds();
      visiblePins.forEach((p) => bounds.extend([p.lng, p.lat]));
      map.fitBounds(bounds, { padding: 60, maxZoom: 13, duration: 600 });
    }
  }, [visiblePins]);

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
    if (focusedPinId.current === pin.id) {
      focusedPinId.current = null;
      setViewPin(pin);
    } else {
      focusedPinId.current = pin.id;
      flyTo(pin.lng, pin.lat);
    }
  };

  const pickGeoResult = (f: MapboxFeature) => {
    const [lng, lat] = f.center;
    setGeoResults([]);
    setSearch('');
    flyTo(lng, lat, 14);
    setAddAt({ lat, lng, title: f.text ?? f.place_name ?? '' });
  };

  return (
    <section className="map">
      <div className="map-search-wrap">
        <input
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

      <div ref={containerRef} className="map-container" />

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
        focusedId={focusedPinId.current}
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
              { onSuccess: (fresh) => fresh && setViewPin(fresh) },
            )
          }
        />
      )}
      {viewPin && (
        <PinModal
          pin={viewPin}
          onClose={() => setViewPin(null)}
          onSave={(patch) => update.mutate({ id: viewPin.id, patch })}
          onDelete={() => {
            if (confirm('Видалити це місце?')) {
              remove.mutate(viewPin.id);
              setViewPin(null);
            }
          }}
        />
      )}
      {historyOpen && <LocationHistoryModal onClose={() => setHistoryOpen(false)} />}
    </section>
  );
}
