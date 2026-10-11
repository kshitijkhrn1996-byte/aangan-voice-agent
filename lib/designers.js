import { db, q } from './db.js';

const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z]/g, '');

// Pick the designer who covers the caller's locality and project type.
// Falls back to the first active designer of the right specialty.
export async function pickDesigner({ locality, property_type }) {
  const all = await q(db.from('designers').select('*').eq('active', true).order('created_at'));
  const fits = all.filter((d) => property_type !== 'commercial' || d.specialty !== 'residential');
  const pool = fits.length ? fits : all;
  const n = norm(locality);
  return pool.find((d) => n && d.localities.some((l) => n.includes(norm(l)))) || pool[0];
}
