// Vercel serverless function: real rainfall for the demo divisions, no API key needed.
// GFS forecast and ERA5 reanalysis both come through Open-Meteo (open-meteo.com, CC BY 4.0).
const REG = { Dhaka: [23.8, 90.4], Chattogram: [22.3, 91.8], Sylhet: [24.9, 91.9], Rajshahi: [24.4, 88.6],
  Khulna: [22.8, 89.5], Barishal: [22.7, 90.4], Rangpur: [25.7, 89.3], Mymensingh: [24.75, 90.4] };
const names = Object.keys(REG);
const lat = names.map(n => REG[n][0]).join(','), lon = names.map(n => REG[n][1]).join(',');
const day = d => d.toISOString().slice(0, 10);

module.exports = async (req, res) => {
  try {
    const q = req.query || {}, era5 = q.source === 'era5', now = new Date();
    let url, kind, label, issued;
    if (!era5) {
      url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=precipitation&models=gfs_seamless&forecast_days=3&timezone=UTC`;
      kind = 'forecast'; label = 'NOAA GFS via Open-Meteo'; issued = day(now) + 'T00:00Z (start of 72h window)';
    } else {
      const end = q.end || day(new Date(now - 7 * 864e5));
      if (!/^\d{4}-\d{2}-\d{2}$/.test(end) || Date.parse(end) > now - 5 * 864e5)
        throw new Error('ERA5 end date must be YYYY-MM-DD and at least 5 days ago (reanalysis lag)');
      const start = day(new Date(Date.parse(end) - 2 * 864e5));
      url = `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}&start_date=${start}&end_date=${end}&hourly=precipitation&models=era5&timezone=UTC`;
      kind = 'reanalysis'; label = 'ERA5 via Open-Meteo'; issued = `${start} to ${end} (72h)`;
    }
    const r = await fetch(url);
    if (!r.ok) throw new Error('upstream responded ' + r.status);
    const j = await r.json(), arr = Array.isArray(j) ? j : [j];
    if (arr.length !== names.length) throw new Error('unexpected upstream shape');
    const regions = {}, series = {};
    arr.forEach((a, i) => {
      const key = Object.keys(a.hourly || {}).find(k => k.startsWith('precipitation'));
      if (!key) throw new Error('precipitation missing for ' + names[i]);
      const hr = a.hourly[key].slice(0, 72).map(v => +(v || 0).toFixed(2));
      series[names[i]] = hr; regions[names[i]] = +hr.reduce((x, y) => x + y, 0).toFixed(1);
    });
    res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate=3600');
    res.status(200).json({ source: label + ' (open-meteo.com, CC BY 4.0)', kind, issued,
      fetched_at: now.toISOString(), units: 'mm per 72h', regions, series });
  } catch (e) { res.status(502).json({ error: String(e.message || e) }); }
};
