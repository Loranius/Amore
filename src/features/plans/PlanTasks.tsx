// ============================================================
// Завдання підготовки плану.
// ------------------------------------------------------------
// Порядок задає sort_order, а не час створення: список підготовки
// читається як послідовність («вибрати дати → знайти житло → купити
// квитки»), і додане останнім не мусить ставати першим.
// ============================================================
import { useState } from 'react';
import { pluralUA } from '@/lib/utils';
import { CheckIcon, ChevronDownIcon, PlusIcon, TrashIcon } from '@/components/icons/UiIcon';
import { usePlanMutations, usePlanTasks } from './usePlans';
import { readiness } from './planModel';

export function PlanTasks({ planId, accent, embedded = false }: {
  planId: number;
  accent: string;
  /** Усередині disclosure заголовок секції вже намальований зовні. */
  embedded?: boolean;
}) {
  const { data: tasks = [], isPending } = usePlanTasks(planId);
  const { addTask, toggleTask, removeTask } = usePlanMutations();
  const [draft, setDraft] = useState('');
  const [showDone, setShowDone] = useState(false);
  const ready = readiness(tasks);
  const openTasks = tasks.filter((task) => !task.done);
  const doneTasks = tasks.filter((task) => task.done);
  const visibleTasks = showDone ? [...openTasks, ...doneTasks] : openTasks;

  const add = () => {
    const title = draft.trim();
    if (!title) return;
    // Нове завдання стає в кінець: sort_order рахуємо від наявних, а не
    // від довжини списку — інакше після видалення з середини два
    // завдання отримали б однаковий порядок.
    const order = tasks.reduce((max, task) => Math.max(max, task.sort_order), -1) + 1;
    addTask.mutate({ planId, title, order });
    setDraft('');
  };

  return (
    <section className={`plan-tasks${embedded ? ' plan-tasks--embedded' : ''}`}>
      {(!embedded || ready.total > 0) && (
        <header className="plan-tasks-head">
          {!embedded && <h3>Підготовка</h3>}
          {ready.total > 0 && (
            <span className="plan-tasks-count">
              {ready.done} з {ready.total} {pluralUA(ready.total, ['завдання', 'завдань', 'завдань'])}
            </span>
          )}
        </header>
      )}

      {ready.total > 0 && (
        <div className="plan-tasks-bar" aria-hidden="true">
          <span style={{ width: `${ready.percent}%`, background: accent }} />
        </div>
      )}

      {isPending ? (
        <p className="plan-tasks-empty">Завантаження…</p>
      ) : tasks.length === 0 ? (
        <p className="plan-tasks-empty">Додай перший крок, який наблизить цей план.</p>
      ) : (
        <>
          {visibleTasks.length > 0 && (
            <ul className="plan-task-list">
              {visibleTasks.map((task) => (
                <li key={task.id} className={`plan-task${task.done ? ' plan-task--done' : ''}`}>
                  <button
                    type="button"
                    className="plan-task-check"
                    aria-pressed={task.done}
                    aria-label={task.done ? `Зняти «${task.title}»` : `Виконано «${task.title}»`}
                    onClick={() => toggleTask.mutate({ task })}
                    style={task.done ? { background: accent, borderColor: accent } : undefined}
                  >
                    {task.done && <CheckIcon size={13} />}
                  </button>
                  <span className="plan-task-title">{task.title}</span>
                  <button
                    type="button"
                    className="plan-task-del"
                    aria-label={`Видалити «${task.title}»`}
                    onClick={() => removeTask.mutate({ task })}
                  >
                    <TrashIcon size={14} />
                  </button>
                </li>
              ))}
            </ul>
          )}

          {openTasks.length === 0 && !showDone && (
            <p className="plan-tasks-complete">Усі кроки готові. План можна здійснювати.</p>
          )}

          {doneTasks.length > 0 && (
            <button
              type="button"
              className={`plan-tasks-done-toggle${showDone ? ' active' : ''}`}
              onClick={() => setShowDone((value) => !value)}
              aria-expanded={showDone}
            >
              <CheckIcon size={14} />
              {showDone ? 'Сховати виконані' : `${doneTasks.length} виконано`}
              <ChevronDownIcon size={14} />
            </button>
          )}
        </>
      )}

      <div className="plan-task-add">
        <input
          id={`plan-task-new-${planId}`}
          name="task"
          type="text"
          value={draft}
          placeholder="Наступний крок…"
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => { if (event.key === 'Enter') add(); }}
        />
        <button type="button" className="btn" onClick={add} disabled={!draft.trim()} aria-label="Додати крок">
          <PlusIcon size={15} />
        </button>
      </div>
    </section>
  );
}
