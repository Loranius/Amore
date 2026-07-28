// ============================================================
// Завдання підготовки плану.
// ------------------------------------------------------------
// Порядок задає sort_order, а не час створення: список підготовки
// читається як послідовність («вибрати дати → знайти житло → купити
// квитки»), і додане останнім не мусить ставати першим.
// ============================================================
import { useState } from 'react';
import { pluralUA } from '@/lib/utils';
import { CheckIcon, PlusIcon, TrashIcon } from '@/components/icons/UiIcon';
import { usePlanMutations, usePlanTasks } from './usePlans';
import { readiness } from './planModel';

export function PlanTasks({ planId, accent }: { planId: number; accent: string }) {
  const { data: tasks = [], isPending } = usePlanTasks(planId);
  const { addTask, toggleTask, removeTask } = usePlanMutations();
  const [draft, setDraft] = useState('');
  const ready = readiness(tasks);

  const add = () => {
    const title = draft.trim();
    if (!title) return;
    // Нове завдання стає в кінець: sort_order рахуємо від наявних, а не
    // від довжини списку — інакше після видалення з середини два
    // завдання отримали б однаковий порядок.
    const order = tasks.reduce((max, t) => Math.max(max, t.sort_order), -1) + 1;
    addTask.mutate({ planId, title, order });
    setDraft('');
  };

  return (
    <section className="plan-tasks">
      <header className="plan-tasks-head">
        <h3>Підготовка</h3>
        {ready.total > 0 && (
          <span className="plan-tasks-count">
            {ready.done} з {ready.total} {pluralUA(ready.total, ['завдання', 'завдань', 'завдань'])}
          </span>
        )}
      </header>

      {ready.total > 0 && (
        <div className="plan-tasks-bar" aria-hidden="true">
          <span style={{ width: `${ready.percent}%`, background: accent }} />
        </div>
      )}

      {isPending ? (
        <p className="plan-tasks-empty">Завантаження…</p>
      ) : tasks.length === 0 ? (
        <p className="plan-tasks-empty">
          Завдань ще немає. Розбий підготовку на кроки — так видно, що вже зроблено.
        </p>
      ) : (
        <ul className="plan-task-list">
          {tasks.map((task) => (
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

      <div className="plan-task-add">
        <input
          id={`plan-task-new-${planId}`}
          name="task"
          type="text"
          value={draft}
          placeholder="Що треба зробити?"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') add(); }}
        />
        <button type="button" className="btn" onClick={add} disabled={!draft.trim()}>
          <PlusIcon size={15} />
        </button>
      </div>
    </section>
  );
}
