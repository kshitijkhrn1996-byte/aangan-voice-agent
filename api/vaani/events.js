// Vaani webhook receiver. Logs every event raw, tracks call start/end,
// and runs the post-call pipeline on call_postprocessing.
import { db, q } from '../../lib/db.js';
import { authorised } from '../../lib/http.js';
import { processCall } from '../../lib/processCall.js';
import { send, esc } from '../../lib/telegram.js';

export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  if (!authorised(req)) return res.status(401).json({ error: 'unauthorised' });
  const body = req.body || {};
  const event = body.event || body.event_type || body.type;
  const data = body.data || body;
  const callId = body.call_id || data.call_id;

  await db.from('webhook_events').insert({ vaani_call_id: callId, event_type: event, payload: body });

  try {
    if (event === 'call_started' && callId) {
      await q(db.from('calls').upsert(
        { vaani_call_id: callId, caller_number: body.phone_number || data.phone_number || null, started_at: new Date().toISOString() },
        { onConflict: 'vaani_call_id' }
      ));
    } else if (event === 'call_ended' && callId) {
      await q(db.from('calls').upsert(
        { vaani_call_id: callId, ended_at: new Date().toISOString(), duration_sec: Number(body.call_duration || data.call_duration || 0) },
        { onConflict: 'vaani_call_id' }
      ));
    } else if (event === 'call_postprocessing' && callId) {
      await processCall(callId, data);
    }
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    await send(`❗ Pipeline error on call ${esc(callId)}: ${esc(err.message)}`).catch(() => {});
    res.json({ ok: false });
  }
}
