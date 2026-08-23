// ============================================================
// Повноекранна карта спогадів.
// ------------------------------------------------------------
// Замінює окремий модуль «Наша карта»: місця більше не живуть власним
// розділом, вони — вимір того самого архіву. Мітка або веде у спогад,
// або пропонує його створити.
//
// **Чому MapLibre, а не Google.** Google Maps без ключа з увімкненим
// білінгом малює водяний знак «For development purposes only» поверх
// усього — це не «трохи гірше», це непридатно. MapLibre — відкритий форк
// того самого Mapbox GL, тож жести, маркери й API майже ті самі, а тайли
// беруться з OpenFreeMap без жодного ключа. Рішення власника, ADR-0039.
//
// **Маркери — HTML, а не шар GeoJSON.** Шар швидший і вміє кластеризацію
// з коробки, але вміє лише кола та іконки; мітка з фотографією місця в
// ньому неможлива. Двадцять сім HTML-маркерів браузер тримає без зусиль,
// а фото в мітці — це те, заради чого карту й відкривають.
// ============================================================
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Map as MapLibreMap, Marker, setWorkerUrl, type MapMouseEvent } from 'maplibre-gl';
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import 'maplibre-gl/dist/maplibre-gl.css';
import { thumbUrl } from '@/lib/imageCdn';
import { reverseGeocode } from '@/lib/geo';
import { CloseIcon } from '@/components/icons/UiIcon';
import { CrosshairIcon } from '@/components/icons/MapIcon';
import {
  FIT_PADDING_PX,
  MY_LOCATION_ZOOM,
  openingView,
  type GeoPoint,
} from './mapView';
import { useImmersiveRoute } from '@/features/world/useImmersiveRoute';
import { placeLabel, type PlaceCandidate } from './momentPlace';
import type { Moment, MomentPlace } from './useMoments';

/*
 * Адреса воркера — вручну, і без неї карта не працює НІДЕ.
 *
 * MapLibre шукає свій воркер так: `new URL('./maplibre-gl-worker.mjs',
 * import.meta.url)`. Це рядок, який складається під час виконання, тож
 * жоден збирач його не бачить — файл не потрапляє ні в `dist`, ні в
 * оптимізовані залежності дев-сервера. Наслідок вимірюваний: запит на
 * воркер повертає 404, воркер помирає одразу після створення, і карта
 * назавжди лишається з написом «Завантажую карту…».
 *
 * Найпідступніше тут те, що помилки немає ЖОДНОЇ: стиль, TileJSON і
 * спрайти приїжджають по 200, `map.on('error')` мовчить, контейнер має
 * правильний розмір 412×915. Просто векторні тайли вантажить воркер, а
 * його вже немає — і жодного запиту на `.pbf` не йде.
 *
 * `?worker&url` змушує збирач зібрати воркер окремим модулем (разом із
 * його власним імпортом `maplibre-gl-shared.mjs`) і віддати адресу. Разом
 * із `worker: { format: 'es' }` у `vite.config.ts` — саме те, чого чекає
 * `new Worker(url, { type: 'module' })` всередині MapLibre.
 */
setWorkerUrl(maplibreWorkerUrl);

/**
 * Стиль карти. Темний — щоб фотографії на мітках лишались найяскравішим,
 * що є на екрані, і щоб карта не била в очі поруч із рештою порталу.
 */
const STYLE_URL = 'https://tiles.openfreemap.org/styles/dark';

/** Ширина фото в мітці, у CSS-пікселях. Сама мітка — 44 px. */
const PIN_PHOTO_WIDTH = 48;

export interface MapPin extends GeoPoint {
  id: number;
  title: string;
  city: string | null;
  country: string | null;
  photoUrl: string | null;
  /** Спогад, прив'язаний до цього місця, якщо він є. */
  moment: Moment | null;
}

interface MemoriesMapProps {
  places: readonly MomentPlace[];
  moments: readonly Moment[];
  onClose: () => void;
  /** Пара обрала точку на карті й хоче зберегти тут спогад. */
  onCreate: (place: PlaceCandidate) => void;
  /** Пара торкнулась мітки, за якою вже стоїть спогад. */
  onOpenMoment: (momentId: number) => void;
}

/** Мітки карти, збагачені спогадом, якщо той на них посилається. */
export function buildPins(
  places: readonly MomentPlace[],
  moments: readonly Moment[],
): MapPin[] {
  const byPin = new Map<number, Moment>();
  for (const moment of moments) {
    if (moment.place_pin_id !== null && !byPin.has(moment.place_pin_id)) {
      byPin.set(moment.place_pin_id, moment);
    }
  }
  return places
    .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng))
    .map((p) => {
      const moment = byPin.get(p.id) ?? null;
      return {
        id: p.id,
        lat: p.lat,
        lng: p.lng,
        title: p.title ?? '',
        city: p.city,
        country: p.country,
        // Обкладинка спогаду важливіша за фото мітки: вона свіжіша й це те,
        // що пара впізнає.
        photoUrl: moment?.cover?.photo_url ?? null,
        moment,
      };
    });
}

/** Точка, яку пара щойно поставила пальцем і ще не зберегла. */
interface DraftPoint {
  lat: number;
  lng: number;
  /** Підпис із зворотного геокоду; поки не приїхав — `null`. */
  place: PlaceCandidate | null;
}

export function MemoriesMap({
  places,
  moments,
  onClose,
  onCreate,
  onOpenMoment,
}: MemoriesMapProps) {
  const holder = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibreMap | null>(null);
  const markers = useRef<Marker[]>([]);
  const draftMarker = useRef<Marker | null>(null);

  /*
   * Карта — занурення, як і «Наш шлях».
   *
   * Полотно світу з кристалом лишається під картою живим: воно ніколи не
   * розбирається (ADR-0020), і при відкритті карти телефон малював ДВІ
   * сцени, з яких одна повністю схована. Той самий гак, що вже гасить
   * кадри на зануреному маршруті, гасить їх і тут — контекст WebGL
   * лишається прогрітим, а кадрів у невидиму сцену не йде.
   *
   * Живий екран показав ціну цього на слабкому GPU буквально: без паузи
   * головний потік не відповідав жодного разу за 50 секунд і карта не
   * встигала попросити НІ ОДНОГО тайла.
   */
  useImmersiveRoute();

  const [ready, setReady] = useState(false);
  const [draft, setDraft] = useState<DraftPoint | null>(null);
  const [openPin, setOpenPin] = useState<MapPin | null>(null);
  const [locating, setLocating] = useState(false);

  const pins = buildPins(places, moments);

  /*
   * Карта створюється РІВНО ОДИН раз.
   *
   * Список залежностей навмисно порожній: перестворення карти означало б
   * новий WebGL-контекст, повторне завантаження стилю й усіх тайлів, а
   * головне — стрибок вигляду назад до початкового. Мітки оновлює окремий
   * ефект нижче.
   */
  useEffect(() => {
    if (!holder.current) return;
    const view = openingView(pins);

    const instance = new MapLibreMap({
      container: holder.current,
      style: STYLE_URL,
      center: view.kind === 'point' ? [view.lng, view.lat] : [0, 0],
      zoom: view.kind === 'point' ? view.zoom : 2,
      // Нахил і поворот вимкнені: карта тут — це план місцевості, а не
      // краєвид. Двопальцеве обертання лише збивало б прокрутку списку.
      pitchWithRotate: false,
      dragRotate: false,
      attributionControl: { compact: true },
    });
    map.current = instance;

    if (view.kind === 'fit') {
      instance.fitBounds(view.bounds, { padding: FIT_PADDING_PX, animate: false });
    }

    instance.on('load', () => setReady(true));

    // Тап по вільному місцю ставить точку. Кліки по мітках сюди не
    // доходять: маркер — окремий DOM-вузол, і його обробник зупиняє подію.
    instance.on('click', (event: MapMouseEvent) => {
      const { lng, lat } = event.lngLat;
      setOpenPin(null);
      setDraft({ lat, lng, place: null });
      void reverseGeocode(lat, lng).then((geo) => {
        setDraft((current) => {
          // Поки їхав геокод, пара могла поставити іншу точку або закрити
          // аркуш. Мовчки перезаписати чужу точку — гірше, ніж не підписати.
          if (!current || current.lat !== lat || current.lng !== lng) return current;
          return {
            ...current,
            place: {
              title: geo.address || geo.city || 'Місце на карті',
              city: geo.city || null,
              country: geo.country || null,
              lat,
              lng,
            },
          };
        });
      });
    });

    return () => {
      markers.current.forEach((m) => m.remove());
      markers.current = [];
      draftMarker.current?.remove();
      draftMarker.current = null;
      instance.remove();
      map.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Мітки перемальовуються, коли змінився їхній склад. */
  useEffect(() => {
    const instance = map.current;
    if (!instance || !ready) return;

    markers.current.forEach((m) => m.remove());
    markers.current = pins.map((pin) => {
      const el = document.createElement('button');
      el.type = 'button';
      el.className = `mm-map-pin${pin.moment ? ' is-moment' : ''}`;
      el.setAttribute('aria-label', pin.title || 'Місце');

      if (pin.photoUrl) {
        const img = document.createElement('img');
        img.src = thumbUrl(pin.photoUrl, PIN_PHOTO_WIDTH);
        img.alt = '';
        img.loading = 'lazy';
        img.decoding = 'async';
        el.appendChild(img);
      } else {
        el.classList.add('is-blank');
      }

      el.addEventListener('click', (event) => {
        // Без цього той самий дотик відразу поставив би чернеткову точку
        // під міткою: подія дійшла б до полотна карти.
        event.stopPropagation();
        setDraft(null);
        setOpenPin(pin);
      });

      return new Marker({ element: el, anchor: 'bottom' })
        .setLngLat([pin.lng, pin.lat])
        .addTo(instance);
    });
    // Склад міток описує рядок нижче: id усіх місць плюс те, чи є спогад.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, pins.map((p) => `${p.id}:${p.moment ? 1 : 0}`).join(',')]);

  /* Чернеткова точка — окремий маркер, який живе поза списком міток. */
  useEffect(() => {
    const instance = map.current;
    if (!instance) return;
    draftMarker.current?.remove();
    draftMarker.current = null;
    if (!draft) return;

    const el = document.createElement('div');
    el.className = 'mm-map-draft';
    draftMarker.current = new Marker({ element: el, anchor: 'bottom' })
      .setLngLat([draft.lng, draft.lat])
      .addTo(instance);
  }, [draft]);

  /*
   * Геолокація при відкритті — лише якщо дозвіл УЖЕ дано.
   *
   * `getCurrentPosition` сам показує системний запит дозволу, а карта, яка
   * питає про місцезнаходження одразу після відкриття, — найшвидший спосіб
   * дістати «Заборонити» назавжди. Тому спершу питаємо браузер, чи дозвіл
   * уже є, і тільки тоді летимо. Явний запит лишається за кнопкою.
   */
  useEffect(() => {
    if (!ready || typeof navigator === 'undefined') return;
    if (!navigator.permissions?.query) return;
    let alive = true;
    void navigator.permissions
      .query({ name: 'geolocation' as PermissionName })
      .then((status) => {
        if (!alive || status.state !== 'granted') return;
        flyToMe();
      })
      .catch(() => undefined);
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  function flyToMe() {
    const instance = map.current;
    if (!instance || typeof navigator === 'undefined' || !navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false);
        instance.flyTo({
          center: [position.coords.longitude, position.coords.latitude],
          zoom: MY_LOCATION_ZOOM,
          duration: 900,
        });
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60_000 },
    );
  }

  if (typeof document === 'undefined') return null;

  // Портал у `document.body` — та сама причина, що в композера й повного
  // екрана фото: сторінка модуля лежить у `.page-fade`, який на час
  // анімації створює власний stacking context.
  return createPortal(
    <div className="mm-map" role="dialog" aria-modal="true" aria-label="Карта спогадів">
      <div className="mm-map-canvas" ref={holder} />

      <div className="mm-map-bar">
        <button type="button" className="mm-round" onClick={onClose} aria-label="Закрити карту">
          <CloseIcon size={22} />
        </button>
        <button
          type="button"
          className="mm-round"
          onClick={flyToMe}
          aria-label="Показати, де я"
          aria-busy={locating}
        >
          <CrosshairIcon size={22} />
        </button>
      </div>

      {!ready && <div className="mm-map-loading">Завантажую карту…</div>}

      {draft && (
        <div className="mm-map-sheet">
          <b>{draft.place ? placeLabel(draft.place) : 'Визначаю місце…'}</b>
          <p>Зберегти тут спогад?</p>
          <div className="modal-actions mm-map-sheet-actions">
            <button type="button" className="btn btn-ghost" onClick={() => setDraft(null)}>
              Скасувати
            </button>
            <button
              type="button"
              className="btn"
              disabled={!draft.place}
              onClick={() => { if (draft.place) onCreate(draft.place); }}
            >
              Створити спогад
            </button>
          </div>
        </div>
      )}

      {openPin && (
        <div className="mm-map-sheet">
          {openPin.photoUrl && (
            <img
              className="mm-map-sheet-photo"
              src={thumbUrl(openPin.photoUrl, 360)}
              alt=""
              decoding="async"
            />
          )}
          <b>{placeLabel(openPin) || openPin.title}</b>
          <p>
            {openPin.moment
              ? openPin.moment.title.trim() || 'Тут уже є спогад'
              : 'Місце без спогаду'}
          </p>
          <div className="modal-actions mm-map-sheet-actions">
            <button type="button" className="btn btn-ghost" onClick={() => setOpenPin(null)}>
              Закрити
            </button>
            {openPin.moment ? (
              <button
                type="button"
                className="btn"
                onClick={() => onOpenMoment(openPin.moment!.id)}
              >
                Відкрити спогад
              </button>
            ) : (
              <button
                type="button"
                className="btn"
                onClick={() => onCreate({
                  title: openPin.title,
                  city: openPin.city,
                  country: openPin.country,
                  lat: openPin.lat,
                  lng: openPin.lng,
                })}
              >
                Створити спогад
              </button>
            )}
          </div>
        </div>
      )}
    </div>,
    document.body,
  );
}
