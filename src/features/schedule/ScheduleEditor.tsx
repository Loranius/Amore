import { useMemo, useState } from 'react';
import { daysInMonth, stepMonth } from '@/features/_shared/month';
import type { AppUser } from '@/types';
import {
  useSchedule,
  useScheduleBatchMutation,
  useScheduleMutation,
  type MarksMap,
  type ScheduleChange,
  type ScheduleMark,
} from './useSchedule';
import {
  buildClearChanges,
  buildCopyChanges,
  buildTemplateChanges,
  markLabel,
  templateLabel,
  type TemplateKind,
} from './scheduleEditorModel';
import { ScheduleEditorControls } from './ScheduleEditorControls';
import { ScheduleEditorCalendar } from './ScheduleEditorCalendar';
import { ScheduleEditorTemplates } from './ScheduleEditorTemplates';
import './scheduleEditor.css';

export function ScheduleEditor({
  user,
  yr,
  mo,
  marks,
  today,
}: {
  user: AppUser;
  yr: number;
  mo: number;
  marks: MarksMap;
  today: string;
}) {
  const [selectedMark, setSelectedMark] = useState<ScheduleMark>('Х');
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedDates, setSelectedDates] = useState<Set<string>>(() => new Set());

  const total = daysInMonth(yr, mo);
  const userMarks = marks[user.id] ?? {};
  const previousMonth = stepMonth(yr, mo, -1);
  const { data: previousMarks = {} } = useSchedule(previousMonth.yr, previousMonth.mo);
  const singleMutation = useScheduleMutation(yr, mo);
  const batchMutation = useScheduleBatchMutation(yr, mo);
  const isPending = singleMutation.isPending || batchMutation.isPending;
  const markedCount = useMemo(
    () => Object.values(userMarks).filter((mark) => mark === 'Р' || mark === 'Х').length,
    [userMarks],
  );

  const applyChanges = (changes: ScheduleChange[], successMessage: string) => {
    if (changes.length === 0 || isPending) return;
    batchMutation.mutate({ changes, successMessage });
  };

  const onDay = (date: string) => {
    if (isPending) return;
    if (!bulkMode) {
      singleMutation.mutate({ userId: user.id, date, mark: selectedMark });
      return;
    }
    setSelectedDates((current) => {
      const next = new Set(current);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });
  };

  const toggleBulkMode = () => {
    setBulkMode((current) => !current);
    setSelectedDates(new Set());
  };

  const applySelected = () => {
    const changes = [...selectedDates].map((date) => ({ userId: user.id, date, mark: selectedMark }));
    applyChanges(changes, `${markLabel(selectedMark)}: оновлено ${changes.length} дн.`);
    setSelectedDates(new Set());
  };

  const applyTemplate = (kind: TemplateKind) => {
    if (!window.confirm('Шаблон замінить усі позначки цього місяця. Продовжити?')) return;
    applyChanges(
      buildTemplateChanges(user.id, yr, mo, kind),
      `Шаблон «${templateLabel(kind)}» застосовано.`,
    );
  };

  const copyPreviousMonth = () => {
    if (!window.confirm('Поточний місяць буде замінено графіком попереднього. Продовжити?')) return;
    applyChanges(
      buildCopyChanges({
        userId: user.id,
        yr,
        mo,
        previousYr: previousMonth.yr,
        previousMo: previousMonth.mo,
        previousMarks: previousMarks[user.id] ?? {},
      }),
      'Графік попереднього місяця скопійовано.',
    );
  };

  const clearMonth = () => {
    if (!window.confirm('Очистити всі позначки цього місяця?')) return;
    applyChanges(buildClearChanges(user.id, yr, mo), 'Графік місяця очищено.');
  };

  return (
    <div className="sched-editor">
      <ScheduleEditorControls
        selectedMark={selectedMark}
        onMarkChange={setSelectedMark}
        bulkMode={bulkMode}
        selectedCount={selectedDates.size}
        onToggleBulk={toggleBulkMode}
        onApplySelected={applySelected}
        markedCount={markedCount}
        total={total}
        isPending={isPending}
      />
      <ScheduleEditorCalendar
        user={user}
        yr={yr}
        mo={mo}
        today={today}
        userMarks={userMarks}
        selectedMark={selectedMark}
        bulkMode={bulkMode}
        selectedDates={selectedDates}
        isPending={isPending}
        onDay={onDay}
      />
      <ScheduleEditorTemplates
        isPending={isPending}
        onTemplate={applyTemplate}
        onCopyPrevious={copyPreviousMonth}
        onClear={clearMonth}
      />
    </div>
  );
}
