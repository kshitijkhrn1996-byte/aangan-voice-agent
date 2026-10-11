// Shared request helpers for the Vercel functions.

export function authorised(req) {
  const key = req.headers['x-aangan-key'] || req.query?.key;
  return key && key === process.env.WEBHOOK_SECRET;
}

// Vaani's custom-tool body shape isn't documented; accept the arguments
// at the top level or nested under a common wrapper key.
export function toolArgs(body = {}) {
  for (const k of ['arguments', 'args', 'parameters', 'params', 'input']) {
    if (body[k] && typeof body[k] === 'object') return { ...body, ...body[k] };
    if (typeof body[k] === 'string') {
      try { return { ...body, ...JSON.parse(body[k]) }; } catch {}
    }
  }
  return body;
}

export function callIdOf(body = {}) {
  return body.call_id || body.callId || body.data?.call_id || body.session_id || body.room_name || null;
}
