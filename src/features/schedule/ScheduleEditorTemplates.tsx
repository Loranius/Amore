import type { TemplateKind } from './scheduleEditorModel';

export function ScheduleEditorTemplates({
  isPending,
  onTemplate,
  onCopyPrevious,
  onClear,
  copyDisabled,
}: {
  isPending: boolean;
  onTemplate: (kind: TemplateKind) => void;
  onCopyPrevious: () => void;
  onClear: () => void;
  copyDisabled: boolean;
}) {
  return (
    <section className="sched-editor-templates">
      <div className="sched-editor-template-head">
        <div>
          <span>Швидке заповнення</span>
          <strong>Шаблони місяця</strong>
        </div>
        {isPending && <small>Зберігаємо…</small>}
      </div>
      <div className="sched-editor-template-grid">
        <button type="button" onClick={() => onTemplate('two-two')} disabled={isPending}>2 через 2</button>
        <button type="button" onClick={() => onTemplate('three-three')} disabled={isPending}>3 через 3</button>
        <button type="button" onClick={() => onTemplate('weekdays')} disabled={isPending}>Пн–Пт</button>
        <button type="button" onClick={onCopyPrevious} disabled={copyDisabled}>Копіювати минулий</button>
        <button type="button" className="is-danger" onClick={onClear} disabled={isPending}>Очистити місяць</button>
      </div>
    </section>
  );
}
