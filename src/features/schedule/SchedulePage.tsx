import { HeartIcon } from '@/components/icons/NavIcon';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useUsers } from '@/features/_shared/useUsers';
import { currentYearMonth, daysInMonth, monthKeyOf, todayLocal, ymd } from '@/features/_shared/month';
import { useCurrentUser } from '@/providers/AuthProvider';
import { useSchedule } from './useSchedule';
import { useScheduleReminder } from './useScheduleReminder';
import { useSharedDaysOff } from './useSharedDaysOff';
import { usePlans } from '@/features/plans/usePlans';
import { showsInCalendar } from '@/features/plans/planModel';
import { ScheduleEditor } from './ScheduleEditor';
import { ScheduleMonthNav } from './ScheduleMonthNav';
import { ScheduleCompletionStatus } from './ScheduleCompletionStatus';
import { ScheduleMonthOverview } from './ScheduleMonthOverview';
import { ScheduleUpcoming } from './ScheduleUpcoming';
import { ScheduleDayDetails } from './ScheduleDayDetails';
import { countdownLabel, dayStatus, fmtLongDate, type DayStatus } from './scheduleViewModel';
import type { PlanRow } from '@/types';
import './schedule.css';
import './scheduleCompleteness.css';
import './scheduleEditToggle.css';

function yearMonthFromParam(value: string | null): { yr: number; mo: number } | null {
  if (!value || !/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) return null;
  return { yr: Number(value.slice(0, 4)), mo: Number(value.slice(5, 7)) };
}

function initialYearMonth(params: URLSearchParams): { yr: number; mo: number } {
  return yearMonthFromParam(params.get('month')) ?? currentYearMonth();
}

import { PageHeader } from '@/components/ui/PageHeader';

export function SchedulePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: users = [] } = useUsers();
  const me = useCurrentUser();
  const [{ yr, mo }, setYm] = useState(() => initialYearMonth(searchParams));
  const [editMode, setEditMode] = useState(() => searchParams.get('edit') === '1');
  const [editUserId, setEditUserId] = useState<number | null>(null);
  const [hasPendingBulkSelection, setHasPendingBulkSelection] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [remindedKeys, setRemindedKeys] = useState<Set<string>>(() => new Set());

  const { data: marks = {} } = useSchedule(yr, mo);
  const { data: sharedDates = [] } = useSharedDaysOff();
  const { data: allPlans = [] } = usePlans();
  const navigate = useNavigate();
  const scheduleReminder = useScheduleReminder();
  const total = daysInMonth(yr, mo);
  const today = todayLocal();
  const month = monthKeyOf(yr, mo);
  const currentMonth = currentYearMonth();
  const canRemindForMonth = month >= monthKeyOf(currentMonth.yr, currentMonth.mo);
  const currentUser = users.find((user) => user.name === me.name);
  const lena = users.find((user) => user.name === 'Лєна');
  const dima = users.find((user) => user.name === 'Діма');
  const activeEditUser = users.find((user) => user.id === editUserId) ?? currentUser ?? users[0];
  const remindedUserIds = new Set(
    users.filter((user) => remindedKeys.has(`${month}:${user.id}`)).map((user) => user.id),
  );
  const remindingUserId = scheduleReminder.isPending
    ? scheduleReminder.variables?.recipientId ?? null
    : null;

  const requestedMonth = searchParams.get('month');
  const requestedEdit = searchParams.get('edit') === '1';

  useEffect(() => {
    const nextMonth = yearMonthFromParam(requestedMonth);
    if (!nextMonth && !requestedEdit) return;

    if (hasPendingBulkSelection) {
      const discard = window.confirm(
        'Є вибрані дні, до яких зміни ще не застосовано. Скасувати цей вибір і відкрити нагадування?',
      );
      if (!discard) {
        const cleaned = new URLSearchParams(searchParams);
        cleaned.delete('month');
        cleaned.delete('edit');
        setSearchParams(cleaned, { replace: true });
        return;
      }
    }

    setHasPendingBulkSelection(false);
    if (nextMonth) setYm(nextMonth);
    if (requestedEdit) {
      setEditUserId(null);
      setEditMode(true);
      setSelectedDate(null);
    }

    const cleaned = new URLSearchParams(searchParams);
    cleaned.delete('month');
    cleaned.delete('edit');
    setSearchParams(cleaned, { replace: true });
  }, [hasPendingBulkSelection, requestedEdit, requestedMonth, searchParams, setSearchParams]);

  const statusOf = useMemo(() => {
    const map = new Map<string, DayStatus>();
    for (let day = 1; day <= total; day++) {
      const date = ymd(yr, mo, day);
      map.set(date, dayStatus(lena, dima, marks, date));
    }
    return map;
  }, [dima, lena, marks, mo, total, yr]);

  const statusCounts = useMemo(() => {
    const counts = { both: 0, lena: 0, dima: 0 };
    for (const status of statusOf.values()) {
      if (status === 'both-off') counts.both++;
      if (status === 'lena-off' || status === 'both-off') counts.lena++;
      if (status === 'dima-off' || status === 'both-off') counts.dima++;
    }
    return counts;
  }, [statusOf]);

  // Лише плани з точною датою: «осінь 2026» не має де стояти в дні
  // графіка — те саме правило, що в календарній сітці.
  const plansByDate = useMemo(() => {
    const map = new Map<string, PlanRow[]>();
    for (const plan of allPlans) {
      if (!showsInCalendar(plan) || !plan.start_date) continue;
      const list = map.get(plan.start_date) ?? [];
      list.push(plan);
      map.set(plan.start_date, list);
    }
    return map;
  }, [allPlans]);

  const selectedStatus: DayStatus = selectedDate
    ? sharedDates.includes(selectedDate) ? 'both-off' : statusOf.get(selectedDate) ?? 'none'
    : 'none';

  const canDiscardPendingSelection = () => {
    if (!hasPendingBulkSelection) return true;
    return window.confirm('Є вибрані дні, до яких зміни ще не застосовано. Скасувати цей вибір?');
  };

  const toggleEditMode = () => {
    if (editMode && !canDiscardPendingSelection()) return;
    if (!editMode && editUserId === null) setEditUserId(currentUser?.id ?? users[0]?.id ?? null);
    setHasPendingBulkSelection(false);
    setEditMode((current) => !current);
    setSelectedDate(null);
  };

  const changeMonth = (next: { yr: number; mo: number }) => {
    if (!canDiscardPendingSelection()) return;
    setHasPendingBulkSelection(false);
    setYm(next);
  };

  const changeEditUser = (userId: number) => {
    if (userId === activeEditUser?.id) return;
    if (!canDiscardPendingSelection()) return;
    setHasPendingBulkSelection(false);
    setEditUserId(userId);
  };

  const openEditorForUser = (userId: number) => {
    if (editMode && userId === activeEditUser?.id) return;
    if (!canDiscardPendingSelection()) return;
    setHasPendingBulkSelection(false);
    setEditUserId(userId);
    setEditMode(true);
    setSelectedDate(null);
  };

  const remindUser = (userId: number) => {
    if (!canRemindForMonth || userId === currentUser?.id) return;
    const key = `${month}:${userId}`;
    scheduleReminder.mutate(
      { recipientId: userId, month },
      {
        onSuccess: (result) => {
          if (result === 'already_complete') return;
          setRemindedKeys((current) => new Set(current).add(key));
        },
      },
    );
  };

  // Заводити план у двох місцях не треба: графік лише показує, що вже
  // заплановано на спільний вихідний, а створення живе в «Планах».
  const openPlans = () => {
    setSelectedDate(null);
    navigate('/plans');
  };

  const nextSharedDate = sharedDates[0];

  return (
    // Фон раніше приходив від обгортки хабу «Календар». Графік більше під
    // ним не живе — це власний розділ, тож він несе його сам, як і решта
    // розділів порталу.
    <section className="sched pink-page">
      <header className="sched-hero">
        <PageHeader
          eyebrow="Календар пари"
          title="Графік"
          meta="Побачте, коли ви обоє вільні, та заплануйте час разом."
        />
      </header>

      <section className={`sched-next-card${nextSharedDate ? '' : ' sched-next-card--empty'}`} aria-label="Наступний спільний вихідний">
        <div className="sched-next-icon" aria-hidden="true">
          <HeartIcon size={22} filled={nextSharedDate !== null} />
        </div>
        <div className="sched-next-copy">
          <span>{nextSharedDate ? 'Наступний спільний вихідний' : 'Спільний вихідний ще не знайдено'}</span>
          <strong>{nextSharedDate ? fmtLongDate(nextSharedDate) : 'Заповніть графік на найближчі дні'}</strong>
          <small>{nextSharedDate ? countdownLabel(nextSharedDate, today) : 'Ми автоматично покажемо першу вільну дату.'}</small>
        </div>
        {nextSharedDate && <button type="button" className="sched-next-action" onClick={openPlans}>Запланувати</button>}
      </section>

      <div className="sched-month-toolbar">
        <ScheduleMonthNav yr={yr} mo={mo} onChange={changeMonth} />
        <div className="sched-edit-row">
          <button
            type="button"
            className={`sched-edit-compact${editMode ? ' is-active' : ''}`}
            onClick={toggleEditMode}
            aria-pressed={editMode}
          >
            {editMode ? 'Завершити' : 'Редагувати'}
          </button>
        </div>
      </div>

      <ScheduleCompletionStatus
        users={users}
        marks={marks}
        total={total}
        currentUserId={currentUser?.id ?? null}
        canRemind={canRemindForMonth}
        remindingUserId={remindingUserId}
        remindedUserIds={remindedUserIds}
        onEditUser={openEditorForUser}
        onRemindUser={remindUser}
      />

      {editMode ? (
        <div className="sched-edit-panel">
          <div className="sched-person-switcher" role="tablist" aria-label="Чий графік редагувати">
            {users.map((user) => <button key={user.id} type="button" role="tab" aria-selected={activeEditUser?.id === user.id} className={activeEditUser?.id === user.id ? 'is-active' : ''} onClick={() => changeEditUser(user.id)}>{user.name}</button>)}
          </div>
          {activeEditUser && (
            <ScheduleEditor
              key={`${activeEditUser.id}-${yr}-${mo}`}
              user={activeEditUser}
              yr={yr}
              mo={mo}
              marks={marks}
              today={today}
              onPendingSelectionChange={setHasPendingBulkSelection}
            />
          )}
        </div>
      ) : (
        <>
          <ScheduleMonthOverview yr={yr} mo={mo} today={today} usersCount={users.length} statusCounts={statusCounts} statusOf={statusOf} plansByDate={plansByDate} onSelectDate={setSelectedDate} />
          <ScheduleUpcoming sharedDates={sharedDates} plansByDate={plansByDate} onSelectDate={setSelectedDate} onPlan={openPlans} />
        </>
      )}

      {selectedDate && <ScheduleDayDetails date={selectedDate} status={selectedStatus} plans={plansByDate.get(selectedDate) ?? []} onClose={() => setSelectedDate(null)} onPlan={openPlans} />}
    </section>
  );
}
