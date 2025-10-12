export function findOverlappingSlots() {
  const start = new Date(Date.now() + 24*60*60*1000);
  start.setHours(19,0,0,0);
  const end = new Date(start.getTime() + 2*60*60*1000);
  return [{ startISO: start.toISOString(), endISO: end.toISOString() }];
}
