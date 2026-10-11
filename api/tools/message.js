// Vaani custom tool: take_message — existing clients, vendors, "call me back", etc.
// Posted to Telegram immediately; the post-call pipeline logs it too.
import { db } from '../../lib/db.js';
import { authorised, toolArgs, callIdOf } from '../../lib/http.js';
import { send, esc } from '../../lib/telegram.js';

export default async function handler(req, res) {
  if (!authorised(req)) return res.status(401).json({ error: 'unauthorised' });
  const a = toolArgs(req.body);
  await db.from('webhook_events').insert({ vaani_call_id: callIdOf(req.body), event_type: 'tool:take_message', payload: req.body ?? {} });

  try {
    await send(
      `${a.urgent ? '🔴 URGENT message' : '📩 Message'} (${esc(a.call_type || 'other')})\n` +
      `<b>${esc(a.caller_name || 'Unknown')}</b> ${esc(a.caller_phone || '')}\n` +
      `${esc(a.message || '')}`
    );
    res.json({ ok: true, instruction: 'Tell the caller the team has their message and will call back.' });
  } catch (err) {
    console.error(err);
    res.json({ ok: true, instruction: 'Tell the caller the team will call back.' });
  }
}
