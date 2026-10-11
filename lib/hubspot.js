const API = 'https://api.hubapi.com';

async function hs(method, path, body) {
  const res = await fetch(API + path, {
    method,
    headers: { Authorization: `Bearer ${process.env.HUBSPOT_TOKEN}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`hubspot ${method} ${path} → ${res.status}: ${data.message || ''}`);
  return data;
}

// Find a contact by email, then phone; create one if neither matches.
export async function upsertContact({ name, email, phone }) {
  const [firstname, ...rest] = (name || 'Unknown caller').split(' ');
  const props = { firstname, lastname: rest.join(' ') || undefined, email: email || undefined, phone: phone || undefined };

  for (const [prop, value] of [['email', email], ['phone', phone]]) {
    if (!value) continue;
    const found = await hs('POST', '/crm/v3/objects/contacts/search', {
      filterGroups: [{ filters: [{ propertyName: prop, operator: 'EQ', value }] }],
      limit: 1,
    });
    if (found.results[0]) {
      await hs('PATCH', `/crm/v3/objects/contacts/${found.results[0].id}`, { properties: props });
      return found.results[0].id;
    }
  }
  return (await hs('POST', '/crm/v3/objects/contacts', { properties: props })).id;
}

const STAGE = {
  booked: process.env.HUBSPOT_STAGE_BOOKED,
  qualified: process.env.HUBSPOT_STAGE_QUALIFIED,
  declined: process.env.HUBSPOT_STAGE_LOST,
};

export async function createDeal({ contactId, dealname, outcome, booked, properties }) {
  const stage = booked ? STAGE.booked : STAGE[outcome] || process.env.HUBSPOT_STAGE_NEW;
  const deal = await hs('POST', '/crm/v3/objects/deals', {
    properties: { dealname, pipeline: process.env.HUBSPOT_PIPELINE_ID, dealstage: stage, ...properties },
    associations: contactId
      ? [{ to: { id: contactId }, types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 3 }] }]
      : [],
  });
  return deal.id;
}

export const updateDeal = (id, properties) => hs('PATCH', `/crm/v3/objects/deals/${id}`, { properties });
