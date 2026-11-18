"""Climate Shield ingestion adapters (ERA5 via Copernicus CDS, GFS via NOAA open data).

STATUS: written without network access, so it has NOT been run against live services.
Test it on your machine and fix any API drift before relying on it.

Setup:  pip install cdsapi herbie-data xarray cfgrib numpy
ERA5:   free CDS account; put your key in ~/.cdsapirc (never in frontend code or git).
Run:    python climate_shield_ingest.py gfs            # next 72 h forecast rainfall
        python climate_shield_ingest.py era5 2024-05-28   # 72 h reanalysis ending that date
Output: climate_shield_feed.json -> load it with "Load real feed" on the Risk Atlas page.
"""
import json, sys, datetime as dt
import numpy as np, xarray as xr

# Division centroids (lat, lon). Replace with polygon averages for production.
REGIONS = {"Dhaka": (23.8, 90.4), "Chattogram": (22.3, 91.8), "Sylhet": (24.9, 91.9),
           "Rajshahi": (24.4, 88.6), "Khulna": (22.8, 89.5), "Barishal": (22.7, 90.4),
           "Rangpur": (25.7, 89.3), "Mymensingh": (24.75, 90.4)}

def sample(da, lat, lon, r=0.25):
    """Mean over a small box around a point (reduces single-cell noise)."""
    la, lo = ("latitude", "longitude")
    box = da.sel({la: slice(lat + r, lat - r), lo: slice(lon - r, lon + r)})
    if box.size == 0:  # grid with ascending latitude
        box = da.sel({la: slice(lat - r, lat + r), lo: slice(lon - r, lon + r)})
    return float(box.mean())

def validate(feed):
    for n, v in feed["regions"].items():
        if v is None or not np.isfinite(v) or v < 0 or v > 2000:
            raise ValueError(f"implausible rainfall for {n}: {v}")
    return feed

def era5(end_date):
    """72 h accumulated precipitation (mm) from ERA5 reanalysis. Latency is days, so not for live use."""
    import cdsapi
    end = dt.datetime.fromisoformat(end_date)
    days = sorted({(end - dt.timedelta(hours=h)).date() for h in range(72)})
    c = cdsapi.Client()
    c.retrieve("reanalysis-era5-single-levels", {
        "product_type": "reanalysis", "variable": "total_precipitation", "data_format": "grib",
        "year": sorted({str(d.year) for d in days}), "month": sorted({f"{d.month:02d}" for d in days}),
        "day": sorted({f"{d.day:02d}" for d in days}), "time": [f"{h:02d}:00" for h in range(24)],
        "area": [27, 88, 20.5, 93]}, "era5.grib")
    ds = xr.open_dataset("era5.grib", engine="cfgrib")
    tp = ds["tp"].sel(time=slice(end - dt.timedelta(hours=72), end)).sum("time") * 1000  # m -> mm
    return {"source": "ERA5 (Copernicus CDS)", "kind": "reanalysis", "issued": end.isoformat()[:16] + "Z",
            "regions": {n: round(sample(tp, *p), 1) for n, p in REGIONS.items()}}

def gfs():
    """72 h forecast precipitation (mm) from the latest available GFS cycle."""
    from herbie import Herbie
    now = dt.datetime.utcnow() - dt.timedelta(hours=8)  # allow for publication delay
    cyc = now.replace(hour=now.hour // 6 * 6, minute=0, second=0, microsecond=0)
    H = Herbie(cyc.strftime("%Y-%m-%d %H:%M"), model="gfs", product="pgrb2.0p25", fxx=72)
    ds = H.xarray("APCP:surface:0-72 hour acc")  # APCP accumulates since the start of the run
    tp = ds["tp"]
    return {"source": "NOAA GFS 0.25 deg", "kind": "forecast", "issued": cyc.isoformat() + "Z",
            "regions": {n: round(sample(tp, *p), 1) for n, p in REGIONS.items()}}

if __name__ == "__main__":
    which = sys.argv[1] if len(sys.argv) > 1 else "gfs"
    feed = validate(era5(sys.argv[2]) if which == "era5" else gfs())
    feed["fetched_at"] = dt.datetime.utcnow().isoformat(timespec="seconds") + "Z"
    json.dump(feed, open("climate_shield_feed.json", "w"), indent=2)
    print("wrote climate_shield_feed.json", feed)
