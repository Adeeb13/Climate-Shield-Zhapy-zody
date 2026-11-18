const test = require('node:test'), assert = require('node:assert');
const handler = require('../api/feed.js');
const mk = () => ({ setHeader() {}, status(c) { this.c = c; return this; }, json(o) { this.b = o; } });
const up = (key, v) => async () => ({ ok: true, json: async () => Array.from({ length: 8 }, () => ({ hourly: { [key]: Array(72).fill(v) } })) });
test('GFS sums 72 hourly values for all 8 divisions', async () => {
  global.fetch = up('precipitation_gfs_seamless', 1.5); const r = mk();
  await handler({ query: { source: 'gfs' } }, r);
  assert.equal(r.c, 200); assert.equal(r.b.regions.Dhaka, 108); assert.equal(Object.keys(r.b.regions).length, 8); assert.equal(r.b.kind, 'forecast'); assert.equal(r.b.series.Dhaka.length, 72);
});
test('ERA5 default window works and is a reanalysis', async () => {
  global.fetch = up('precipitation', 1); const r = mk();
  await handler({ query: { source: 'era5' } }, r);
  assert.equal(r.c, 200); assert.equal(r.b.kind, 'reanalysis'); assert.equal(r.b.regions.Sylhet, 72);
});
test('ERA5 rejects dates inside the reanalysis lag and malformed dates', async () => {
  global.fetch = up('precipitation', 1);
  for (const end of ['2999-01-01', 'yesterday']) { const r = mk(); await handler({ query: { source: 'era5', end } }, r); assert.equal(r.c, 502); }
});
test('upstream failure becomes a clean 502', async () => {
  global.fetch = async () => ({ ok: false, status: 500 }); const r = mk();
  await handler({ query: { source: 'gfs' } }, r); assert.equal(r.c, 502); assert.match(r.b.error, /upstream/);
});
