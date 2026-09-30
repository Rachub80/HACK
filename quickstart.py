"""Ecovolt quickstart: call a few endpoints and chart the results.

    pip install requests matplotlib
    ECOVOLT_API_KEY=... ECOVOLT_SYSTEM_ID=... python quickstart.py

Saves ecovolt-dashboard.png next to this script. Charts whose endpoints your
key can't call are skipped.
"""

import os
from collections import Counter
from datetime import datetime, timedelta, timezone
from pathlib import Path

import matplotlib.pyplot as plt
import requests

API = os.environ.get("ECOVOLT_API_URL", "https://api.ecovolt.ai")
SYSTEM_ID = os.environ["ECOVOLT_SYSTEM_ID"]

session = requests.Session()
session.headers["x-api-key"] = os.environ["ECOVOLT_API_KEY"]

now = datetime.now(timezone.utc)


def get(path, days=None):
    params = {}
    if days:
        params = {"from": (now - timedelta(days=days)).isoformat(), "till": now.isoformat()}
    response = session.get(f"{API}{path}", params=params, timeout=30)
    if response.status_code in (403, 404):
        return None
    response.raise_for_status()
    return response.json()


# Customer keys use /directory; hackathon sandbox keys only have /sandbox-directory.
directory = get(f"/api/system/{SYSTEM_ID}/directory") or get(f"/api/system/{SYSTEM_ID}/sandbox-directory")
devices = directory["devices"]
print(f"{len(directory['rooms'])} rooms, {len(devices)} devices")

fig, (ax_types, ax_daily) = plt.subplots(1, 2, figsize=(14, 5))
fig.suptitle("Ecovolt", fontsize=16)


# 1. Devices by type, straight from the Directory.
types = Counter(d["deviceType"] for d in devices).most_common()
ax_types.bar([t for t, _ in types], [n for _, n in types], color="#16a34a")
ax_types.set_title("Devices by type")
ax_types.tick_params(axis="x", rotation=30)


# 2. Daily energy for the whole system over the last 14 days.
daily = get(f"/api/usage-history/date-range/system/{SYSTEM_ID}", days=14)
if daily:
    ax_daily.bar([d["date"][5:10] for d in daily], [d["totalEnergyUsage"] for d in daily], color="#16a34a")
    ax_daily.set_title("Daily energy, last 14 days (kWh)")
    ax_daily.tick_params(axis="x", rotation=45)
else:
    ax_daily.set_title("Daily energy: not available to this key")
    ax_daily.axis("off")


fig.tight_layout()
out = Path(__file__).with_name("ecovolt-dashboard.png")
fig.savefig(out, dpi=120)
print(f"Saved {out}")
