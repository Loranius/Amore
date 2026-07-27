import { useEffect, useMemo, useState } from 'react';
import { daysInMonth, stepMonth, ymd } from '@/features/_shared/month';
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
  normalizeMark,
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
  onPendingSelectionChange,
}: {
  user: AppUser;
  yr: number;
  mo: number;
  marks: MarksMap;
  today: string;
  onPendingSelectionChange: (pending: boolean) => void;
}) {
  const [selectedMark, setSelectedMark] = useState<ScheduleMark>('Х');
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedDates, setSelectedDates] = useState<Set<string>>(() => new Set());

  const total = daysInMonth(yr, mo);
  const userMarks = marks[user.id] ?? {};
  const previousMonth = stepMonth(yr, mo, -1);
  const { data: previousMarks = {}, isPending: previousMonthPending } = useSchedule(previousMonth.yr, previousMonth.mo);
  const singleMutation = useScheduleMutation(yr, mo);
  const batchMutation = useScheduleBatchMutation(yr, mo);
  const isPending = singleMutation.isPending || batchMutation.isPending;
  const markedCount = useMemo(
    () => Object.values(userMarks).filter((mark) => mark === 'Р' || mark === 'Х').length,
    [userMarks],
  );
  const missingDates = useMemo(
    () => Array.from({ length: total }, (_, index) => ymd(yr, mo, index + 1))
      .filter((date) => normalizeMark(userMarks[date]) === ''),
    [mo, total, userMarks, yr],
  );

  useEffect(() => {
    const hasPendingSelection = selectedDates.size > 0;
    onPendingSelectionChange(hasPendingSelection);
    if (!hasPendingSelection) return;

    const protectFromReload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', protectFromReload);
    return () => {
      window.removeEventListener('beforeunload', protectFromReload);
      onPendingSelectionChange(false);
    };
  }, [onPendingSelectionChange, selectedDates.size]);

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
    if (bulkMode && selectedDates.size > 0) {
      const discard = window.confirm('Скасувати вибір позначених днів без застосування?');
      if (!discard) return;
    }
    setBulkMode((current) => !current);
    setSelectedDates(new Set());
  };

  const selectMissingDates = () => {
    if (missingDates.length === 0 || isPending) return;
    setBulkMode(true);
    setSelectedDates((current) => new Set([...current, ...missingDates]));
  };

  const applySelected = () => {
    const changes = [...selectedDates].map((date) => ({ userId: user.id, date, mark: selectedMark }));
    if (changes.length === 0 || isPending) return;
    batchMutation.mutate(
      { changes, successMessage: `${markLabel(selectedMark)}: оновлено ${changes.length} дн.` },
      { onSuccess: () => setSelectedDates(new Set()) },
    );
  };

  const applyTemplate = (kind: TemplateKind) => {
    if (!window.confirm('Шаблон замінить усі позначки цього місяця. Продовжити?')) return;
    applyChanges(
      buildTemplateChanges(user.id, yr, mo, kind),
      `Шаблон «${templateLabel(kind)}» застосовано.`,
    );
  };

  const copyPreviousMonth = () => {
    if (previousMonthPending) return;
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
        missingCount={missingDates.length}
        onToggleBulk={toggleBulkMode}
        onSelectMissing={selectMissingDates}
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
        copyDisabled={isPending || previousMonthPending}
      />
    </div>
  );
}
