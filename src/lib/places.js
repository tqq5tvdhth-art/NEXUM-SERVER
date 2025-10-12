export async function placesSearch({ lat, lng, keywords }) {
  const picks = (keywords && keywords.length) ? keywords[0] : 'meetup';
  return [
    { name: `${picks} spot A`, lat: lat+0.005, lng: lng+0.005, url: 'https://example.com/a' },
    { name: `${picks} spot B`, lat: lat-0.004, lng: lng+0.003, url: 'https://example.com/b' },
    { name: `${picks} spot C`, lat: lat+0.002, lng: lng-0.006, url: 'https://example.com/c' }
  ];
}
