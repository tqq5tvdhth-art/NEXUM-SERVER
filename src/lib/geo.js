export function computeMidpoint(members) {
  const pts = members
    .map(m => m.user)
    .filter(u => typeof u.homeLat === 'number' && typeof u.homeLng === 'number');
  if (!pts.length) return { lat: -33.8688, lng: 151.2093 };
  const lat = pts.reduce((a,u)=>a+u.homeLat,0)/pts.length;
  const lng = pts.reduce((a,u)=>a+u.homeLng,0)/pts.length;
  return { lat, lng };
}
