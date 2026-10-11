// Vaani custom tool: book_consultation — books the slot the caller picked.
import { db, q } from '../../lib/db.js';
import { authorised, toolArgs, callIdOf } from '../../lib/http.js';
import { calendar } from '../../lib/calendar.js';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default async function handler(req, res) {
  if (!authorised(req)) return res.status(401).json({ error: 'unauthorised' });
  const args = toolArgs(req.body);
  const callId = callIdOf(req.body);
  await db.from('webhook_events').insert({ vaani_call_id: callId, event_type: 'tool:book_consultation', payload: req.body ?? {} });

  try {
    const [designer] = await q(db.from('designers').select('*').eq('id', args.designer_id).limit(1));
    if (!designer) return res.json({ booked: false, instruction: 'Call check_slots again, then retry the booking.' });

    const email = EMAIL.test(args.caller_email || '') ? args.caller_email.trim() : null;
    const result = await calendar('book', {
      calendar_id: designer.calendar_id,
      start_iso: args.slot_start,
      title: `Aangan Studio – Design Consultation with ${args.caller_name || 'caller'}`,
      description: [
        `Caller: ${args.caller_name || ''} ${args.caller_phone || ''}`,
        `Locality: ${args.locality || ''}`,
        `Project: ${args.project_summary || ''}`,
        `Designer: ${designer.name}`,
      ].join('\n'),
      guest_email: email,
    });

    if (!result.ok && result.error === 'slot_taken') {
      const { slots } = await calendar('slots', { calendar_id: designer.calendar_id, count: 2 });
      return res.json({ booked: false, alternatives: slots, instruction: 'That time was just taken. Apologise and offer these alternatives.' });
    }

    await q(db.from('bookings').insert({
      vaani_call_id: callId,
      designer_id: designer.id,
      start_at: args.slot_start,
      caller_name: args.caller_name,
      caller_email: email,
      caller_phone: args.caller_phone,
      locality: args.locality,
      calendar_event_id: result.event_id,
    }));

    res.json({
      booked: true,
      when: result.say,
      instruction: email
        ? `Confirm the consultation for ${result.say} with ${designer.name.split(' ')[0]}. Say a calendar invite has been emailed to ${email}.`
        : `Confirm the consultation for ${result.say} with ${designer.name.split(' ')[0]}. Say the designer will call to confirm, since we have no email.`,
    });
  } catch (err) {
    console.error(err);
    res.json({ booked: false, instruction: 'Booking failed. Note their preferred time and say the team will confirm by phone shortly.' });
  }
}
