// Telegram webhook: handles the "Accept lead" button.
import { db, q } from '../lib/db.js';
import { tg } from '../lib/telegram.js';
import { updateDeal } from '../lib/hubspot.js';

export default async function handler(req, res) {
  if (req.headers['x-telegram-bot-api-secret-token'] !== process.env.WEBHOOK_SECRET) return res.status(401).end();
  const cb = req.body?.callback_query;
  if (!cb?.data?.startsWith('accept:')) return res.json({ ok: true });

  const id = cb.data.slice('accept:'.length);
  const [call] = await q(db.from('calls').select('*').eq('id', id).limit(1));
  if (!call || call.designer_accepted_at) {
    await tg('answerCallbackQuery', { callback_query_id: cb.id, text: 'Already accepted.' });
    return res.json({ ok: true });
  }

  const now = new Date();
  const pickupMin = Math.round((now - new Date(call.processed_at || call.ended_at || now)) / 60000);
  const by = [cb.from.first_name, cb.from.last_name].filter(Boolean).join(' ');

  await q(db.from('calls').update({ designer_accepted_at: now.toISOString() }).eq('id', id));
  if (call.hubspot_deal_id) await updateDeal(call.hubspot_deal_id, { aangan_designer_pickup_min: pickupMin });

  await tg('answerCallbackQuery', { callback_query_id: cb.id, text: 'Lead accepted.' });
  await tg('editMessageReplyMarkup', { chat_id: cb.message.chat.id, message_id: cb.message.message_id, reply_markup: { inline_keyboard: [] } });
  await tg('sendMessage', {
    chat_id: cb.message.chat.id,
    reply_to_message_id: cb.message.message_id,
    text: `✅ Accepted by ${by} — ${pickupMin} min after the call.`,
  });
  res.json({ ok: true });
}
