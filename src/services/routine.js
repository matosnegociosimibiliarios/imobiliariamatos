const ACTIVE_LEAD_STATUSES = new Set([
  'new',
  'contacted',
  'qualified',
  'visit_scheduled',
  'proposal',
]);

const ACTIVE_CAPTURE_STATUSES = new Set([
  'new',
  'evaluation',
  'documents',
  'authorized',
]);

function startOfDay(date = new Date()) {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
}

function addDays(date, days) {
  const value = new Date(date);
  value.setDate(value.getDate() + days);
  return value;
}

function validDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function latestLeadActivity(lead) {
  return (
    validDate(lead.last_message_at) ||
    validDate(lead.last_inbound_at) ||
    validDate(lead.last_outbound_at) ||
    validDate(lead.updated_at) ||
    validDate(lead.created_at)
  );
}

function daysWithoutActivity(item, kind, now = new Date()) {
  const reference = kind === 'lead'
    ? latestLeadActivity(item)
    : validDate(item.updated_at) || validDate(item.created_at);

  if (!reference) return 0;
  return Math.max(0, Math.floor((now.getTime() - reference.getTime()) / 86400000));
}

function appointmentDate(item) {
  const scheduled = validDate(item.scheduled_at);
  if (scheduled) return scheduled;

  if (item.requested_date) {
    const time = item.requested_time || '09:00:00';
    const date = new Date(`${item.requested_date}T${time}`);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  return null;
}

export function buildRoutine(data = {}, nowValue = new Date()) {
  const leads = data.leads || [];
  const captures = data.captures || [];
  const appointments = data.appointments || [];
  const now = new Date(nowValue);
  const today = startOfDay(now);
  const tomorrow = addDays(today, 1);
  const eightDays = addDays(today, 8);

  const actionItems = [
    ...leads
      .filter((item) => ACTIVE_LEAD_STATUSES.has(item.status) && item.next_action_at)
      .map((item) => ({ ...item, kind: 'lead', label: item.name || 'Cliente' })),
    ...captures
      .filter((item) => ACTIVE_CAPTURE_STATUSES.has(item.status) && item.next_action_at)
      .map((item) => ({ ...item, kind: 'capture', label: item.owner_name || 'Proprietário' })),
  ].sort((a, b) => new Date(a.next_action_at) - new Date(b.next_action_at));

  const overdue = actionItems.filter((item) => {
    const due = validDate(item.next_action_at);
    return due && due < now;
  });

  const todayActions = actionItems.filter((item) => {
    const due = validDate(item.next_action_at);
    return due && due >= now && due < tomorrow;
  });

  const nextSevenDays = actionItems.filter((item) => {
    const due = validDate(item.next_action_at);
    return due && due >= tomorrow && due < eightDays;
  });

  const noNextAction = [
    ...leads
      .filter((item) => ACTIVE_LEAD_STATUSES.has(item.status) && !item.next_action_at)
      .map((item) => ({
        ...item,
        kind: 'lead',
        label: item.name || 'Cliente',
        idle_days: daysWithoutActivity(item, 'lead', now),
      })),
    ...captures
      .filter((item) => ACTIVE_CAPTURE_STATUSES.has(item.status) && !item.next_action_at)
      .map((item) => ({
        ...item,
        kind: 'capture',
        label: item.owner_name || 'Proprietário',
        idle_days: daysWithoutActivity(item, 'capture', now),
      })),
  ].sort((a, b) => b.idle_days - a.idle_days);

  const stale = noNextAction.filter((item) => item.idle_days >= 2);

  const visitsToday = appointments
    .filter((item) => !['completed', 'cancelled', 'no_show'].includes(item.status))
    .map((item) => ({ ...item, routine_date: appointmentDate(item) }))
    .filter((item) => item.routine_date && item.routine_date >= today && item.routine_date < tomorrow)
    .sort((a, b) => a.routine_date - b.routine_date);

  const upcomingVisits = appointments
    .filter((item) => !['completed', 'cancelled', 'no_show'].includes(item.status))
    .map((item) => ({ ...item, routine_date: appointmentDate(item) }))
    .filter((item) => item.routine_date && item.routine_date >= tomorrow && item.routine_date < eightDays)
    .sort((a, b) => a.routine_date - b.routine_date);

  const proposals = leads
    .filter((item) => item.status === 'proposal')
    .sort((a, b) => {
      const left = latestLeadActivity(a)?.getTime() || 0;
      const right = latestLeadActivity(b)?.getTime() || 0;
      return left - right;
    });

  return {
    overdue,
    todayActions,
    nextSevenDays,
    noNextAction,
    stale,
    visitsToday,
    upcomingVisits,
    proposals,
    counts: {
      overdue: overdue.length,
      today: todayActions.length,
      visits: visitsToday.length,
      stale: stale.length,
      no_next_action: noNextAction.length,
      proposals: proposals.length,
    },
  };
}

export function nextBusinessMoment(days = 1) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(9, 0, 0, 0);
  return date.toISOString();
}
