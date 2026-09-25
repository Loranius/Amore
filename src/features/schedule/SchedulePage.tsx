import { HeartIcon } from '@/components/icons/NavIcon';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { usePeople } from '@/features/_shared/useUsers';
import { currentYearMonth, daysInMonth, monthKeyOf, todayLocal, ymd } from '@/features/_shared/month';
import { useCurrentUser } from '@/providers/AuthProvider';
import { useSchedule, useScheduleMutation } from './useSchedule';
import { useScheduleReminder } from './useScheduleReminder';
import { useSharedDaysOff } from './useSharedDaysOff';
import { usePlans } from '@/features/plans/usePlans';
import { plansOnDate } from '@/features/calendar/calendarPlans';
import { ScheduleEditor } from './ScheduleEditor';
import { ScheduleMonthNav } from './ScheduleMonthNav';
import { ScheduleCompletionStatus } from './ScheduleCompletionStatus';
import { ScheduleMonthOverview } from './ScheduleMonthOverview';
import { ScheduleUpcoming } from './ScheduleUpcoming';
import { ScheduleDayDetails } from './ScheduleDayDetails';
import { countdownLabel, dayStatus, fmtLongDate, nextMark, type DayStatus } from './scheduleViewModel';
import { normalizeMark } from './scheduleEditorModel';
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
  const users = usePeople();
  const me = useCurrentUser();
  const [{ yr, mo }, setYm] = useState(() => initialYearMonth(searchParams));
  const [editMode, setEditMode] = useState(() => searchParams.get('edit') === '1');
  const [editUserId, setEditUserId] = useState<number | null>(null);
  const [hasPendingBulkSelection, setHasPendingBulkSelection] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [remindedKeys, setRemindedKeys] = useState<Set<string>>(() => new Set());

  const { data: marks = {} } = useSchedule(yr, mo);
  const scheduleMutation = useScheduleMutation(yr, mo);
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
  /*
   * ДВОЄ ЧЛЕНІВ ПАРИ ЗНАХОДЯТЬСЯ ПОРЯДКОМ, А НЕ ІМЕНЕМ (ADR-0209).
   *
   * Тут стояло `users.find((u) => u.name === 'Лєна')`. Для цієї пари це
   * працює, для будь-якої іншої дає `undefined` — і сітка втратила б
   * доріжку без жодної помилки. `useUsers` замовляє `order('id')`, тож
   * порядок тут визначений, а не випадковий.
   *
   * Імена змінних лишаються `lena`/`dima` СВІДОМО й лише доти, доки
   * модуль не перейде на нейтральні ключі: `statusCounts`, `DayStatus`
   * і класи `--her`/`--him` носять ті самі два імені, і перейменувати
   * одне з чотирьох означало б розсинхронити їх між собою. Це названа
   * межа ADR-0209, а не забута дрібниця.
   */
  const [firstMember, secondMember] = users;
  /*
   * ПОРЯДОК → СЛОТ, І ЦЕЙ РЯДОК КОШТУВАВ ЗАМІРУ. Перша редакція написала
   * `const [lena, dima] = users` — за алфавітом здогаду. У базі ж
   * **id 1 — Діма, id 2 — Лєна** (перевірено запитом), тож ця редакція
   * поміняла б обидві доріжки Й обидва підписи місцями на живому екрані
   * власника. Типізація тут згодна на будь-який порядок: обидва — AppUser.
   *
   * Тому відображення назване прямо: перший член пари займає слот `--him`,
   * другий — `--her`. Для цієї пари це дає точно той самий екран, що й
   * раніше. Для нової пари порядок довільний, але СТАЛИЙ — рівно так само
   * чесно, як `resolveCrystalColorPartners` обирає кольори за порядком id,
   * коли імен не знає.
   */
  const dima = firstMember;
  const lena = secondMember;
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

  /*
   * «Те саме правило, що в календарній сітці» — і тепер це правда.
   *
   * Тут стояв власний прохід, який клав план ЛИШЕ на `start_date`, хоч
   * коментар поруч обіцяв правило сітки «Планів». Через це один і той
   * самий «Ремонт хати» малював риску під усіма тридцятьма днями вересня
   * в «Планах» і під жодним тут (аудит §4.2). Четвертий за місяць
   * коментар, що описував намір замість дії.
   *
   * Тепер обидва екрани питають одну функцію — `planOccupiesDate`, — і
   * розійтись їм більше нема на чому.
   *
   * Функція, а не Map: «Найближчі спільні дні» дивляться на дати, які
   * можуть лежати в ІНШОМУ місяці, ніж показана сітка. Map довелось би
   * заздалегідь будувати на невідомий наперед набір місяців — і саме там
   * зручно було б знову розійтись.
   */
  const plansOn = useCallback(
    (iso: string) => plansOnDate(allPlans, iso),
    [allPlans],
  );

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

  /*
   * Чию доріжку перемикає дотик. Типово — свою: саме свій графік
   * заповнюють щодня, а чужий правлять зрідка (і для цього поруч стоїть
   * другий чип, а не окремий режим).
   */
  const [laneUserId, setLaneUserId] = useState<number | null>(null);
  const activeLaneId = laneUserId ?? currentUser?.id ?? users[0]?.id ?? null;
  const toggleDay = (date: string) => {
    if (activeLaneId === null) return;
    const current = normalizeMark(marks[activeLaneId]?.[date]);
    scheduleMutation.mutate({ userId: activeLaneId, date, mark: nextMark(current) });
  };

  return (
    // Фон раніше приходив від обгортки хабу «Календар». Графік більше під
    // ним не живе — це власний розділ, тож він несе його сам, як і решта
    // розділів порталу.
    <section className="sched pink-page">
      <header className="sched-hero">
        {/*
          * «Заповнити місяць» — у слоті дії спільних дверей (ADR-0046).
          *
          * ПІДПИС ЗМІНИВСЯ РАЗОМ ІЗ РОЛЛЮ (ADR-0208). Кнопка вела в режим,
          * без якого не можна було поставити жодної мітки; тепер день
          * перемикається дотиком просто в сітці, а за цією кнопкою
          * лишилось те, чого дотик не вміє: шаблони «2 через 2», «3 через
          * 3», «Пн–Пт», копія з минулого місяця, очищення й вибір кількох
          * днів одразу. Тобто не «редагувати», а «заповнити гуртом».
          */}
        <PageHeader
          eyebrow="Календар пари"
          title="Графік"
          meta="Побачте, коли ви обоє вільні, та заплануйте час разом."
          action={(
            <button
              type="button"
              className={`sched-edit-compact${editMode ? ' is-active' : ''}`}
              onClick={toggleEditMode}
              aria-pressed={editMode}
            >
              {editMode ? 'Готово' : 'Заповнити місяць'}
            </button>
          )}
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
            {users.map((user) => <button key={user.id} type="button" role="tab" aria-selected={activeEditUser?.id === user.id} className={activeEditUser?.id === user.id ? 'is-active' : ''} onClick={() => changeEditUser(user.id)}>{user.displayName}</button>)}
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
          <ScheduleMonthOverview
            yr={yr}
            mo={mo}
            today={today}
            usersCount={users.length}
            statusCounts={statusCounts}
            statusOf={statusOf}
            plansOn={plansOn}
            marks={marks}
            users={users}
            lena={lena}
            dima={dima}
            editingUserId={activeLaneId}
            onPickUser={setLaneUserId}
            editable={activeLaneId !== null}
            selectedDate={selectedDate}
            /*
             * Дотик робить ДВІ речі одразу, і це навмисно: перемикає день
             * обраної доріжки й вибирає його. Перше — щоденна робота, друге
             * відкриває рядок деталей під сіткою. Так рідкісна дія дістає
             * повноширинні двері замість вгадування крапки в кутку.
             */
            onSelectDate={(date) => { toggleDay(date); setSelectedDate(date); }}
          />
          <ScheduleUpcoming sharedDates={sharedDates} plansOn={plansOn} onSelectDate={setSelectedDate} onPlan={openPlans} />
        </>
      )}

      {selectedDate && <ScheduleDayDetails date={selectedDate} status={selectedStatus} names={{ lena: lena?.name, dima: dima?.name }} plans={plansOn(selectedDate)} onClose={() => setSelectedDate(null)} onPlan={openPlans} />}
    </section>
  );
}
