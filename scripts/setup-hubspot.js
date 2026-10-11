// One-time HubSpot setup: "Aangan – Enquiries" deal pipeline + aangan_* deal properties.
// Safe to re-run: skips anything that already exists.
// Run: node --env-file=.env scripts/setup-hubspot.js

const TOKEN = process.env.HUBSPOT_TOKEN;
const API = 'https://api.hubapi.com';

async function hs(method, path, body) {
  const res = await fetch(API + path, {
    method,
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${data.message || JSON.stringify(data)}`);
  return data;
}

export const PIPELINE_LABEL = 'Aangan – Enquiries';
export const STAGES = [
  ['New enquiry', '0.05'],
  ['AI qualified', '0.15'],
  ['Consultation booked', '0.25'],
  ['Designer called', '0.35'],
  ['Site visit', '0.5'],
  ['Proposal sent', '0.7'],
  ['Won', '1.0'],
  ['Lost', '0.0'],
];

const GROUP = 'aangan_voice_agent';

const OUTCOMES = ['qualified', 'declined', 'nurture', 'budget_review', 'needs_review', 'message'];
const enumOpts = (vals) => vals.map((v, i) => ({ label: v, value: v, displayOrder: i }));

const PROPS = [
  ['aangan_call_id', 'Aangan: call ID', 'string', 'text'],
  ['aangan_outcome', 'Aangan: AI outcome', 'enumeration', 'select', enumOpts(OUTCOMES)],
  ['aangan_reasons', 'Aangan: outcome reasons', 'string', 'text'],
  ['aangan_flags', 'Aangan: flags for designer', 'string', 'text'],
  ['aangan_property_type', 'Aangan: property type', 'enumeration', 'select', enumOpts(['residential', 'commercial'])],
  ['aangan_scope', 'Aangan: scope', 'string', 'text'],
  ['aangan_locality', 'Aangan: locality', 'string', 'text'],
  ['aangan_area_sqft', 'Aangan: carpet area (sq ft)', 'number', 'number'],
  ['aangan_timeline', 'Aangan: timeline', 'string', 'text'],
  ['aangan_budget_inr', 'Aangan: budget volunteered (INR)', 'number', 'number'],
  ['aangan_site_condition', 'Aangan: site condition notes', 'string', 'textarea'],
  ['aangan_source', 'Aangan: how they heard of us', 'string', 'text'],
  ['aangan_summary', 'Aangan: handoff summary', 'string', 'textarea'],
  ['aangan_consultation_at', 'Aangan: consultation time', 'datetime', 'date'],
  ['aangan_designer', 'Aangan: assigned designer', 'string', 'text'],
  ['aangan_designer_pickup_min', 'Aangan: designer pickup (minutes)', 'number', 'number'],
  ['aangan_recording_url', 'Aangan: call recording', 'string', 'text'],
  ['aangan_call_duration_sec', 'Aangan: call duration (sec)', 'number', 'number'],
  ['aangan_call_cost_inr', 'Aangan: call cost (INR)', 'number', 'number'],
  ['aangan_after_hours', 'Aangan: after hours call', 'enumeration', 'booleancheckbox', enumOpts(['true', 'false'])],
  ['aangan_guardrail_breach', 'Aangan: guardrail breach', 'enumeration', 'booleancheckbox', enumOpts(['true', 'false'])],
];

async function ensurePipeline() {
  const { results } = await hs('GET', '/crm/v3/pipelines/deals');
  const found = results.find((p) => p.label === PIPELINE_LABEL);
  if (found) return console.log(`pipeline exists: ${found.id}`), found;
  const created = await hs('POST', '/crm/v3/pipelines/deals', {
    label: PIPELINE_LABEL,
    displayOrder: results.length,
    stages: STAGES.map(([label, probability], i) => ({ label, displayOrder: i, metadata: { probability } })),
  });
  console.log(`pipeline created: ${created.id}`);
  return created;
}

async function ensureProperties() {
  const groups = await hs('GET', '/crm/v3/properties/deals/groups');
  if (!groups.results.some((g) => g.name === GROUP)) {
    await hs('POST', '/crm/v3/properties/deals/groups', { name: GROUP, label: 'Aangan Voice Agent' });
    console.log('property group created');
  }
  const existing = new Set((await hs('GET', '/crm/v3/properties/deals')).results.map((p) => p.name));
  for (const [name, label, type, fieldType, options] of PROPS) {
    if (existing.has(name)) continue;
    await hs('POST', '/crm/v3/properties/deals', { name, label, type, fieldType, groupName: GROUP, options });
    console.log(`property created: ${name}`);
  }
}

const pipeline = await ensurePipeline();
await ensureProperties();
console.log('\nHUBSPOT_PIPELINE_ID=' + pipeline.id);
for (const s of pipeline.stages.sort((a, b) => a.displayOrder - b.displayOrder)) console.log(`  ${s.label}: ${s.id}`);
