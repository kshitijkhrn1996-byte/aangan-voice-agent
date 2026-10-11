// Qualification rules from qualified.md + services.md, with the working
// defaults agreed while Nikhil's answers are pending:
//   - Hard criteria (1 real project, 2 area, 3 timeline): one clear fail = decline.
//   - Soft criteria (4 budget, 5 decision-maker): never decline on their own.
//   - Deadline < 6 weeks = decline; 6–11 weeks = qualified but flagged tight.
//   - Site not available within 10 weeks = nurture (not now), not decline.

import { checkServiceArea } from './serviceArea.js';

export const MIN_DEADLINE_WEEKS = 6;
export const TIGHT_DEADLINE_WEEKS = 11; // design 3–4 wks + execution from 8 wks
export const MAX_SITE_WAIT_WEEKS = 10;
export const MAX_COMMERCIAL_SQFT = 3000;

// Floors from pricing.md. Used only to spot volunteered budgets that are
// clearly too low; never spoken to the caller.
const FLOOR_PER_SQFT = { residential: 1800, commercial: 1200 };
const SINGLE_ROOM_FLOOR = 350000;
const DEFAULT_FULL_HOME_SQFT = 600; // smallest 2BHK carpet area, when size unknown
const CLEARLY_BELOW = 0.8; // "clearly below" = under 80% of the floor

const EXCLUDED_COMMERCIAL = ['retail', 'restaurant', 'hotel', 'gym'];
const OUT_OF_SCOPE_REQUESTS = ['decor_only', 'vastu_only', 'furniture_only', 'structural', 'architecture'];

export function budgetFloor(lead) {
  if (lead.scope === 'single_room') return SINGLE_ROOM_FLOOR;
  const rate = FLOOR_PER_SQFT[lead.property_type];
  if (!rate) return null;
  const sqft = lead.area_sqft ?? (lead.scope === 'full_home' ? DEFAULT_FULL_HOME_SQFT : null);
  return sqft ? sqft * rate : null;
}

// Returns { status, reasons[], flags[] }
// status: qualified | declined | nurture | budget_review | needs_review | message
export function qualify(lead) {
  if (lead.call_type && lead.call_type !== 'new_enquiry') {
    return { status: 'message', reasons: [`call_type:${lead.call_type}`], flags: [] };
  }

  const fails = [];
  const unclear = [];
  const flags = [];

  // Criterion 1: real project within what the studio does
  if (OUT_OF_SCOPE_REQUESTS.includes(lead.out_of_scope_request)) fails.push(`c1_scope:${lead.out_of_scope_request}`);
  if (lead.wants_execution === false) fails.push('c1_no_execution');
  if (lead.property_type === 'commercial') {
    if (EXCLUDED_COMMERCIAL.includes(lead.commercial_kind)) fails.push(`c1_commercial:${lead.commercial_kind}`);
    if (lead.area_sqft > MAX_COMMERCIAL_SQFT) fails.push('c1_commercial_over_3000sqft');
  }
  if (lead.wants_execution == null && !lead.out_of_scope_request) unclear.push('c1_real_project');

  // Criterion 2: service area
  const area = checkServiceArea(lead.locality);
  if (area === 'out') fails.push('c2_outside_area');
  if (area === 'unknown') unclear.push('c2_area');

  // Criterion 3: timeline
  let nurture = false;
  if (lead.weeks_until_needed != null) {
    if (lead.weeks_until_needed < MIN_DEADLINE_WEEKS) fails.push('c3_deadline_too_short');
    else if (lead.weeks_until_needed < TIGHT_DEADLINE_WEEKS) flags.push('tight_timeline');
  }
  if (lead.weeks_until_site_available != null && lead.weeks_until_site_available > MAX_SITE_WAIT_WEEKS) {
    nurture = true;
  }
  if (lead.weeks_until_needed == null && lead.weeks_until_site_available == null) unclear.push('c3_timeline');

  // Criterion 4: budget (only if volunteered)
  let budgetMismatch = false;
  if (lead.budget_inr != null) {
    const floor = budgetFloor(lead);
    if (floor && lead.budget_inr < floor * CLEARLY_BELOW) budgetMismatch = true;
  }

  // Criterion 5: decision-maker — flag only
  if (lead.is_decision_maker !== true) flags.push('decision_maker_unclear');

  if (fails.length) return { status: 'declined', reasons: fails, flags };
  if (budgetMismatch) return { status: 'budget_review', reasons: ['c4_budget_clearly_below'], flags };
  if (nurture) return { status: 'nurture', reasons: ['c3_site_not_ready'], flags };
  if (unclear.length) return { status: 'needs_review', reasons: unclear, flags };
  return { status: 'qualified', reasons: [], flags };
}
