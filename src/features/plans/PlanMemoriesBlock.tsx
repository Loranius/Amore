// ============================================================
// Спогади виконаного плану.
// ------------------------------------------------------------
// Фото фізично живуть у центральному архіві `memories`, а план тримає
// лише зв'язок у `plan_links`. Відв'язування не видаляє знімок — момент
// залишається у «Спогадах», навіть якщо його більше не показують у плані.
// ============================================================
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { CameraIcon } from '@/components/icons/NavIcon';
import { CloseIcon, PlusIcon } from '@/components/icons/UiIcon';
import { useCurrentUser } from '@/providers/AuthProvider';
import { MemoryUploadModal } from '@/features/memories/MemoryUploadModal';
import { formatMemoryDate } from '@/features/memories/memoriesDate';
import { useMemories, useMemoriesMutations } from '@/features/memories/useMemories';
import { usePlanLinkMutations, usePlanLinks } from './usePlanLinks';
import type { PlanRow } from '@/types';

function memoryDateForPlan(plan: PlanRow): string {
  return plan.completed_at?.slice(0, 10)
    ?? plan.start_date
    ?? new Date().toISOString().slice(0, 10);
}

export function PlanMemoriesBlock({
  plan,
  adding,
  onAddingChange,
}: {
  plan: PlanRow;
  adding: boolean;
  onAddingChange: (value: boolean) => void;
}) {
  const me = useCurrentUser();
  const { data: archive, isPending: memoriesPending } = useMemories();
  const { data: links = [], isPending: linksPending } = usePlanLinks();
  const { uploadForPlan } = useMemoriesMutations();
  const { unlink } = usePlanLinkMutations();

  const memories = useMemo(() => {
    const ids = new Set(
      links
        .filter((link) => link.plan_id === plan.id && link.target_type === 'memory')
        .map((link) => link.target_id),
    );
    return (archive?.photos ?? [])
      .filter((memory) => ids.has(memory.id))
      .sort((left, right) => left.memory_date.localeCompare(right.memory_date) || left.id - right.id);
  }, [archive?.photos, links, plan.id]);

  const pending = memoriesPending || linksPending;

  return (
    <section className="plan-memories" aria-label="Спогади про виконаний план">
      {pending ? (
        <div className="plan-memories-skeleton" aria-hidden="true">
          <span /><span /><span />
        </div>
      ) : memories.length === 0 ? (
        <div className="plan-memories-empty">
          <span className="plan-memories-empty-icon" aria-hidden="true"><CameraIcon size={24} /></span>
          <strong>Збережіть цей момент</strong>
          <p>Додайте фотографію та короткий підпис. Вона з’явиться і тут, і в загальному архіві «Спогади».</p>
        </div>
      ) : (
        <div className="plan-memories-grid">
          {memories.map((memory) => (
            <article key={memory.id} className="plan-memory-card">
              <Link className="plan-memory-open" to="/memories" aria-label="Відкрити архів спогадів" />
              <img src={memory.photo_url} alt={memory.caption ?? ''} loading="lazy" />
              <div className="plan-memory-caption">
                <strong>{memory.caption || 'Наш момент'}</strong>
                <small>{formatMemoryDate(memory.memory_date, memory.date_precision)}</small>
              </div>
              <button
                type="button"
                className="plan-memory-unlink"
                aria-label="Відв’язати фото від плану"
                disabled={unlink.isPending}
                onClick={() => unlink.mutate({
                  planId: plan.id,
                  targetType: 'memory',
                  targetId: memory.id,
                })}
              >
                <CloseIcon size={13} />
              </button>
            </article>
          ))}
        </div>
      )}

      <div className="plan-memories-actions">
        <button
          type="button"
          className="btn plan-memories-add"
          onClick={() => onAddingChange(true)}
        >
          <PlusIcon size={15} /> {memories.length > 0 ? 'Додати ще фото' : 'Додати спогад'}
        </button>
        {memories.length > 0 && <Link to="/memories">Усі спогади</Link>}
      </div>

      {adding && (
        <MemoryUploadModal
          userId={me.id}
          busy={uploadForPlan.isPending}
          initialDate={memoryDateForPlan(plan)}
          title={`Спогад про «${plan.title}»`}
          description="Фото збережеться в загальному архіві й автоматично прикріпиться до цієї точки маршруту."
          submitLabel="Додати до моменту"
          onClose={() => {
            if (!uploadForPlan.isPending) onAddingChange(false);
          }}
          onSubmit={(input) => uploadForPlan.mutate(
            { planId: plan.id, input },
            { onSuccess: () => onAddingChange(false) },
          )}
        />
      )}
    </section>
  );
}
