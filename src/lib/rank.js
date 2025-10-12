function dist(a,b){ const dx=a.lat-b.lat, dy=a.lng-b.lng; return Math.sqrt(dx*dx+dy*dy); }
export function rank(venues, _timeSlots, members) {
  const mid = { lat: members.reduce((s,m)=>s+(m.user.homeLat||0),0)/members.length || 0,
                lng: members.reduce((s,m)=>s+(m.user.homeLng||0),0)/members.length || 0 };
  return venues
    .map(v => ({ v, score: -dist(v, mid) }))
    .sort((a,b)=>b.score-a.score)
    .slice(0,3)
    .map(x => x.v);
}
