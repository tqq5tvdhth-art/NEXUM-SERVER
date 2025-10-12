export function extractHintsFromChat(messages) {
  const text = messages.map(m => m.text.toLowerCase()).join(' ');
  const keywords = [];
  const bag = ['sushi','pizza','bowling','hiking','concert','museum','arcade','pottery','karaoke','burger','tacos','ramen','bar'];
  for (const k of bag) if (text.includes(k)) keywords.push(k);
  const candidateDates = [];
  return { keywords: Array.from(new Set(keywords)), candidateDates };
}

export function extractHintsFromProfiles(profiles) {
  const set = new Set();
  profiles.forEach(p => {
    (p.interests || []).forEach(i => set.add(i.tag.toLowerCase()));
    (p.bucket || []).forEach(b => set.add(b.item.toLowerCase()));
  });
  return { keywords: Array.from(set) };
}
