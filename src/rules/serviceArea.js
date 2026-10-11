// Service area from services.md. Keys are normalised (lowercase, letters only).

const SERVED = [
  // Pune city
  'pune', 'kothrud', 'baner', 'aundh', 'wakad', 'koregaon park', 'kalyani nagar',
  'viman nagar', 'hadapsar', 'magarpatta', 'nibm', 'kondhwa', 'undri', 'shivane', 'warje',
  'erandwane', 'deccan',
  // PCMC
  'pcmc', 'pimpri', 'chinchwad', 'pimpri chinchwad', 'pimple saudagar', 'pimple nilakh',
  'ravet', 'hinjewadi', 'hinjawadi',
];

const NOT_SERVED = ['talegaon', 'lonavala', 'nashik', 'mumbai', 'navi mumbai', 'thane'];

const norm = (s) => s.toLowerCase().replace(/[^a-z]/g, '');

const servedSet = new Set(SERVED.map(norm));
const notServedSet = new Set(NOT_SERVED.map(norm));

// Returns 'in' | 'out' | 'unknown'.
// 'unknown' = a place we can't place on the list (services.md also covers
// "adjoining areas"), so a human decides rather than the code guessing.
export function checkServiceArea(locality) {
  if (!locality) return 'unknown';
  const n = norm(locality);
  if (servedSet.has(n)) return 'in';
  if (notServedSet.has(n)) return 'out';
  // Excluded places first, so "Talegaon, Pune" is out, not in.
  for (const s of notServedSet) if (n.includes(s)) return 'out';
  for (const s of servedSet) if (n.includes(s)) return 'in';
  return 'unknown';
}
