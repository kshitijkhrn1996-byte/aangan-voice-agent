// Vaani custom tool: get_available_slots — called mid-call once the caller qualifies.
import { db } from '../../lib/db.js';
import { authorised, toolArgs, callIdOf } from '../../lib/http.js';
import { calendar } from '../../lib/calendar.js';
import { pickDesigner } from '../../lib/designers.js';
import { checkServiceArea } from '../../src/rules/serviceArea.js';

export default async function handler(req, res) {
  if (!authorised(req)) return res.status(401).json({ error: 'unauthorised' });
  const args = toolArgs(req.body);
  await db.from('webhook_events').insert({ vaani_call_id: callIdOf(req.body), event_type: 'tool:get_available_slots', payload: req.body ?? {} });

  if (checkServiceArea(args.locality) === 'out') {
    return res.json({
      available: false,
      instruction: 'This locality is outside our service area (Pune city and PCMC). Politely explain and do not book.',
    });
  }

  try {
    const designer = await pickDesigner(args);
    const { slots } = await calendar('slots', { calendar_id: designer.calendar_id, count: 3 });
    if (!slots.length) {
      return res.json({ available: false, instruction: 'No free slots this week. Take their preferred time; the team will call back to confirm.' });
    }
    res.json({
      available: true,
      designer_id: designer.id,
      designer_name: designer.name.split(' ')[0],
      slots,
      instruction: `Offer these times using the "say" text. When the caller picks one, call aangan_book_consult with designer_id and that slot's start_iso.`,
    });
  } catch (err) {
    console.error(err);
    res.json({ available: false, instruction: 'The calendar is unavailable right now. Take their preferred day and time; the team will confirm by email.' });
  }
}
