// ============================================================
// Сторінка одного плану — карта з літаючих блоків.
// ------------------------------------------------------------
// Референс власника: окремі блоки висять у темряві, з'єднані світними
// нитками. Головне, що змінює ця форма, — скрол. Аркуш зі згортками показував
// перший екран і ховав решту: щоб побачити бюджет, треба було прокрутити й
// розкрити. Карта показує все одразу, і саме тому в неї немає згорток —
// розкривати нічого, коли блок і так видно.
//
// Плата за це — стелі вмісту (`planMapLayout.ts`). Блок не росте: чотири
// пункти підготовки, два рядки назви, один рядок опису, далі «ще N». Що не
// вміщається в блок, живе в аркуші, який блок відкриває, — тому кожен блок
// клікабельний, і кожен веде в те саме, що було в його згортці.
//
// Нитки — не декор: від назви ростуть дві гілки, ліва про підготовку (дата →
// кроки → пов'язане), права про забезпечення (бюджет → місця → стан).
// ============================================================
import { useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useConfirm } from '@/providers/ConfirmProvider';
import {
  CalendarIcon,
  CheckIcon,
  ChevronLeftIcon,
  GiftIcon,
  PencilIcon,
  PlusIcon,
  TrashIcon,
} from '@/components/icons/UiIcon';
import { CameraIcon, PiggyBankIcon } from '@/components/icons/NavIcon';
import { MapPinIcon } from '@/components/icons/MapIcon';
import { TargetIcon } from '@/components/icons/PlanIcon';
import { daysLabel } from '@/features/calendar/calendarUtils';
import { fmtMoney, useGoals } from '@/features/piggybank/useBudget';
import {
  PLAN_CATEGORIES,
  PLAN_PRECISION_LABEL,
  PLAN_STATUSES,
  PLAN_STATUS_ORDER,
} from './planConstants';
import {
  daysUntilStart,
  hasPreciseDate,
  isClosed,
  planDateLabel,
  readiness,
} from './planModel';
import { planMoney } from './planMoney';
import { linksOfPlan } from './planLinkModel';
import { capped, VISIBLE_TASKS } from './planMapLayout';
import { PlanMapThreads, type ThreadPair } from './PlanMapThreads';
import { usePlanLinks } from './usePlanLinks';
import { usePlanMutations, usePlans, usePlanTasks } from './usePlans';
import { PlanTasks } from './PlanTasks';
import { PlanMoneyBlock } from './PlanMoneyBlock';
import { PlanLinksBlock } from './PlanLinksBlock';
import { PlanMemoriesBlock } from './PlanMemoriesBlock';
import './plans.css';
import './plansDetail.css';
import './plansMemories.css';
import type { PlanDatePrecision, PlanStatus } from '@/types';
import { useWorldVisibleRoute } from '@/features/world/useWorldVisibleRoute';
import { useArtifactWorld } from '@/features/world/artifactWorldContext';
import { useDimmedWorld } from '@/features/world/worldDim';
import '@/features/world/worldDim.css';
import './plansModule.css';
import './plansMap.css';

const PRECISIONS: PlanDatePrecision[] = ['none', 'day', 'range', 'month', 'season', 'year'];
const ACTIVE_STATUSES = PLAN_STATUS_ORDER.filter((key) => !PLAN_STATUSES[key].closed);
const CLOSED_STATUSES = PLAN_STATUS_ORDER.filter((key) => PLAN_STATUSES[key].closed);

/**
 * Порядок ниток — це порядок, у якому план заповнюють.
 *
 * Сусіди в одному ряду навмисно не з'єднані: між ними одинадцять пікселів, і
 * крива в такому вікні виходить закарлючкою (`planMapLayout.ts` її й не
 * малює). Ряд і так тримає їх поруч.
 */
const PLAN_THREADS: readonly ThreadPair[] = [
  ['hero', 'when'], ['hero', 'money'],
  ['when', 'tasks'], ['money', 'place'],
  ['tasks', 'links'], ['place', 'status'],
];

const STATUS_HELP: Record<PlanStatus, string> = {
  idea: 'Зберегли задум, але ще нічого не вирішили',
  planning: 'Уточнюєте дату, місце та формат',
  preparing: 'Виконуєте кроки перед подією',
  ready: 'Усе необхідне вже готово',
  done: 'Цей момент уже став частиною вашої історії',
  postponed: 'Повернетеся до нього пізніше',
  cancelled: 'План більше не актуальний',
};

/** Який аркуш відкритий поверх карти. */
type Sheet = 'date' | 'status' | 'tasks' | 'money' | 'links' | 'memories' | 'edit' | null;

export function PlanDetailsPage() {
  // Сторінка плану — той самий модуль, лише глибше: та сама сцена позаду й та
  // сама палітра. Без сцени блоки світитись не можуть, і карта бере звичайні
  // токени сторінки (`plansMap.css`).
  const { webglSupported } = useArtifactWorld();
  useWorldVisibleRoute();
  useDimmedWorld(webglSupported);

  const { id } = useParams();
  const parsedPlanId = Number(id);
  const planId = Number.isSafeInteger(parsedPlanId) && parsedPlanId > 0 ? parsedPlanId : null;
  const navigate = useNavigate();
  const confirmDialog = useConfirm();
  const { data: plans = [], isPending } = usePlans();
  const { data: tasks = [] } = usePlanTasks(planId);
  const { data: goals = [] } = useGoals();
  const { data: allLinks = [] } = usePlanLinks();
  const { updatePlan, setStatus, removePlan, toggleTask } = usePlanMutations();
  const [sheet, setSheet] = useState<Sheet>(null);
  const [addingMemory, setAddingMemory] = useState(false);
  // Полотно карти тримається станом, а не ref-ом: нитки міряють його в
  // layout-ефекті, а ref до цього моменту ще не прив'язаний (див.
  // `PlanMapThreads`).
  const [mapEl, setMapEl] = useState<HTMLDivElement | null>(null);

  const plan = useMemo(
    () => (planId === null ? null : plans.find((item) => item.id === planId) ?? null),
    [plans, planId],
  );

  if (isPending) return <p className="empty-state">Завантаження…</p>;
  if (!plan) {
    return (
      <section className="plan-page plan-detail-page">
        <Link className="plan-back" to="/plans"><ChevronLeftIcon size={16} /> Карта планів</Link>
        <p className="empty-state">Такого плану немає. Можливо, його видалили.</p>
      </section>
    );
  }

  const cat = PLAN_CATEGORIES[plan.category];
  const status = PLAN_STATUSES[plan.status];
  const date = planDateLabel(plan);
  const days = hasPreciseDate(plan) ? daysUntilStart(plan) : null;
  const closed = isClosed(plan);
  const done = plan.status === 'done';
  const ready = readiness(tasks);
  const money = planMoney(plan, goals);
  const planLinks = linksOfPlan(plan, allLinks);
  const wishCount = planLinks.filter((link) => link.target_type === 'wish').length;
  const placeCount = planLinks.filter((link) => link.target_type === 'place').length;
  const memoryCount = planLinks.filter((link) => link.target_type === 'memory').length;

  // Порядок підготовки той самий, що в аркуші: невиконане першим, бо саме воно
  // і є «що робити далі».
  const orderedTasks = [...tasks].sort((a, b) => (
    Number(a.done) - Number(b.done)
    || a.sort_order - b.sort_order
    || a.id - b.id
  ));
  const visible = capped(orderedTasks, VISIBLE_TASKS);

  const fill = plan.budget === null || plan.budget <= 0
    ? 0
    : Math.min(100, Math.round((money.saved / plan.budget) * 100));

  const statusStep = ACTIVE_STATUSES.indexOf(plan.status);

  const remove = async () => {
    if (await confirmDialog(`Видалити план «${plan.title}» разом із завданнями?`)) {
      removePlan.mutate(plan.id, { onSuccess: () => navigate('/plans') });
    }
  };

  const detailStyle = {
    '--plan-detail-accent': cat.color,
    '--plan-color': cat.color,
  } as CSSProperties;

  return (
    <section className="plan-page plan-detail-page plan-detail-page--map" style={detailStyle}>
      <Link className="plan-back plan-detail-back" to="/plans">
        <ChevronLeftIcon size={16} /> Карта планів
      </Link>

      <div className="plan-map" data-world={webglSupported ? 'true' : undefined} ref={setMapEl}>
        {mapEl && (
          <PlanMapThreads
            map={mapEl}
            pairs={PLAN_THREADS}
            watch={`${plan.id}:${visible.shown.length}:${done}:${plan.title}`}
          />
        )}

        <article className="pmap-block pmap-hero" data-map-block="hero">
          <button
            type="button"
            className="pmap-edit"
            aria-label="Змінити назву й опис"
            onClick={() => setSheet('edit')}
          >
            <PencilIcon size={15} />
          </button>
          <div className="pmap-hero-row">
            <span className="pmap-icon" aria-hidden="true"><cat.Icon size={22} /></span>
            <div className="pmap-hero-copy">
              <span className="pmap-category">{cat.label}</span>
              <h1>{plan.title}</h1>
              {plan.description && <p>{plan.description}</p>}
            </div>
          </div>
        </article>

        <div className="pmap-row" style={{ '--pmap-split': '1.02fr 0.98fr', '--pmap-drop': '18px' } as CSSProperties}>
          <MapBlock
            id="when"
            title="Дата"
            icon={<CalendarIcon size={18} />}
            drift="-1.4s"
            onOpen={() => setSheet('date')}
            label="Змінити дату"
          >
            {date === null ? (
              <span className="pmap-ghost">Обрати дату</span>
            ) : (
              <>
                <span className="pmap-value">{date}</span>
                {days !== null && (
                  <span
                    className="pmap-pill"
                    data-tone={closed ? 'past' : days < 0 ? 'overdue' : undefined}
                  >
                    {daysLabel(days)}
                  </span>
                )}
              </>
            )}
          </MapBlock>

          <MapBlock
            id="money"
            title="Бюджет"
            icon={<PiggyBankIcon size={18} />}
            drift="-2.1s"
            onOpen={() => setSheet('money')}
            label="Відкрити бюджет"
          >
            {plan.budget === null ? (
              <>
                <span className="pmap-note">Ще не визначено</span>
                <span className="pmap-ghost"><PlusIcon size={14} /> Додати бюджет</span>
              </>
            ) : (
              <div className="pmap-money">
                <span className="pmap-ring" style={{ '--pmap-fill': fill } as CSSProperties}>
                  <b>{fill}%</b>
                </span>
                <span className="pmap-money-copy">
                  <span className="pmap-value">{fmtMoney(plan.budget)}</span>
                  <span className="pmap-note">зібрано {fmtMoney(money.saved)}</span>
                </span>
              </div>
            )}
          </MapBlock>
        </div>

        <div className="pmap-row" style={{ '--pmap-split': '1.18fr 0.82fr', '--pmap-drop': '12px' } as CSSProperties}>
          {done ? (
            <MapBlock
              id="tasks"
              title="Спогади"
              icon={<CameraIcon size={18} />}
              drift="-2.8s"
              count={memoryCount > 0 ? String(memoryCount) : undefined}
              onOpen={() => { setAddingMemory(memoryCount === 0); setSheet('memories'); }}
              label="Відкрити спогади"
            >
              {/* У виконаного плану блок підготовки більше нічого не значить:
                  кроки вже пройдені. Його місце займає те, заради чого план і
                  був, — фото цього моменту. */}
              <span className="pmap-note">
                {memoryCount > 0
                  ? `${memoryCount} фото прикріплено`
                  : 'Фото й підписи цього моменту'}
              </span>
              <span className="pmap-ghost"><PlusIcon size={14} /> Додати спогад</span>
            </MapBlock>
          ) : (
            <article className="pmap-block" data-map-block="tasks" style={{ '--pmap-drift': '-2.8s' } as CSSProperties}>
              <div className="pmap-head">
                <span className="pmap-icon" aria-hidden="true"><CheckIcon size={18} /></span>
                <span className="pmap-title">Підготовка</span>
                {ready.total > 0 && (
                  <span className="pmap-count">{ready.done} з {ready.total}</span>
                )}
              </div>

              {visible.shown.length === 0 ? (
                <span className="pmap-note">Додай перший крок, який наблизить цей план.</span>
              ) : (
                <div className="pmap-list">
                  {visible.shown.map((task) => (
                    // Крок перемикається просто на карті: заради «купити квіти
                    // ✓» відкривати аркуш немає сенсу.
                    <button
                      key={task.id}
                      type="button"
                      className="pmap-line"
                      data-done={task.done}
                      aria-pressed={task.done}
                      onClick={() => toggleTask.mutate({ task })}
                    >
                      <i className="pmap-check" aria-hidden="true" />
                      <span>{task.title}</span>
                    </button>
                  ))}
                </div>
              )}

              {visible.hidden > 0 && <span className="pmap-more">ще {visible.hidden}</span>}

              <button type="button" className="pmap-ghost" onClick={() => setSheet('tasks')}>
                <PlusIcon size={14} /> Додати пункт
              </button>
            </article>
          )}

          <MapBlock
            id="place"
            title="Місця"
            icon={<MapPinIcon size={18} />}
            drift="-3.5s"
            onOpen={() => setSheet('links')}
            label="Відкрити місця плану"
          >
            {plan.location_name ? (
              <>
                <span className="pmap-value" style={{ fontSize: 14 }}>{plan.location_name}</span>
                {placeCount > 0 && <span className="pmap-note">і ще {placeCount} з карти</span>}
              </>
            ) : placeCount > 0 ? (
              <>
                <span className="pmap-value">{placeCount}</span>
                <span className="pmap-note">точок із вашої карти</span>
              </>
            ) : (
              <span className="pmap-ghost pmap-ghost--box">
                <MapPinIcon size={20} />
                Додати місце
              </span>
            )}
          </MapBlock>
        </div>

        <div className="pmap-row" style={{ '--pmap-split': '0.96fr 1.04fr', '--pmap-drop': '-8px' } as CSSProperties}>
          <MapBlock
            id="links"
            title="Пов’язане"
            icon={<GiftIcon size={18} />}
            drift="-0.7s"
            count={planLinks.length > 0 ? String(planLinks.length) : undefined}
            onOpen={() => setSheet('links')}
            label="Відкрити пов’язане"
          >
            <div className="pmap-list">
              <span className="pmap-line">
                <GiftIcon size={14} /> <span>Бажання</span> <em>{wishCount || '—'}</em>
              </span>
              <span className="pmap-line">
                <MapPinIcon size={14} /> <span>Місця</span> <em>{placeCount || '—'}</em>
              </span>
              <span className="pmap-line">
                <CameraIcon size={14} /> <span>Спогади</span> <em>{memoryCount || '—'}</em>
              </span>
            </div>
          </MapBlock>

          <MapBlock
            id="status"
            title="Статус"
            icon={<TargetIcon size={18} />}
            drift="-1.9s"
            onOpen={() => setSheet('status')}
            label="Змінити стан плану"
          >
            <span className="pmap-status"><status.Icon size={15} /> {status.label}</span>
            <span className="pmap-steps" aria-hidden="true">
              {ACTIVE_STATUSES.map((key, index) => (
                <span key={key} data-on={!closed && index <= statusStep} />
              ))}
            </span>
            <span className="pmap-note">
              {closed
                ? STATUS_HELP[plan.status]
                : `${statusStep + 1} з ${ACTIVE_STATUSES.length} до готовності`}
            </span>
          </MapBlock>
        </div>
      </div>

      {sheet === 'edit' && (
        <EditSheet
          title={plan.title}
          description={plan.description}
          busy={updatePlan.isPending}
          onSave={(patch) => { updatePlan.mutate({ id: plan.id, patch }); setSheet(null); }}
          onDelete={() => { setSheet(null); void remove(); }}
          onClose={() => setSheet(null)}
        />
      )}

      {sheet === 'tasks' && (
        <MapSheet title="Підготовка" copy="Кроки, які наближають цей план." onClose={() => setSheet(null)}>
          <PlanTasks planId={plan.id} accent={cat.color} embedded />
        </MapSheet>
      )}

      {sheet === 'money' && (
        <MapSheet title="Бюджет" copy="Скільки може коштувати й скільки вже зібрано." onClose={() => setSheet(null)}>
          <PlanMoneyBlock plan={plan} accent={cat.color} embedded />
        </MapSheet>
      )}

      {sheet === 'links' && (
        <MapSheet title="Пов’язане" copy="Бажання, місця, спогади й покупки цього плану." onClose={() => setSheet(null)}>
          <PlanLinksBlock plan={plan} embedded />
        </MapSheet>
      )}

      {sheet === 'memories' && (
        <MapSheet title="Спогади про цей момент" copy="Фото й підписи, які лишаться після плану." onClose={() => setSheet(null)}>
          <PlanMemoriesBlock
            plan={plan}
            adding={addingMemory}
            onAddingChange={setAddingMemory}
          />
        </MapSheet>
      )}

      {sheet === 'date' && (
        <MapSheet
          title="Коли це станеться?"
          copy="Дата може бути точною або приблизною — карта збереже правильний порядок."
          onClose={() => setSheet(null)}
        >
          <label className="form-field">
            <span>Наскільки визначена дата</span>
            <select
              id="plan-precision"
              name="precision"
              value={plan.date_precision}
              onChange={(event) => {
                const next = event.target.value as PlanDatePrecision;
                updatePlan.mutate({
                  id: plan.id,
                  patch: next === 'none'
                    ? { date_precision: 'none', start_date: null, end_date: null }
                    : { date_precision: next, start_date: plan.start_date ?? todayISO() },
                });
              }}
            >
              {PRECISIONS.map((precision) => (
                <option key={precision} value={precision}>{PLAN_PRECISION_LABEL[precision]}</option>
              ))}
            </select>
          </label>

          {plan.date_precision !== 'none' && (
            <label className="form-field">
              <span>Початок</span>
              <input
                id="plan-start"
                name="start_date"
                type="date"
                value={plan.start_date ?? ''}
                onChange={(event) => updatePlan.mutate({
                  id: plan.id,
                  patch: { start_date: event.target.value || null },
                })}
              />
            </label>
          )}

          {plan.date_precision === 'range' && (
            <label className="form-field">
              <span>Завершення</span>
              <input
                id="plan-end"
                name="end_date"
                type="date"
                value={plan.end_date ?? ''}
                onChange={(event) => updatePlan.mutate({
                  id: plan.id,
                  patch: { end_date: event.target.value || null },
                })}
              />
            </label>
          )}

          <button type="button" className="btn plan-detail-sheet-done" onClick={() => setSheet(null)}>
            Готово
          </button>
        </MapSheet>
      )}

      {sheet === 'status' && (
        <MapSheet
          title="Стан плану"
          copy="На карті буде видно лише поточний стан, а не всі варіанти одразу."
          onClose={() => setSheet(null)}
        >
          <div className="plan-status-sheet-list">
            {ACTIVE_STATUSES.map((key) => (
              <StatusOption
                key={key}
                statusKey={key}
                current={plan.status}
                disabled={setStatus.isPending}
                onChoose={() => {
                  setStatus.mutate({ id: plan.id, status: key });
                  setSheet(null);
                }}
              />
            ))}
          </div>

          <div className="plan-status-sheet-divider"><span>Завершення</span></div>

          <div className="plan-status-sheet-list plan-status-sheet-list--closed">
            {CLOSED_STATUSES.map((key) => (
              <StatusOption
                key={key}
                statusKey={key}
                current={plan.status}
                disabled={setStatus.isPending}
                onChoose={() => {
                  setStatus.mutate(
                    { id: plan.id, status: key },
                    { onSuccess: () => { if (key === 'done') { setAddingMemory(false); setSheet('memories'); } } },
                  );
                  if (key !== 'done') setSheet(null);
                }}
              />
            ))}
          </div>
        </MapSheet>
      )}
    </section>
  );
}

/**
 * Блок карти, який відкриває свій аркуш.
 *
 * Кнопка, а не `<article>` з `onClick`: інакше блок не сфокусувати з
 * клавіатури й читалка не знає, що він клікабельний.
 */
function MapBlock({ id, title, icon, drift, count, onOpen, label, children }: {
  id: string;
  title: string;
  icon: ReactNode;
  drift: string;
  count?: string | undefined;
  onOpen: () => void;
  label: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className="pmap-block"
      data-map-block={id}
      style={{ '--pmap-drift': drift } as CSSProperties}
      onClick={onOpen}
      aria-label={label}
    >
      <span className="pmap-head">
        <span className="pmap-icon" aria-hidden="true">{icon}</span>
        <span className="pmap-title">{title}</span>
        {count && <span className="pmap-count">{count}</span>}
      </span>
      {children}
    </button>
  );
}

/** Аркуш поверх карти: те, що не вміщається в блок. */
function MapSheet({ title, copy, onClose, children }: {
  title: string;
  copy: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div
      className="modal-overlay plan-detail-overlay"
      onClick={(event) => event.target === event.currentTarget && onClose()}
    >
      <div className="modal-sheet plan-detail-sheet" role="dialog" aria-modal="true" aria-label={title}>
        <span className="plan-detail-sheet-handle" aria-hidden="true" />
        <h2 className="modal-title">{title}</h2>
        <p className="plan-detail-sheet-copy">{copy}</p>
        {children}
      </div>
    </div>
  );
}

/**
 * Назва, опис і видалення.
 *
 * Видалення живе тут, а не на карті: на карті для нього немає рядка, який не
 * коштував би блока, і кнопка «видалити» під шістьма блоками — остання річ,
 * яку варто бачити щоразу, відкриваючи план.
 */
function EditSheet({ title, description, busy, onSave, onDelete, onClose }: {
  title: string;
  description: string | null;
  busy: boolean;
  onSave: (patch: { title: string; description: string | null }) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const [draftTitle, setDraftTitle] = useState(title);
  const [draftNote, setDraftNote] = useState(description ?? '');

  const save = () => {
    const next = draftTitle.trim();
    if (next === '') return;
    onSave({ title: next, description: draftNote.trim() || null });
  };

  return (
    <MapSheet title="Назва плану" copy="Як він називається і що про нього варто памʼятати." onClose={onClose}>
      <label className="form-field">
        <span>Назва</span>
        <input
          id="plan-title"
          name="title"
          type="text"
          value={draftTitle}
          onChange={(event) => setDraftTitle(event.target.value)}
        />
      </label>

      <label className="form-field">
        <span>Опис</span>
        <textarea
          id="plan-description"
          name="description"
          rows={3}
          value={draftNote}
          onChange={(event) => setDraftNote(event.target.value)}
        />
      </label>

      <button
        type="button"
        className="btn plan-detail-sheet-done"
        disabled={busy || draftTitle.trim() === ''}
        onClick={save}
      >
        Зберегти
      </button>

      <button type="button" className="plan-detail-delete" onClick={onDelete}>
        <TrashIcon size={15} /> Видалити план
      </button>
    </MapSheet>
  );
}

function StatusOption({ statusKey, current, disabled, onChoose }: {
  statusKey: PlanStatus;
  current: PlanStatus;
  disabled: boolean;
  onChoose: () => void;
}) {
  const option = PLAN_STATUSES[statusKey];
  const active = current === statusKey;

  return (
    <button
      type="button"
      className={`plan-status-sheet-option${active ? ' active' : ''}`}
      disabled={disabled}
      aria-pressed={active}
      onClick={onChoose}
    >
      <span className="plan-status-sheet-icon"><option.Icon size={18} /></span>
      <span className="plan-status-sheet-copy">
        <b>{option.label}</b>
        <small>{STATUS_HELP[statusKey]}</small>
      </span>
      {active && <CheckIcon size={17} />}
    </button>
  );
}

function todayISO(): string {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
