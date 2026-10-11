// Sets the agent's three custom tools (registered in the Vaani dashboard, ids below)
// with their URLs and auth header, replacing any others.
// Run: node --env-file=.env scripts/push-tools.js

const BASE = process.env.BACKEND_URL;
const config = (path) => ({
  api_endpoint: `${BASE}${path}`,
  method: 'POST',
  timeout_ms: 15000,
  headers: { 'x-aangan-key': process.env.WEBHOOK_SECRET },
  query_params: {},
  store_variables: {},
});

const str = (description) => ({ type: 'string', description });

const TOOLS = [
  {
    id: '98dba053-f74f-4ede-adc1-946999aba061',
    function_name: 'check_slots',
    description: 'Get the next free design-consultation slots. Call ONLY after the caller qualifies (real design and execution project, in Pune or PCMC, workable timeline). Returns designer_id and slots, each with start_iso and a "say" text to read out.',
    function_params: {
      type: 'object',
      properties: {
        locality: str("Caller's locality or area, e.g. Baner"),
        property_type: str('residential or commercial'),
      },
      required: ['locality', 'property_type'],
    },
    config_params: config('/api/tools/slots'),
  },
  {
    id: '8afc3605-c754-4e5e-93e3-d20e135f4d67',
    function_name: 'aangan_book_consult',
    description: "Book the consultation slot the caller chose. Spell the caller's email back and get a yes before calling. Returns booked true/false and an instruction to follow.",
    function_params: {
      type: 'object',
      properties: {
        designer_id: str('designer_id returned by check_slots'),
        slot_start: str('start_iso of the slot the caller chose'),
        caller_name: str("Caller's full name"),
        caller_email: str("Caller's email, confirmed by spelling back"),
        caller_phone: str("Caller's phone number if given"),
        locality: str("Caller's locality"),
        project_summary: str('One line: property, size, scope, timeline'),
      },
      required: ['designer_id', 'slot_start', 'caller_name'],
    },
    config_params: config('/api/tools/book'),
  },
  {
    id: '8c614ca7-155b-4c00-bdc1-402624e334ac',
    function_name: 'aangan_leave_message',
    description: 'Pass a message to the studio team: existing clients, vendors, job seekers, callback requests, future projects, language callbacks, or when the caller asks for a person.',
    function_params: {
      type: 'object',
      properties: {
        caller_name: str("Caller's name"),
        caller_phone: str("Caller's phone number"),
        call_type: str('existing_client, vendor, job_seeker, language_callback, future_project, callback_request or other'),
        message: str('The message for the team'),
        urgent: { type: 'boolean', description: 'true if the caller is upset or it is time-critical' },
      },
      required: ['message'],
    },
    config_params: config('/api/tools/message'),
  },
].map((t) => ({ ...t, function_id: t.id, function_type: 'custom', is_custom: true, is_active: true }));

const res = await fetch(`https://api.vaanivoice.ai/api/agent/${process.env.VAANI_AGENT_ID}/persona`, {
  method: 'PATCH',
  headers: { 'X-API-Key': process.env.VAANI_API_KEY, 'Content-Type': 'application/json' },
  body: JSON.stringify({ actions: { functions: TOOLS } }),
});
const data = await res.json();
if (!res.ok) throw new Error(`${res.status}: ${JSON.stringify(data).slice(0, 400)}`);
const fns = data.persona?.actions?.functions || [];
console.log(`attached: ${fns.length}`, fns.map((f) => f.function_name || f.name));
