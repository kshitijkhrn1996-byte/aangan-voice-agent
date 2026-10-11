// Client for the Apps Script calendar bridge (apps-script/CalendarBridge.gs).

export async function calendar(action, body = {}) {
  const res = await fetch(process.env.CALENDAR_BRIDGE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' }, // avoids a CORS preflight Apps Script can't answer
    body: JSON.stringify({ secret: process.env.WEBHOOK_SECRET, action, ...body }),
    redirect: 'follow',
  });
  const data = await res.json();
  if (!data.ok && data.error !== 'slot_taken') throw new Error(`calendar ${action}: ${data.error}`);
  return data;
}
