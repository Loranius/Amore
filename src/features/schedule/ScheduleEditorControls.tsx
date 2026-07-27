import type { ScheduleMark } from './useSchedule';
import { markLabel } from './scheduleEditorModel';

export function ScheduleEditorControls({
  selectedMark,
  onMarkChange,
  bulkMode,
  selectedCount,
  missingCount,
  onToggleBulk,
  onSelectMissing,
  onApplySelected,
  markedCount,
  total,
  isPending,
}: {
  selectedMark: ScheduleMark;
  onMarkChange: (mark: ScheduleMark) => void;
  bulkMode: boolean;
  selectedCount: number;
  missingCount: number;
  onToggleBulk: () => void;
  onSelectMissing: () => void;
  onApplySelected: () => void;
  markedCount: number;
  total: number;
  isPending: boolean;
}) {
  const progress = total > 0 ? Math.round((markedCount / total) * 100) : 0;

  return (
    <section className="sched-editor-toolbar" aria-label="Інструменти редагування графіка">
      <div className="sched-editor-state-row">
        <span className="sched-editor-label">Позначати як</span>
        <div className="sched-editor-state-switch" role="group" aria-label="Стан дня">
          {(['Р', 'Х', ''] as const).map((mark) => (
            <button
              key={mark || 'empty'}
              type="button"
              className={selectedMark === mark ? 'is-active' : ''}
              onClick={() => onMarkChange(mark)}
              disabled={isPending}
            >
              <span aria-hidden="true">{mark === 'Р' ? '💼' : mark === 'Х' ? '🌿' : '○'}</span>
              {markLabel(mark)}
            </button>
          ))}
        </div>
      </div>

      <div className="sched-editor-bulk-row">
        <button
          type="button"
          className={`sched-editor-bulk-toggle${bulkMode ? ' is-active' : ''}`}
          onClick={onToggleBulk}
          disabled={isPending}
        >
          {bulkMode ? 'Завершити вибір' : 'Обрати кілька днів'}
        </button>
        <button
          type="button"
          className="sched-editor-missing"
          onClick={onSelectMissing}
          disabled={missingCount === 0 || isPending}
        >
          {missingCount === 0 ? 'Пропусків немає' : `Обрати пропуски · ${missingCount}`}
        </button>
      </div>

      {bulkMode && (
        <button
          type="button"
          className="sched-editor-apply sched-editor-apply-wide"
          onClick={onApplySelected}
          disabled={selectedCount === 0 || isPending}
        >
          Застосувати до {selectedCount}
        </button>
      )}

      <div className="sched-editor-progress">
        <div className="sched-editor-progress-copy">
          <span>Заповнення графіка</span>
          <strong>{markedCount}/{total} · {progress}%</strong>
        </div>
        <div className="sched-editor-progress-track" aria-hidden="true">
          <span style={{ width: `${progress}%` }} />
        </div>
      </div>
    </section>
  );
}
