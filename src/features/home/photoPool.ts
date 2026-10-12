// ============================================================
// Пул фото для грані «Фотографії» — з чого він складається.
// ------------------------------------------------------------
// Два джерела (ADR-0248, вказівка власника 2026-10-12: «фото спогадів
// живлять кристал»):
//
//   • ФОТО СПОГАДІВ — рядки `memories`, прив'язані до спогаду. Дата —
//     `memory_date`, тобто день, коли це сталось, а не день завантаження:
//     кристал росте з історії пари, а не з того, коли її оцифрували.
//   • КОРІНЬ БАКЕТА `family_photos` — полароїди, кинуті туди до ADR-0248.
//     Полароїда більше немає, але те, що він уже поклав, лишається в пулі:
//     жоден об'єкт не сміє поменшати (PRODUCT.md, принцип 8), а прибрати
//     ці фото означало б забрати в кристала масу, яку він уже виростив.
//
// Знімок без спогаду (`moment_id === null`) у пул не йде: він ще не
// складений у річ, яку пара назвала, і архів «Спогадів» його теж не
// показує. Інакше кристал ріс би з того, чого пара не бачить.
// ============================================================

/** Фото з ДАТОЮ. Без дати фото — недатований агрегат, і рушій не має права
 *  пускати його у форму (див. `artifact/species/crystalConstraints.ts`). */
export interface PhotoAsset {
  url: string;
  /** ISO-дата (YYYY-MM-DD); null, якщо джерело її не дало. */
  date: string | null;
}

/** Файл кореня `family_photos`, як його віддає Storage. */
export interface StoragePhotoFile {
  url: string;
  created_at: string | null;
}

/** Рядок `memories`, рівно ті поля, які пул читає. */
export interface MemoryPhotoRow {
  photo_url: string;
  memory_date: string;
  moment_id: number | null;
}

/**
 * Зводить обидва джерела в один пул.
 *
 * Порядок результату — за датою зростаюче, а в межах дня — спершу корінь
 * бакета, потім спогади, кожне джерело у власному порядку. Це не косметика:
 * `useCrystalDNA` нумерує фото саме в такому порядку, і детермінований
 * порядок дає детерміновані ключі.
 */
export function mergePhotoPool(
  storage: readonly StoragePhotoFile[],
  memories: readonly MemoryPhotoRow[],
): PhotoAsset[] {
  const fromStorage = storage.map((f, i) => ({
    url: f.url,
    date: f.created_at ? f.created_at.slice(0, 10) : null,
    source: 0,
    i,
  }));
  const fromMemories = memories
    .filter((m) => m.moment_id !== null)
    .map((m, i) => ({ url: m.photo_url, date: m.memory_date.slice(0, 10), source: 1, i }));

  return [...fromStorage, ...fromMemories]
    .sort((a, b) => {
      // Недатовані — у кінець: їх однаково відкидає рушій, а лічильник
      // фото все одно їх бачить.
      if (a.date !== b.date) {
        if (a.date === null) return 1;
        if (b.date === null) return -1;
        return a.date < b.date ? -1 : 1;
      }
      return a.source - b.source || a.i - b.i;
    })
    .map(({ url, date }) => ({ url, date }));
}
