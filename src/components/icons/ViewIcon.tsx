// ============================================================
// Значки перемикача вигляду.
// ------------------------------------------------------------
// Три модулі — «Спогади», карта, календар — показують той самий
// перемикач, і досі всі три брали гліфи з одного невеликого запасу
// (☰ ▤ ▦). Через це «Альбом» і «Міста» виглядали однаково, а «Мозаїка»
// і «Місяць» — теж однаково: гліфів просто не вистачало на дев'ять
// різних виглядів.
//
// Тут у кожного вигляду власна форма, яка каже, що саме побачиш:
// сторінки, плитки, стовпчики року, складена карта, шкала часу, будинки.
// ============================================================
import { iconAttrs, type IconProps } from './iconBase';

/** Розгорнутий альбом — сторінки на папері. */
export function AlbumIcon({ size = 24, className = '' }: IconProps) {
  return (
    <svg {...iconAttrs(size, className)}>
      <path d="M12 7.2C10.4 5.8 8.3 5.1 5.8 5.1H3.4v12.6h2.4c2.5 0 4.6.7 6.2 2.1 1.6-1.4 3.7-2.1 6.2-2.1h2.4V5.1h-2.4c-2.5 0-4.6.7-6.2 2.1Z" />
      <path d="M12 7.2v12.6" />
    </svg>
  );
}

/** Плитки — мозаїка знімків. */
export function MosaicIcon({ size = 24, className = '' }: IconProps) {
  return (
    <svg {...iconAttrs(size, className)}>
      <rect x="3.6" y="3.6" width="8.2" height="8.2" rx="1.4" />
      <rect x="14.2" y="3.6" width="6.2" height="8.2" rx="1.4" />
      <rect x="3.6" y="14.2" width="6.2" height="6.2" rx="1.4" />
      <rect x="12.2" y="14.2" width="8.2" height="6.2" rx="1.4" />
    </svg>
  );
}

/** Стовпчики різної висоти — рік, де густо й де пусто. */
export function YearIcon({ size = 24, className = '' }: IconProps) {
  return (
    <svg {...iconAttrs(size, className)}>
      <path d="M3.4 20.2h17.2" />
      {/* Стовпчики тягнуться майже на всю висоту рамки: у першій версії
          вони жили в нижніх двох третинах, і поруч із календарем значок
          «Рік» читався просто меншим. */}
      <path d="M6.2 20.2v-6.6M10.6 20.2V4.6M15 20.2v-10M19.4 20.2V7.8" />
    </svg>
  );
}

/** Складена карта — «де це на світі». */
export function FoldedMapIcon({ size = 24, className = '' }: IconProps) {
  return (
    <svg {...iconAttrs(size, className)}>
      <path d="M9 4.4 3.6 6.6v13l5.4-2.2 6 2.2 5.4-2.2v-13L15 6.6 9 4.4Z" />
      <path d="M9 4.4v13.2M15 6.6v13" />
    </svg>
  );
}

/** Шкала часу — хронологія відвідувань. */
export function TimelineIcon({ size = 24, className = '' }: IconProps) {
  return (
    <svg {...iconAttrs(size, className)}>
      <path d="M5.6 4.4v15.2" />
      <path d="M9.4 7.4h10.2M9.4 12h7M9.4 16.6h10.2" />
      <circle cx="5.6" cy="7.4" r="1.5" />
      <circle cx="5.6" cy="16.6" r="1.5" />
    </svg>
  );
}

/** Будинки — список міст. */
export function CityIcon({ size = 24, className = '' }: IconProps) {
  return (
    <svg {...iconAttrs(size, className)}>
      <path d="M3.2 20.4h17.6" />
      <path d="M4.8 20.4V9.4l6.2-3.6v14.6" />
      <path d="M11 12.2h8.2v8.2" />
      <path d="M7.6 11.6v.01M7.6 15.2v.01M14.4 15.6v.01M16.8 15.6v.01" />
    </svg>
  );
}
