from __future__ import annotations

import asyncio
import os
import time
from datetime import datetime, timezone
from typing import Any, Optional

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from prisma import Prisma

load_dotenv()

# ─────────────────────────────────────────
# App & middleware
# ─────────────────────────────────────────
app = FastAPI(
    title="Traffic Pulse API",
    description="FastAPI proxy for TomTom Traffic Incidents with Prisma Postgres logging",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─────────────────────────────────────────
# Config
# ─────────────────────────────────────────
TOMTOM_API_KEY: str = os.getenv("TOMTOM_API_KEY", "REPLACE_ME")
TOMTOM_URL = "https://api.tomtom.com/traffic/services/5/incidentDetails"
CACHE_TTL: int = 300  # seconds

# Simple in-memory cache: bbox_key → (timestamp, payload)
_cache: dict[str, tuple[float, dict]] = {}

# ─────────────────────────────────────────
# Prisma lifecycle
# ─────────────────────────────────────────
db = Prisma()


@app.on_event("startup")
async def startup() -> None:
    await db.connect()
    print("✅ Connected to Prisma Postgres")


@app.on_event("shutdown")
async def shutdown() -> None:
    await db.disconnect()


# ─────────────────────────────────────────
# Helper: sort & slice incidents
# ─────────────────────────────────────────
def _top10(incidents: list[dict]) -> list[dict]:
    incidents.sort(
        key=lambda x: x.get("properties", {}).get("delay", 0) or 0,
        reverse=True,
    )
    return incidents[:10]


# ─────────────────────────────────────────
# Background DB logging
# ─────────────────────────────────────────
async def _log_to_db(bbox: str, zoom: float, incidents: list[dict]) -> None:
    """Fire-and-forget: persist query log + upsert incidents to Postgres."""
    try:
        await db.querylog.create(
            data={"bbox": bbox, "zoom": zoom, "resultCount": len(incidents)}
        )

        for inc in incidents:
            props: dict = inc.get("properties", {}) or {}
            geo: dict = inc.get("geometry", {}) or {}
            coords: list = geo.get("coordinates", []) or []

            first: list = coords[0] if coords else [0.0, 0.0]
            # TomTom can nest coordinates as [[lon, lat], ...]
            if first and isinstance(first[0], list):
                first = first[0]

            external_id: str = props.get("id", "") or ""
            if not external_id:
                continue

            events: list = props.get("events") or [{}]
            description: str = (events[0] or {}).get("description", "") or ""

            await db.trafficincident.upsert(
                where={"externalId": external_id},
                data={
                    "create": {
                        "externalId": external_id,
                        "bbox": bbox,
                        "delay": int(props.get("delay") or 0),
                        "length": float(props.get("length") or 0),
                        "fromAddr": props.get("from") or "",
                        "toAddr": props.get("to") or "",
                        "magnitude": int(props.get("magnitudeOfDelay") or 0),
                        "description": description,
                        "lat": float(first[1]) if len(first) > 1 else 0.0,
                        "lng": float(first[0]) if first else 0.0,
                    },
                    "update": {
                        "delay": int(props.get("delay") or 0),
                        "magnitude": int(props.get("magnitudeOfDelay") or 0),
                        "description": description,
                        "fetchedAt": datetime.now(tz=timezone.utc),
                    },
                },
            )
    except Exception as exc:
        print(f"⚠️  DB logging error: {exc}")


# ─────────────────────────────────────────
# Routes
# ─────────────────────────────────────────
@app.get("/health")
async def health() -> dict:
    return {"status": "ok", "timestamp": datetime.now(tz=timezone.utc).isoformat()}


@app.get("/api/traffic")
async def get_traffic(
    bbox: str = Query(..., description="minLon,minLat,maxLon,maxLat"),
    zoom: Optional[float] = Query(None),
) -> dict[str, Any]:
    """
    Proxy TomTom Traffic Incidents for a bounding box.
    Returns the Top-10 worst jams (sorted by delay).
    Responses are cached in-memory for CACHE_TTL seconds.
    Incidents are persisted to Prisma Postgres asynchronously.
    """
    now = time.monotonic()

    # ── Cache hit ────────────────────────────────────────────
    if bbox in _cache:
        ts, cached_payload = _cache[bbox]
        if now - ts < CACHE_TTL:
            print(f"[Cache HIT] bbox={bbox}")
            return cached_payload

    print(f"[TomTom API] bbox={bbox} zoom={zoom}")

    # ── TomTom request ───────────────────────────────────────
    params = {
        "key": TOMTOM_API_KEY,
        "bbox": bbox,
        "fields": (
            "{incidents{geometry{type,coordinates},properties{"
            "id,iconCategory,magnitudeOfDelay,"
            "events{description,code,iconCategory},"
            "startTime,endTime,from,to,length,delay,roadNumbers}}}"
        ),
        "language": "en-US",
    }

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.get(TOMTOM_URL, params=params)
            resp.raise_for_status()
            raw: dict = resp.json()
    except httpx.HTTPStatusError as exc:
        raise HTTPException(
            status_code=502,
            detail=f"TomTom API error: {exc.response.status_code}",
        ) from exc
    except httpx.RequestError as exc:
        raise HTTPException(status_code=502, detail=f"TomTom request failed: {exc}") from exc

    all_incidents: list[dict] = raw.get("incidents", []) or []
    top10 = _top10(all_incidents)

    payload: dict = {"totalInBounds": len(all_incidents), "incidents": top10}

    # ── Store in cache ───────────────────────────────────────
    _cache[bbox] = (now, payload)

    # ── Log to DB (non-blocking) ─────────────────────────────
    asyncio.create_task(_log_to_db(bbox, zoom or 0.0, top10))

    return payload


@app.get("/api/incidents/history")
async def get_incident_history(
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
) -> dict[str, Any]:
    """Return stored incidents from Prisma Postgres (most-recent first)."""
    incidents = await db.trafficincident.find_many(
        order={"fetchedAt": "desc"},
        take=limit,
        skip=offset,
    )
    total = await db.trafficincident.count()
    return {
        "total": total,
        "incidents": [i.dict() for i in incidents],
    }
