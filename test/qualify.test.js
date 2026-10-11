import { test } from 'node:test';
import assert from 'node:assert/strict';
import { qualify } from '../src/rules/qualify.js';
import { checkServiceArea } from '../src/rules/serviceArea.js';

// A clean qualified lead; each test changes one thing.
const base = {
  call_type: 'new_enquiry',
  property_type: 'residential',
  locality: 'Baner',
  area_sqft: 1100,
  scope: 'full_home',
  wants_execution: true,
  out_of_scope_request: null,
  weeks_until_needed: 16,
  weeks_until_site_available: 2,
  budget_inr: null,
  is_decision_maker: true,
};
const lead = (o) => ({ ...base, ...o });

test('service area: listed, excluded, spelling variants, unknown', () => {
  assert.equal(checkServiceArea('Kothrud'), 'in');
  assert.equal(checkServiceArea('Hinjawadi Phase 2'), 'in');
  assert.equal(checkServiceArea('pimple-saudagar'), 'in');
  assert.equal(checkServiceArea('Talegaon'), 'out');
  assert.equal(checkServiceArea('Talegaon, Pune'), 'out');
  assert.equal(checkServiceArea('Andheri, Mumbai'), 'out');
  assert.equal(checkServiceArea('Lohegaon'), 'unknown');
  assert.equal(checkServiceArea(null), 'unknown');
});

test('clean full-home lead qualifies', () => {
  assert.deepEqual(qualify(base), { status: 'qualified', reasons: [], flags: [] });
});

test('non-enquiry calls become messages', () => {
  assert.equal(qualify(lead({ call_type: 'existing_client' })).status, 'message');
  assert.equal(qualify(lead({ call_type: 'vendor' })).status, 'message');
});

test('criterion 1: advice-only / DIY execution / out-of-scope services decline', () => {
  assert.equal(qualify(lead({ wants_execution: false })).status, 'declined');
  for (const r of ['decor_only', 'vastu_only', 'furniture_only', 'structural']) {
    assert.equal(qualify(lead({ out_of_scope_request: r })).status, 'declined', r);
  }
});

test('commercial: office ok, restaurant/retail/gym and >3000 sqft decline', () => {
  const office = lead({ property_type: 'commercial', commercial_kind: 'office', scope: 'office', area_sqft: 2500 });
  assert.equal(qualify(office).status, 'qualified');
  assert.equal(qualify({ ...office, commercial_kind: 'restaurant' }).status, 'declined');
  assert.equal(qualify({ ...office, commercial_kind: 'gym' }).status, 'declined');
  assert.equal(qualify({ ...office, area_sqft: 4500 }).status, 'declined');
});

test('criterion 2: outside area declines, unknown area goes to review', () => {
  assert.equal(qualify(lead({ locality: 'Nashik' })).status, 'declined');
  assert.equal(qualify(lead({ locality: 'Lohegaon' })).status, 'needs_review');
});

test('criterion 3: deadline under 6 weeks declines, 6–11 weeks flagged tight', () => {
  assert.equal(qualify(lead({ weeks_until_needed: 3 })).status, 'declined');
  const tight = qualify(lead({ weeks_until_needed: 8 }));
  assert.equal(tight.status, 'qualified');
  assert.ok(tight.flags.includes('tight_timeline'));
});

test('criterion 3: site not ready for months goes to nurture', () => {
  assert.equal(qualify(lead({ weeks_until_site_available: 32 })).status, 'nurture');
});

test('criterion 4: no budget mentioned = qualified; realistic budget = qualified', () => {
  assert.equal(qualify(lead({ budget_inr: null })).status, 'qualified');
  assert.equal(qualify(lead({ budget_inr: 2500000 })).status, 'qualified');
});

test('criterion 4: ₹1.5L for a full flat goes to budget review, not forwarded', () => {
  assert.equal(qualify(lead({ budget_inr: 150000 })).status, 'budget_review');
  assert.equal(qualify(lead({ budget_inr: 150000, area_sqft: null })).status, 'budget_review');
});

test('criterion 4: single room — ₹1L too low, ₹4L fine', () => {
  const room = lead({ scope: 'single_room', area_sqft: 200 });
  assert.equal(qualify({ ...room, budget_inr: 100000 }).status, 'budget_review');
  assert.equal(qualify({ ...room, budget_inr: 400000 }).status, 'qualified');
});

test('criterion 5: unclear decision-maker never declines, only flags', () => {
  const r = qualify(lead({ is_decision_maker: null }));
  assert.equal(r.status, 'qualified');
  assert.ok(r.flags.includes('decision_maker_unclear'));
});

test('missing timeline / real-project info goes to review', () => {
  assert.equal(qualify(lead({ weeks_until_needed: null, weeks_until_site_available: null })).status, 'needs_review');
  assert.equal(qualify(lead({ wants_execution: null })).status, 'needs_review');
});

test('does not disqualify: rented home, single room, unsure on style', () => {
  // These are not inputs to the rules at all — a single-room full-execution lead qualifies.
  assert.equal(qualify(lead({ scope: 'single_room', area_sqft: 180 })).status, 'qualified');
});
