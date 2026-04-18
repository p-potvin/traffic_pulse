# Traffic Pulse — Architecture

## System Overview

```mermaid
flowchart TB
    subgraph Browser["🖥️ Browser"]
        FE["React 19 + Vite\nMapbox GL JS (3D Globe)\nZustand State Store\nTailwind CSS v4"]
    end

    subgraph Vercel["⚡ Vercel (CDN / Edge)"]
        STATIC["Static Build Artifacts\n(HTML + JS + CSS bundles)"]
    end

    subgraph Local["💻 Local Machine"]
        API["🐍 FastAPI\nPython 3.11 + Uvicorn\nlocalhost:8000"]
        CACHE["🗄️ In-Memory Cache\nDict-based, TTL = 5 min\n(per bounding-box key)"]
    end

    subgraph PrismaCloud["🐘 Prisma Postgres (db.prisma.io)"]
        DB[("PostgreSQL\n──────────\nTrafficIncident\nQueryLog")]
    end

    subgraph TomTom["🚦 TomTom Cloud"]
        TT["Traffic Incidents API v5\n(GeoJSON / LineString)"]
    end

    %% Serve flow
    STATIC -- "Serves SPA" --> FE

    %% API flow
    FE -- "GET /api/traffic?bbox=…&zoom=…" --> API
    API -- "Cache hit?" --> CACHE
    CACHE -- "Miss → HTTP GET" --> TT
    TT -- "Incidents GeoJSON" --> CACHE
    CACHE -- "Top-10 sorted" --> API
    API -- "upsert incidents\ncreate query log" --> DB
    API -- "JSON response" --> FE

    %% Vercel serves the SPA
    Browser -->|"HTTPS request"| Vercel
```

---

## Data Flow Detail

```mermaid
sequenceDiagram
    participant U as User (Browser)
    participant V as Vercel CDN
    participant A as FastAPI :8000
    participant C as In-Memory Cache
    participant T as TomTom API
    participant D as Prisma Postgres

    U->>V: GET / (initial load)
    V-->>U: index.html + JS bundles

    U->>A: GET /api/traffic?bbox=…&zoom=10
    A->>C: lookup(bbox)
    alt Cache HIT
        C-->>A: cached Top-10 JSON
    else Cache MISS
        A->>T: GET /traffic/services/5/incidentDetails
        T-->>A: GeoJSON incidents array
        A->>A: sort by delay desc, slice [:10]
        A->>C: store(bbox, result, TTL=5min)
        A->>D: QueryLog.create(bbox, zoom, count)
        A->>D: TrafficIncident.upsert × N
    end
    A-->>U: {totalInBounds, incidents[]}

    U->>U: Render colored LineStrings on Mapbox globe
    U->>U: Click row → flyTo(incident coords)
```

---

## Component Map

```mermaid
graph LR
    subgraph Frontend["Frontend (React)"]
        APP[App.tsx]
        GLOBE[GlobeMap.tsx\nMapbox GL JS]
        LIST[TrafficList.tsx\nTop-10 sidebar]
        STORE[useTrafficStore.ts\nZustand]
    end

    subgraph API["API (FastAPI)"]
        MAIN[main.py]
        PROXY[/api/traffic endpoint]
        HEALTH[/health endpoint]
    end

    subgraph DB["Database (Prisma)"]
        SCHEMA[schema.prisma]
        TI[TrafficIncident model]
        QL[QueryLog model]
    end

    APP --> GLOBE
    APP --> LIST
    GLOBE --> STORE
    LIST --> STORE
    STORE --> PROXY
    PROXY --> MAIN
    MAIN --> TI
    MAIN --> QL
    TI --> SCHEMA
    QL --> SCHEMA
```

---

## Directory Structure

```
traffic-pulse/
├── ARCHITECTURE.md          ← this file
├── README.md
├── guidelines.md
├── fix_encoding.js
│
├── api/                     ← FastAPI backend (run locally)
│   ├── main.py              ← FastAPI app, TomTom proxy, cache logic
│   ├── schema.prisma        ← Prisma ORM schema (PostgreSQL)
│   ├── requirements.txt     ← Python dependencies
│   ├── .env                 ← secrets (gitignored)
│   └── .env.example
│
├── frontend/                ← React/Vite SPA → deployed to Vercel
│   ├── vercel.json
│   ├── vite.config.ts
│   ├── src/
│   │   ├── App.tsx
│   │   ├── components/
│   │   │   ├── GlobeMap.tsx
│   │   │   └── TrafficList.tsx
│   │   └── store/
│   │       └── useTrafficStore.ts
│   └── ...
│
└── backend/                 ← Legacy Node.js/Express (reference only)
    └── server.ts
```

---

## Environment Variables

| Variable | Where | Description |
|---|---|---|
| `VITE_MAPBOX_TOKEN` | Vercel + frontend/.env | Mapbox public access token |
| `VITE_API_URL` | Vercel + frontend/.env | FastAPI base URL (default: http://localhost:8000) |
| `TOMTOM_API_KEY` | api/.env | TomTom Traffic API key |
| `DATABASE_URL` | api/.env | Prisma Postgres connection string |
