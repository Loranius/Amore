// Плитка знімка — спільна для всіх трьох виглядів.
// Позначка джерела й крапка «є підпис» живуть тут, щоб три оглядові
// екрани не малювали їх кожен по-своєму.
import type { ReactNode } from 'react';
import type { IconProps } from '@/components/icons/iconBase';
import { MapPinIcon } from '@/components/icons/MapIcon';
import { TargetIcon } from '@/components/icons/PlanIcon';
import { CalendarIcon, GiftIcon } from '@/components/icons/UiIcon';
import type { MemoryRow, MemorySource } from '@/types';

// `label` — повна назва для підказки й повного екрана; `short` — для
// чипів фільтра, де довгий підпис виїжджає за екран телефона.
//
// `Icon` — сам компонент, а не готовий вузол: позначка джерела стоїть і
// на плитці розміром з ніготь, і в підписі під повним екраном, тож
// розмір мусить задавати місце виклику. Раніше тут були геометричні
// гліфи ◎ ✦ ◆ ❖ — на плитці 11px вони всі читались однаковою цяткою.
export const SOURCE_META: Record<
  MemorySource,
  { Icon: (props: IconProps) => ReactNode; label: string; short: string; cls: string }
> = {
  place: { Icon: MapPinIcon, label: 'Відвідане місце', short: 'Місця', cls: 'mem-src--place' },
  wish: { Icon: GiftIcon, label: 'Виконане бажання', short: 'Бажання', cls: 'mem-src--wish' },
  goal: { Icon: TargetIcon, label: 'Спільна ціль', short: 'Цілі', cls: 'mem-src--goal' },
  event: { Icon: CalendarIcon, label: 'Подія', short: 'Події', cls: 'mem-src--event' },
};

interface MemoryPhotoProps {
  photo: MemoryRow;
  sources: MemorySource[];
  /** Перший кадр дня — на два стовпці й два рядки. */
  featured?: boolean;
  onOpen: (photo: MemoryRow) => void;
}

export function MemoryPhoto({ photo, sources, featured, onOpen }: MemoryPhotoProps) {
  const source = sources[0];
  const meta = source ? SOURCE_META[source] : null;
  return (
    <button
      type="button"
      className={`mem-photo${featured ? ' mem-photo--big' : ''}`}
      onClick={() => onOpen(photo)}
      aria-label={photo.caption ?? 'Відкрити фото'}
    >
      <img src={photo.photo_url} alt="" loading="lazy" decoding="async" draggable={false} />
      {meta && (
        <span className={`mem-src ${meta.cls}`} title={meta.label} aria-hidden="true">
          <meta.Icon size={12} />
        </span>
      )}
      {photo.caption && <span className="mem-capdot" aria-hidden="true" />}
    </button>
  );
}

/**
 * Мозаїка знімків: перший кадр дня — великий, решта — квадрати.
 *
 * Три колонки, а не шість, і великий кадр рівно 2×2. Це єдина розкладка,
 * яка ЗАМОЩУЄТЬСЯ без дірок при будь-якій кількості фото: великий займає
 * два стовпці й два рядки, у третій стовпець стають два квадрати — і далі
 * йдуть рівні трійки.
 *
 * Перша спроба (шість колонок, ритм 4-2-2-3 і різні пропорції) виглядала
 * цікавіше на папері, але рендер показав дірки: сусіди в рядку мали різну
 * висоту, і сума прольотів не сходилась до шести. Порядок знімків
 * хронологічний, тож `grid-auto-flow: dense` тут не рятує — він переставив
 * би кадри місцями.
 */
export function MemoryMosaic({
  photos,
  links,
  onOpen,
}: {
  photos: readonly MemoryRow[];
  links: Record<number, MemorySource[]>;
  onOpen: (photo: MemoryRow) => void;
}) {
  // Великий кадр має сенс лише коли за ним є чим заповнити третій
  // стовпець; на одному-двох знімках він лишив би порожнечу збоку.
  const feature = photos.length >= 3;
  return (
    <div className="mem-mosaic">
      {photos.map((photo, i) => (
        <MemoryPhoto
          key={photo.id}
          photo={photo}
          sources={links[photo.id] ?? []}
          featured={feature && i === 0}
          onOpen={onOpen}
        />
      ))}
    </div>
  );
}
