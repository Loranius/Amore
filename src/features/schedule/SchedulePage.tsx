import { useMemo, useState } from 'react';
import { useUsers } from '@/features/_shared/useUsers';
import { currentYearMonth, daysInMonth, todayLocal, ymd } from '@/features/_shared/month';
import { useCurrentUser } from '@/providers/AuthProvider';
import { useSchedule } from './useSchedule';
import { useDateMutations, useDatePlans, useSharedDaysOff } from './useDates';
import { PlanDateModal } from './PlanDateModal';
import { ScheduleEditor } from './ScheduleEditor';
import { ScheduleMonthOverview } from './ScheduleMonthOverview';
import { ScheduleUpcoming } from './ScheduleUpcoming';
import { ScheduleDayDetails } from './ScheduleDayDetails';
import { ScheduleDatePlans } from './ScheduleDatePlans';
import { countdownLabel, dayStatus, fmtLongDate, type DayStatus } from './scheduleViewModel';
import type { DateRow } from '@/types';
import './schedule.css';

export function SchedulePage() {
  const { data: users = [] } = useUsers();
  const me = useCurrentUser();
  const [{ yr, mo }, setYm] = useState(currentYearMonth);
  const [editMode, setEditMode] = useState(false);
  const [editUserId, setEditUserId] = useState<number | null>(null);
  const [planModalOpen, setPlanModalOpen] = useState(false);
  const [initialPlanDate, setInitialPlanDate] = useState<string | undefined>();
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const { data: marks = {} } = useSchedule(yr, mo);
  const { data: sharedDates = [] } = useSharedDaysOff();
  const { data: datePlans = [] } = useDatePlans();
  const dateMutations = useDateMutations();
  const total = daysInMonth(yr, mo);
  const today = todayLocal();
  const lena = users.find((user) => user.name === 'Лєна');
  const dima = users.find((user) => user.name === 'Діма');
  const activeEditUser = users.find((user) => user.id === editUserId) ?? users.find((user) => user.name === me.name) ?? users[0];

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

  const plansByDate = useMemo(() => {
    const map = new Map<string, DateRow[]>();
    for (const plan of datePlans) {
      const plans = map.get(plan.date) ?? [];
      plans.push(plan);
      map.set(plan.date, plans);
    }
    return map;
  }, [datePlans]);

  const selectedStatus: DayStatus = selectedDate
    ? sharedDates.includes(selectedDate) ? 'both-off' : statusOf.get(selectedDate) ?? 'none'
    : 'none';

  const toggleEditMode = () => {
    if (!editMode && editUserId === null) setEditUserId(users.find((user) => user.name === me.name)?.id ?? users[0]?.id ?? null);
    setEditMode((current) => !current);
    setSelectedDate(null);
  };

  const openPlanModal = (date?: string) => {
    setInitialPlanDate(date);
    setSelectedDate(null);
    setPlanModalOpen(true);
  };

  const nextSharedDate = sharedDates[0];

  return (
    <section className="sched">
      <header className="sched-hero">
        <div><span className="sched-kicker">Календар пари</span><h1 className="sched-title">Графік</h1><p className="sched-subtitle">Побачте, коли ви обоє вільні, та заплануйте час разом.</p></div>
        <button type="button" className={`sched-edit-toggle${editMode ? ' is-active' : ''}`} onClick={toggleEditMode}>{editMode ? 'Завершити' : 'Редагувати'}</button>
      </header>

      <section className={`sched-next-card${nextSharedDate ? '' : ' sched-next-card--empty'}`} aria-label="Наступний спільний вихідний">
        <div className="sched-next-icon" aria-hidden="true">{nextSharedDate ? '♥' : '♡'}</div>
        <div className="sched-next-copy">
          <span>{nextSharedDate ? 'Наступний спільний вихідний' : 'Спільний вихідний ще не знайдено'}</span>
          <strong>{nextSharedDate ? fmtLongDate(nextSharedDate) : 'Заповніть графік на найближчі дні'}</strong>
          <small>{nextSharedDate ? countdownLabel(nextSharedDate, today) : 'Ми автоматично покажемо першу вільну дату.'}</small>
        </div>
        {nextSharedDate && <button type="button" className="sched-next-action" onClick={() => openPlanModal(nextSharedDate)}>Запланувати</button>}
      </section>

      {editMode ? (
        <div className="sched-edit-panel">
          <div className="sched-person-switcher" role="tablist" aria-label="Чий графік редагувати">
            {users.map((user) => <button key={user.id} type="button" role="tab" aria-selected={activeEditUser?.id === user.id} className={activeEditUser?.id === user.id ? 'is-active' : ''} onClick={() => setEditUserId(user.id)}>{user.name}</button>)}
          </div>
          {activeEditUser && <ScheduleEditor user={activeEditUser} yr={yr} mo={mo} marks={marks} today={today} />}
        </div>
      ) : (
        <>
          <ScheduleMonthOverview yr={yr} mo={mo} today={today} usersCount={users.length} statusCounts={statusCounts} statusOf={statusOf} plansByDate={plansByDate} onMonthChange={setYm} onSelectDate={setSelectedDate} />
          <ScheduleUpcoming sharedDates={sharedDates} plansByDate={plansByDate} onSelectDate={setSelectedDate} onPlan={() => openPlanModal()} />
          <ScheduleDatePlans plans={datePlans} meName={me.name} onConfirm={(id) => dateMutations.confirm.mutate(id)} onRemove={(id) => dateMutations.remove.mutate(id)} />
        </>
      )}

      {selectedDate && <ScheduleDayDetails date={selectedDate} status={selectedStatus} plans={plansByDate.get(selectedDate) ?? []} onClose={() => setSelectedDate(null)} onPlan={() => openPlanModal(selectedDate)} />}
      {planModalOpen && <PlanDateModal key={initialPlanDate ?? 'default-date'} sharedDates={sharedDates} initialDate={initialPlanDate} onClose={() => setPlanModalOpen(false)} onSubmit={(input) => dateMutations.propose.mutate(input)} />}
    </section>
  );
}
