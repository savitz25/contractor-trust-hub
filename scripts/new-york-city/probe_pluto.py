#!/usr/bin/env python3
from __future__ import annotations

import json
import urllib.error
import urllib.parse
import urllib.request

UA = "ContractorTrustHub-NYC-CON-002A/1.0"


def try_q(params):
    url = "https://data.cityofnewyork.us/resource/64uk-42ks.json?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            data = json.loads(resp.read().decode())
            print("OK", params, "n", len(data), "keys", list(data[0].keys())[:8] if data else None)
    except urllib.error.HTTPError as exc:
        print("ERR", params, exc.read()[:300])


try_q({"$limit": "2"})
try_q({"$select": "bbl,bin,address,version", "$limit": "2"})
try_q({"$select": "bbl,bin,address,version", "$limit": "2", "$offset": "0"})
try_q({"$select": "bbl,bin,borough,block,lot,address,zipcode,landuse,bldgclass,unitsres,unitstotal,yearbuilt,lotarea,bldgarea,numfloors,zonedist1,histdist,ownername,latitude,longitude,condono,version", "$limit": "2"})
