// Post-call pipeline: transcript → Gemini analysis → rules → HubSpot → Telegram → call log.
import { db, q } from './db.js';
import { analyseCall } from './gemini.js';
import { qualify } from '../src/rules/qualify.js';
import { upsertContact, createDeal } from './hubspot.js';
import { send, esc } from './telegram.js';

const VAANI_INR_PER_MIN = Number(process.env.VAANI_INR_PER_MIN || 5);

export function transcriptText(t) {
  if (typeof t === 'string') return t;
  if (!Array.isArray(t)) return JSON.stringify(t ?? '');
  return t
    .map((m) => `${m.role || m.speaker || m.from || '?'}: ${m.content || m.text || m.message || ''}`)
    .join('\n');
}

function istHour(date) {
  return Number(new Date(date).toLocaleString('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', hour12: false }));
}

const fmtIST = (d) => new Date(d).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' });

export async function processCall(callId, data) {
  const [call] = await q(db.from('calls').select('*').eq('vaani_call_id', callId).limit(1));
  const startedAt = call?.started_at || new Date(Date.now() - (data.call_duration || 0)).toISOString();
  const durationSec = data.call_duration ? Number(data.call_duration) / 1000 : call?.duration_sec || 0;

  const analysis = await analyseCall(transcriptText(data.transcript));
  const lead = analysis.lead || {};
  const result = qualify(lead);

  // Booking made live during this call (matched by call id, else by time window).
  let [booking] = await q(db.from('bookings').select('*').eq('vaani_call_id', callId).limit(1));
  if (!booking) {
    [booking] = await q(
      db.from('bookings').select('*').is('call_id', null)
        .gte('created_at', new Date(new Date(startedAt).getTime() - 60_000).toISOString())
        .order('created_at', { ascending: false }).limit(1)
    );
  }
  const [designer] = booking
    ? await q(db.from('designers').select('*').eq('id', booking.designer_id).limit(1))
    : [];

  const callerName = lead.caller_name || booking?.caller_name || null;
  const callerEmail = lead.caller_email || booking?.caller_email || null;
  const callerPhone = call?.caller_number || booking?.caller_phone || null;
  const afterHours = istHour(startedAt) < 10 || istHour(startedAt) >= 19;
  const costVoice = (durationSec / 60) * VAANI_INR_PER_MIN;
  const costTotal = costVoice + analysis.cost_inr;

  // HubSpot — enquiries only; plain messages go to Telegram.
  let contactId = null;
  let dealId = null;
  if (lead.call_type === 'new_enquiry') {
    contactId = await upsertContact({ name: callerName, email: callerEmail, phone: callerPhone });
    dealId = await createDeal({
      contactId,
      dealname: `Aangan – ${callerName || callerPhone || 'Caller'} – ${lead.locality || 'unknown area'}`,
      outcome: result.status,
      booked: !!booking,
      properties: {
        aangan_call_id: callId,
        aangan_outcome: result.status,
        aangan_reasons: result.reasons.join(', '),
        aangan_flags: result.flags.join(', '),
        aangan_property_type: lead.property_type || undefined,
        aangan_scope: [lead.scope, lead.rooms].filter(Boolean).join(' – ') || undefined,
        aangan_locality: lead.locality || undefined,
        aangan_area_sqft: lead.area_sqft ?? undefined,
        aangan_timeline: lead.timeline_text || undefined,
        aangan_budget_inr: lead.budget_inr ?? undefined,
        aangan_site_condition: lead.site_condition || undefined,
        aangan_source: lead.source || undefined,
        aangan_summary: analysis.handoff_summary,
        aangan_consultation_at: booking ? new Date(booking.start_at).getTime() : undefined,
        aangan_designer: designer?.name,
        aangan_recording_url: data.recording_url || undefined,
        aangan_call_duration_sec: Math.round(durationSec),
        aangan_call_cost_inr: Number(costTotal.toFixed(2)),
        aangan_after_hours: String(afterHours),
        aangan_guardrail_breach: String(!!analysis.guardrail?.breach),
      },
    });
  }

  const [row] = await q(
    db.from('calls').upsert({
      vaani_call_id: callId,
      caller_number: callerPhone,
      started_at: startedAt,
      ended_at: call?.ended_at || new Date().toISOString(),
      duration_sec: durationSec,
      after_hours: afterHours,
      call_type: lead.call_type,
      outcome: result.status,
      reasons: result.reasons,
      flags: result.flags,
      extracted: lead,
      summary: analysis.handoff_summary,
      transcript: data.transcript ?? null,
      recording_url: data.recording_url || null,
      caller_name: callerName,
      caller_email: callerEmail,
      consultation_at: booking?.start_at || null,
      calendar_event_id: booking?.calendar_event_id || null,
      designer_id: designer?.id || null,
      hubspot_contact_id: contactId,
      hubspot_deal_id: dealId,
      cost_voice_inr: costVoice,
      cost_llm_inr: analysis.cost_inr,
      guardrail_breach: !!analysis.guardrail?.breach,
      guardrail_notes: analysis.guardrail?.notes || null,
      processed_at: new Date().toISOString(),
    }, { onConflict: 'vaani_call_id' }).select()
  );
  if (booking) await q(db.from('bookings').update({ call_id: row.id }).eq('id', booking.id));

  await notify({ row, lead, result, booking, designer, summary: analysis.handoff_summary });
  if (analysis.guardrail?.breach) {
    await send(`⚠️ <b>Guardrail breach</b> on call ${esc(callId)}\n${esc(analysis.guardrail.notes)}`);
  }
  return { outcome: result.status, dealId };
}

async function notify({ row, lead, result, booking, designer, summary }) {
  const who = `<b>${esc(row.caller_name || 'Unknown caller')}</b> ${esc(row.caller_number || '')}`;
  const details = [
    lead.property_type && `🏠 ${esc(lead.property_type)} · ${esc(lead.scope || '')} ${esc(lead.rooms || '')}`,
    lead.locality && `📍 ${esc(lead.locality)}${lead.area_sqft ? ` · ${lead.area_sqft} sq ft` : ''}`,
    lead.timeline_text && `⏱ ${esc(lead.timeline_text)}`,
    lead.budget_inr && `💰 Budget mentioned: ₹${Number(lead.budget_inr).toLocaleString('en-IN')}`,
    lead.site_condition && `🧱 ${esc(lead.site_condition)}`,
    result.flags.length && `🚩 ${esc(result.flags.join(', '))}`,
  ].filter(Boolean).join('\n');

  if (result.status === 'message') {
    return send(`${lead.urgent ? '🔴' : '📩'} Call logged (${esc(lead.call_type)})\n${who}\n${esc(lead.message_for_team || summary)}`);
  }
  if (result.status === 'declined') return; // dashboard only

  const head = {
    qualified: booking
      ? `🟢 <b>Consultation booked</b> — ${esc(fmtIST(booking.start_at))} with ${esc(designer?.name || '')}`
      : '🟢 <b>Qualified lead</b> — not booked yet, please call back',
    needs_review: '🟡 <b>Needs a human</b> — some details unclear',
    budget_review: '🟡 <b>Budget review</b> — volunteered budget looks too low',
    nurture: '🔵 <b>Not now</b> — site not ready yet, follow up later',
  }[result.status];

  const msg = await send(`${head}\n${who}\n${details}\n\n${esc(summary)}${row.recording_url ? `\n\n<a href="${esc(row.recording_url)}">▶ Recording</a>` : ''}`, {
    reply_markup: result.status === 'qualified' ? { inline_keyboard: [[{ text: '✅ Accept lead', callback_data: `accept:${row.id}` }]] } : undefined,
  });
  await q(db.from('calls').update({ telegram_message_id: msg.message_id }).eq('id', row.id));
}
