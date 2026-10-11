// Dashboard numbers, computed from the calls table.
import { db, q } from './db.js';

const IST = 'Asia/Kolkata';
const istDay = (d) => new Date(d).toLocaleDateString('en-CA', { timeZone: IST });
const istHour = (d) => Number(new Date(d).toLocaleString('en-GB', { timeZone: IST, hour: '2-digit', hour12: false })) % 24;
const sum = (xs) => xs.reduce((a, b) => a + b, 0);
const median = (xs) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

export const OUTCOMES = ['qualified', 'needs_review', 'budget_review', 'nurture', 'declined', 'message'];

export async function getMetrics(days) {
  const since = new Date(Date.now() - days * 86400000).toISOString();
  const calls = await q(
    db.from('calls')
      .select('id, vaani_call_id, started_at, duration_sec, after_hours, call_type, outcome, flags, caller_name, extracted, consultation_at, processed_at, designer_accepted_at, cost_voice_inr, cost_llm_inr, guardrail_breach, designers(name)')
      .not('processed_at', 'is', null)
      .gte('started_at', since)
      .order('started_at', { ascending: false })
  );

  const cost = (c) => Number(c.cost_voice_inr) + Number(c.cost_llm_inr);
  const enquiries = calls.filter((c) => c.call_type === 'new_enquiry');
  const qualified = calls.filter((c) => c.outcome === 'qualified');
  const booked = calls.filter((c) => c.consultation_at);
  const pickups = calls
    .filter((c) => c.designer_accepted_at && c.processed_at)
    .map((c) => (new Date(c.designer_accepted_at) - new Date(c.processed_at)) / 60000);
  const totalCost = sum(calls.map(cost));

  // One bucket per IST day in range, so empty days still show.
  const byDay = [];
  for (let i = days - 1; i >= 0; i--) {
    const day = istDay(Date.now() - i * 86400000);
    const dayCalls = calls.filter((c) => istDay(c.started_at) === day);
    byDay.push({ day, calls: dayCalls.length, booked: dayCalls.filter((c) => c.consultation_at).length, cost: sum(dayCalls.map(cost)) });
  }

  const byHour = Array.from({ length: 24 }, (_, h) => ({ hour: h, calls: 0, afterHours: h < 10 || h >= 19 }));
  for (const c of calls) byHour[istHour(c.started_at)].calls++;

  return {
    days,
    generatedAt: new Date().toISOString(),
    kpis: {
      calls: calls.length,
      enquiries: enquiries.length,
      afterHours: calls.filter((c) => c.after_hours).length,
      qualified: qualified.length,
      booked: booked.length,
      bookingRate: enquiries.length ? booked.length / enquiries.length : null,
      medianPickupMin: median(pickups),
      unaccepted: qualified.filter((c) => !c.designer_accepted_at).length,
      totalCost,
      costPerCall: calls.length ? totalCost / calls.length : null,
      costPerBooked: booked.length ? totalCost / booked.length : null,
      avgCallMin: calls.length ? sum(calls.map((c) => Number(c.duration_sec) || 0)) / calls.length / 60 : null,
      breaches: calls.filter((c) => c.guardrail_breach).length,
    },
    outcomes: OUTCOMES.map((o) => ({ outcome: o, calls: calls.filter((c) => c.outcome === o).length })),
    byDay,
    byHour,
    recent: calls.slice(0, 25).map((c) => ({
      at: c.started_at,
      caller: c.caller_name,
      locality: c.extracted?.locality || null,
      outcome: c.outcome,
      booked: c.consultation_at,
      designer: c.designers?.name || null,
      accepted: !!c.designer_accepted_at,
      cost: cost(c),
      breach: c.guardrail_breach,
      afterHours: c.after_hours,
    })),
  };
}
