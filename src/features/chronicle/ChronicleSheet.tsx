// ============================================================
// ChronicleSheet — «Як ріс наш …» (ADR-0238)
// ------------------------------------------------------------
// Шторка знизу, над доком; об'єкт лишається видимим над нею (сцена
// піднімає кадр). Три частини, від загального до окремого:
//
//   1. Час: повзунок по місяцях від початку стосунків до сьогодні — сцена
//      малює той самий об'єкт на обрану дату при сьогоднішньому кадрі.
//   2. Модулі: скільки записів кожного модуля виростило об'єкт на цю дату й
//      що саме модуль ростить у цьому виді.
//   3. Записи модуля: дотик веде камеру до частини, яку запис виростив.
//
// Нічого не вигадується: запис без назви показано датою й видом.
// ============================================================
import { useEffect, useMemo, useRef, useState } from 'react';
import { ModalClose } from '@/components/ui/ModalClose';
import { buildCrystalV2Model, type ActivityKind } from '@/engine/species/crystalV2/model';
import { chronicleDateAt, chronicleMonths, chronicleTraces, type ChronicleTrace } from '@/engine/species/grammar/chronicle';
import { buildTreeV2Model } from '@/engine/species/treeV2/model';
import { buildVolcanoModel } from '@/engine/species/volcano/model';
import { useArtifactForms } from '@/features/world/artifactForms';
import { plural } from '@/lib/plural';
import { MODULE_TITLE, MODULE_TRACE, chronicleAnchor, type ChronicleSubject } from './anchors';
import { closeChronicle, focusChronicle, setChronicleAsOf, useChronicle } from './chronicleStore';
import { titleKey, useChronicleTitles } from './useChronicleTitles';
import './chronicle.css';

const ORDER: readonly ActivityKind[] = ['wishes', 'plans', 'memories', 'milestones', 'events', 'places', 'daysOff', 'media'];

const HEADING: Record<'crystal' | 'tree' | 'reef', string> = {
  crystal: 'Як ріс ваш кристал',
  tree: 'Як росло ваше дерево',
  reef: 'Як ріс ваш вулкан',
};

const MONTHS = ['січень', 'лютий', 'березень', 'квітень', 'травень', 'червень', 'липень', 'серпень', 'вересень', 'жовтень', 'листопад', 'грудень'];
const MONTHS_OF = ['січня', 'лютого', 'березня', 'квітня', 'травня', 'червня', 'липня', 'серпня', 'вересня', 'жовтня', 'листопада', 'грудня'];

function monthLabel(date: string): string {
  return `${MONTHS[Number(date.slice(5, 7)) - 1]} ${date.slice(0, 4)}`;
}

function dayLabel(date: string): string {
  return `${Number(date.slice(8, 10))} ${MONTHS_OF[Number(date.slice(5, 7)) - 1]} ${date.slice(0, 4)}`;
}

function togetherLabel(months: number): string {
  if (months <= 0) return 'самий початок';
  const years = Math.floor(months / 12);
  const rest = months % 12;
  const parts: string[] = [];
  if (years > 0) parts.push(`${years} ${plural(years, 'рік', 'роки', 'років')}`);
  if (rest > 0) parts.push(`${rest} міс.`);
  return `${parts.join(' ')} разом`;
}

const FALLBACK: Record<ActivityKind, string> = {
  memories: 'Спогад',
  plans: 'Виконаний план',
  wishes: 'Виконане бажання',
  milestones: 'Віха',
  events: 'Подія',
  places: 'Місце на мапі',
  media: 'Переглянуте',
  daysOff: 'Спільний вихідний',
};

export function ChronicleSheet() {
  const chronicle = useChronicle();
  // Шторка й її запити живуть лише відкритими: закрита хроніка не тягне
  // з бази ні планів, ні архіву бажань.
  if (!chronicle.open || !chronicle.subject) return null;
  return <ChronicleBody />;
}

function ChronicleBody() {
  const chronicle = useChronicle();
  const subject = chronicle.subject!;
  const species = subject.species;
  const snapshot = subject.snapshot;
  const forms = useArtifactForms();
  const today = snapshot.asOf.slice(0, 10);
  const total = chronicleMonths(snapshot.startDate, today);
  const shownDate = chronicle.asOf ?? today;

  // Повзунок рухається від пальця одразу, а сцена перебудовується не
  // частіше за кадр: місяць — одна перебудова, а не десяток. Дата пишеться
  // лише тоді, коли палець її змінив, — інакше перший кадр шторки скидав би
  // щойно обраний запис.
  const [months, setMonths] = useState(() => (chronicle.asOf ? chronicleMonths(snapshot.startDate, chronicle.asOf) : total));
  const moved = useRef(false);
  const frame = useRef<number | null>(null);
  useEffect(() => {
    if (!moved.current) return undefined;
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      frame.current = null;
      setChronicleAsOf(months >= total ? null : chronicleDateAt(snapshot.startDate, today, months));
    });
    return () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    };
  }, [months, total, snapshot.startDate, today]);
  const moveTo = (next: number) => {
    moved.current = true;
    setMonths(next);
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') closeChronicle(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const traces = useMemo(() => chronicleTraces(snapshot), [snapshot]);
  const visible = useMemo(() => traces.filter((t) => t.date <= shownDate), [traces, shownDate]);
  const counts = useMemo(() => {
    const out = new Map<ActivityKind, ChronicleTrace[]>();
    for (const trace of visible) out.set(trace.kind, [...(out.get(trace.kind) ?? []), trace]);
    return out;
  }, [visible]);

  // Модель на показану дату: з неї опорні точки, тож камера веде туди, де
  // частина стоїть САМЕ на цю дату.
  const shownSubject = useMemo<ChronicleSubject>(() => {
    const at = { ...snapshot, asOf: shownDate };
    if (species === 'crystal') return { species, model: buildCrystalV2Model(at) };
    if (species === 'tree') return { species, model: buildTreeV2Model(at), form: forms.tree };
    return { species: 'reef', model: buildVolcanoModel(at) };
  }, [snapshot, shownDate, species, forms.tree]);

  const titles = useChronicleTitles([snapshot.partners?.red, snapshot.partners?.blue]);

  // Модуль, якого на показану дату ще не було, не лишає підпису без записів.
  const kind = chronicle.kind && (counts.get(chronicle.kind)?.length ?? 0) > 0 ? chronicle.kind : null;
  const list = kind ? [...(counts.get(kind) ?? [])].reverse() : [];
  const [limit, setLimit] = useState(24);
  useEffect(() => setLimit(24), [kind]);

  const focus = (trace: ChronicleTrace) => {
    focusChronicle({ key: `${trace.kind}:${trace.id}`, anchor: chronicleAnchor(shownSubject, trace) }, trace.kind);
  };
  const chooseKind = (next: ActivityKind) => {
    if (next === kind) {
      focusChronicle(null, null);
      return;
    }
    const latest = counts.get(next)?.at(-1);
    if (latest) focusChronicle({ key: `${next}:all`, anchor: chronicleAnchor(shownSubject, latest) }, next);
  };

  const note = chronicle.focus?.anchor.note;

  return (
    <section className="chronicle" role="dialog" aria-modal="false" aria-labelledby="chronicle-title">
      <header className="chronicle-head">
        <div>
          <h2 className="chronicle-title" id="chronicle-title">{HEADING[species]}</h2>
          <p className="chronicle-when">
            {monthLabel(shownDate)} · {togetherLabel(months)}
          </p>
        </div>
        <ModalClose onClose={closeChronicle} label="Закрити хроніку" />
      </header>

      <div className="chronicle-time">
        <button type="button" className="chronicle-edge" onClick={() => moveTo(0)} aria-pressed={months === 0}>Початок</button>
        <input
          className="chronicle-range"
          type="range"
          min={0}
          max={Math.max(1, total)}
          step={1}
          value={months}
          aria-label="Дата, на яку показати об'єкт"
          aria-valuetext={`${monthLabel(shownDate)}, ${togetherLabel(months)}`}
          onChange={(event) => moveTo(Number(event.target.value))}
        />
        <button type="button" className="chronicle-edge" onClick={() => moveTo(total)} aria-pressed={months >= total}>Сьогодні</button>
      </div>

      <div className="chronicle-kinds" role="group" aria-label="Що виростило">
        {ORDER.filter((k) => (counts.get(k)?.length ?? 0) > 0).map((k) => (
          <button
            key={k}
            type="button"
            className={`chronicle-kind${kind === k ? ' is-on' : ''}`}
            aria-pressed={kind === k}
            onClick={() => chooseKind(k)}
          >
            {MODULE_TITLE[k]} <span className="chronicle-count">{counts.get(k)!.length}</span>
          </button>
        ))}
        {visible.length === 0 && <p className="chronicle-empty">На цю дату ріс лише час — записів ще немає.</p>}
      </div>

      {kind && (
        <div className="chronicle-list-wrap">
          <p className="chronicle-trace">{MODULE_TRACE[species][kind]}</p>
          {note && <p className="chronicle-note">{note}</p>}
          <ul className="chronicle-list">
            {list.slice(0, limit).map((trace) => {
              const key = `${trace.kind}:${trace.id}`;
              const title = titles.get(titleKey(trace.kind, trace.id)) ?? FALLBACK[trace.kind];
              return (
                <li key={key}>
                  <button
                    type="button"
                    className={`chronicle-item${chronicle.focus?.key === key ? ' is-on' : ''}`}
                    onClick={() => focus(trace)}
                  >
                    <span className="chronicle-item-title">{title}</span>
                    <span className="chronicle-item-date">{dayLabel(trace.date)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          {list.length > limit && (
            <button type="button" className="chronicle-more" onClick={() => setLimit((n) => n + 24)}>
              Показати ще {Math.min(24, list.length - limit)}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
