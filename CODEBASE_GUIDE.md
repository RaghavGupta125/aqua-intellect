# Aqua Intellect — Codebase Guide for New Interns

Welcome! This document explains how the entire Aqua Intellect system works,
from data flowing out of a PLC to appearing on the dashboard in real time.
Read this from top to bottom before touching any code.

---

## 1. The Big Picture

```
┌─────────────────────┐        HTTP POST         ┌─────────────────────────────────┐
│   PLC Simulator     │  ──────────────────────► │         Backend (Express)        │
│  (plc-simulator/)   │  every 5 seconds         │       localhost:4000             │
└─────────────────────┘                          │                                 │
                                                 │  1. Validates plantId           │
                                                 │  2. Saves to MongoDB            │
                                                 │  3. Updates Plant.lastTelemetry │
                                                 │  4. Runs alarm engine           │
                                                 │  5. Broadcasts via Socket.IO    │
                                                 └──────────────┬──────────────────┘
                                                                │ WebSocket events
                                                                ▼
                                                 ┌─────────────────────────────────┐
                                                 │     Frontend (React / Vite)     │
                                                 │       localhost:5173            │
                                                 │                                 │
                                                 │  • Dashboard: live KPIs         │
                                                 │  • Plant Detail: live readings  │
                                                 │  • Alarms: real-time alerts     │
                                                 └─────────────────────────────────┘
```

There are **three independent processes** you need to run locally:
1. **Backend** — `cd backend && npm run dev`
2. **Frontend** — `cd frontend && npm run dev`
3. **PLC Simulator** — `cd plc-simulator && node plc.js`

---

## 2. The PLC Simulator (`plc-simulator/plc.js`)

### What it does
This is a **fake PLC** (Programmable Logic Controller). In production, a real
hardware PLC at the plant site would send this data. For development and demo,
we simulate it in software.

### How it works

```
main()
  │
  ├─► setInterval(tick, 5000)  ← runs every 5 seconds
  │
  └─► tick()
        │
        └─► for each PLANT (8 plants):
              │
              ├─► simulateTick(plant)   ← calculates all sensor values
              │     │
              │     ├── Flow: slow random walk with mean-reversion
              │     ├── Pressure: inversely correlated with flow
              │     ├── TDS: slow upward creep (membrane fouling)
              │     ├── pH: gentle oscillation
              │     ├── Tank Level: fills with flow, drains at constant rate
              │     ├── Fault injection: 5% chance per tick (TDS spike,
              │     │   pressure drop, tank low, pH drop) lasting 2-4 ticks
              │     └── Returns full payload object
              │
              └─► postTelemetry(payload)   ← HTTP POST to backend
```

### Key concept: State persistence
Each plant has a `state` object that lives in memory between ticks:
```js
state['PNT-RO-01'] = {
  flow: 120,       // current value, drifts each tick
  pressure: 3.8,
  tds: 38,
  ph: 7.2,
  tankLevel: 72,
  faultTick: 0,    // counts down ticks remaining in a fault event
  tdsCreep: 0,     // accumulated TDS fouling since last flush
  tickCount: 0,    // total ticks since start
}
```
Without this, every tick would produce independent random values with no continuity.

### The payload sent to the backend
```json
{
  "plantId": "PNT-RO-01",
  "facility": "Pantnagar Plant",
  "timestamp": "2026-06-15T10:00:00.000Z",

  // Summary fields (used by legacy charts & alarm engine)
  "flow": 120.5,
  "pressure": 3.85,
  "tds": 38.2,
  "ph": 7.21,
  "tankLevel": 72.1,

  // Detailed TDS
  "inletTds": 955.0,
  "outletTds": 38.2,

  // Multi-stage pressures (RO: 3 inlet + 2 outlet, UF: 1+1)
  "inletPressure1": 3.85,
  "inletPressure2": 4.43,   // null for UF plants
  "inletPressure3": 5.01,   // null for UF plants
  "outletPressure1": 3.08,
  "outletPressure2": 2.31,  // null for UF plants

  // Flow breakdown
  "rawWaterFlow": 172.1,
  "productWaterFlow": 120.5,
  "rejectFlow": 51.6,

  // Equipment indicators (true = Normal, false = Tripped)
  "rwpIndicator": true,
  "hvpIndicator": true,
  "lpsCutoff": true,
  "hpsCutoff": true
}
```

---

## 3. The Backend (`backend/src/`)

### Entry Point: `src/index.js`

This is where the Express app and Socket.IO server are created and started.

```
index.js
  │
  ├── Creates Express app
  ├── Creates HTTP server (wraps Express — needed for Socket.IO)
  ├── initSocket(server)        ← attaches Socket.IO to the server
  ├── Middleware: CORS, JSON body parser
  ├── Mounts all route files at their URL prefixes
  │     /api/auth       → routes/auth.js
  │     /api/plants     → routes/plants.js
  │     /api/telemetry  → routes/telemetry.js
  │     /api/alarms     → routes/alarms.js
  │     /api/reports    → routes/reports.js
  │     /api/dashboard  → routes/dashboard.js
  │
  └── mongoose.connect(MONGODB_URI)
        └── on success: server.listen(PORT)
```

> **Important:** The server only starts listening AFTER MongoDB connects.
> If MongoDB is not running, the backend crashes immediately with
> `❌ MongoDB connection failed`. This is why `ECONNREFUSED` errors on port
> 4000 are almost always a MongoDB issue.

---

### The Telemetry Route: `src/routes/telemetry.js`

This is the most important file. It handles incoming PLC data.

```
POST /api/telemetry
  │
  ├── 1. Destructure all fields from req.body
  │       (plantId, flow, pressure, tds, inletTds, inletPressure1, ...)
  │
  ├── 2. Validate: plantId must be present
  │
  ├── 3. Find the Plant document in MongoDB
  │       Plant.findOne({ plantId })
  │       → If not found: return 404
  │
  ├── 4. Build telemetryData object (all fields together)
  │
  ├── 5. Save to Telemetry collection
  │       Telemetry.create({ plantId, plant._id, ...telemetryData })
  │
  ├── 6. Update Plant.lastTelemetry (cache for fast page loads)
  │       Plant.findByIdAndUpdate(plant._id, {
  │         status: 'online',
  │         lastTelemetry: telemetryData
  │       })
  │
  ├── 7. Run alarm engine
  │       processAlarms(plant, telemetryData)
  │
  └── 8. Broadcast via Socket.IO
          io.emit('telemetry:update', payload)        ← to ALL clients
          io.to('plant:PNT-RO-01').emit(...)          ← to subscribed clients only
```

**Why do we cache `lastTelemetry` on the Plant?**
When a user opens a Plant Detail page, we need to show the most recent sensor
reading instantly — without querying the huge Telemetry collection. The Plant
document caches the last reading so the page loads fast.

---

### The Database Models (`src/models/`)

#### `Telemetry.js` — One document per sensor reading
```
Every tick for every plant = 1 new Telemetry document
8 plants × every 5 seconds = 1.4 million documents/month

TTL Index: documents are automatically deleted after 90 days
            (7,776,000 seconds)
```

Key fields:
| Field | Type | Description |
|-------|------|-------------|
| `plantId` | String | e.g. `"PNT-RO-01"` — indexed for fast queries |
| `plant` | ObjectId | Reference to the Plant document |
| `timestamp` | Date | When the reading was taken |
| `flow` | Number | Product water flow (m³/h) — legacy summary |
| `inletTds` | Number | TDS of incoming raw water (ppm) |
| `outletTds` | Number | TDS after treatment (ppm) |
| `inletPressure1-3` | Number | Multi-stage inlet pressures (bar) |
| `outletPressure1-2` | Number | Multi-stage outlet pressures (bar) |
| `rawWaterFlow` | Number | Total raw water into the system |
| `productWaterFlow` | Number | Clean water output |
| `rejectFlow` | Number | Rejected/waste water |
| `rwpIndicator` | Boolean | Raw Water Pump running state |
| `hvpIndicator` | Boolean | High Volume Pump running state |
| `lpsCutoff` | Boolean | Low Pressure Switch state |
| `hpsCutoff` | Boolean | High Pressure Switch state |

#### `Plant.js` — One document per plant
Contains:
- Static info: `plantId`, `name`, `type` (RO/UF), `facility`, `capacity`
- `thresholds`: per-plant alarm limits (tdsMax, pressureMin, etc.)
- `lastTelemetry`: **cached copy** of the latest sensor readings
- `status`: `online` | `offline` | `maintenance` | `fault`

#### `Alarm.js` — One document per alarm event
```
Status lifecycle: active → acknowledged → resolved
```
Created by the alarm engine when a value goes out of range.
Auto-resolved when the value returns to range.

---

### The Alarm Engine: `src/services/alarmEngine.js`

Called on every telemetry tick. Checks 7 conditions:

```
processAlarms(plant, reading)
  │
  └── for each ALARM_DEFINITION (TDS_HIGH, PRESSURE_LOW, FLOW_LOW, ...):
        │
        ├── Get current value:    reading.tds, reading.pressure, etc.
        ├── Get threshold:        plant.thresholds.tdsMax, etc.
        ├── isTriggered = check(reading, thresholds)
        │
        ├── Look for existing ACTIVE or ACKNOWLEDGED alarm of this type
        │
        ├── If TRIGGERED and NO existing alarm:
        │     → Create new Alarm document (status: 'active')
        │     → Emit 'alarm:new' via Socket.IO → frontend toast notification
        │
        ├── If NOT triggered and existing alarm found:
        │     → Update alarm: status = 'resolved', endTime = now
        │     → Emit 'alarm:resolved' via Socket.IO
        │
        └── If TRIGGERED and alarm already exists:
              → Do nothing (prevents duplicate alarms)
```

---

### Socket.IO Manager: `src/sockets/socketManager.js`

A thin wrapper that creates the Socket.IO server and manages plant room subscriptions.

```
Client connects
  │
  ├── Client emits 'subscribe:plant' with plantId
  │     → socket.join('plant:PNT-RO-01')
  │
  └── When telemetry arrives for PNT-RO-01:
        ├── io.emit('telemetry:update', ...)      ← ALL clients (for dashboard)
        └── io.to('plant:PNT-RO-01').emit(...)    ← only subscribed clients (for detail page)
```

**Why two events?**
- `telemetry:update` — The main dashboard subscribes to this. It shows ALL plants,
  so it needs every update from every plant.
- `telemetry:plant` — The Plant Detail page subscribes to this room. It only wants
  updates for ONE specific plant. This avoids the page processing updates for
  plants it doesn't care about.

---

## 4. The Frontend (`frontend/src/`)

### How it connects to the backend

#### HTTP (REST API): `src/services/api.js`
All REST API calls go through a single Axios instance. Key behaviours:
- **Dev**: Vite proxies `/api` → `http://127.0.0.1:4000` (see `vite.config.js`)
- **Prod**: `VITE_API_URL` env variable points to the Render backend URL
- **JWT**: Every request automatically includes `Authorization: Bearer <token>`
  from `localStorage`
- **401 handling**: If the token expires, the user is automatically redirected
  to `/login`

#### WebSocket: `src/services/socket.js`
A singleton Socket.IO client. Components call `getSocket()` to get the shared
connection — not create a new one.

---

### Page Flow

#### Login (`pages/LoginPage.jsx`)
```
User submits form
  │
  ├── authApi.login(email, password)
  ├── On success: store token + user in localStorage
  └── Navigate to /dashboard
```

#### Dashboard (`pages/DashboardPage.jsx`)
```
On mount:
  │
  ├── dashboardApi.summary()     → KPI cards (plants online, active alarms, etc.)
  ├── dashboardApi.plantHealth() → plant status table
  └── dashboardApi.recentAlarms() → recent alarm list

On WebSocket event 'telemetry:update':
  └── Re-fetch dashboard summary (keeps KPIs live)
```

#### Plant Detail (`pages/PlantDetailPage.jsx`)
This is the most complex page. It has 4 tabs: Overview, Charts, Alarms, Reports.

```
On mount:
  ├── plantsApi.get(plantId)
  │     Returns: plant info + plant.lastTelemetry (instant readings on load)
  │
  └── Socket.IO: socket.on('telemetry:update', ...)
        When a new reading arrives for THIS plant:
        → setLiveData(data)  ← updates the Overview tab readings live

Overview Tab:
  ├── d = liveData || plant.lastTelemetry
  │     (uses live socket data if available, falls back to cached DB value)
  │
  ├── Live Readings card:
  │     Inlet TDS, Outlet TDS, Raw Water Flow, Product Flow, Reject Flow,
  │     Inlet Pressure 1/2/3, Outlet Pressure 1/2, pH, Tank Level
  │
  └── Equipment Status card:
        RWP, HVP (true='Running'/false='Tripped'),
        LPS Cutoff, HPS Cutoff (true='Normal'/false='Cutoff')

Charts Tab:
  ├── telemetryApi.history(plantId, hours)  ← fetches historical data from MongoDB
  │     Returns last N hours of Telemetry documents
  │
  └── Socket.IO: socket.join('plant:PNT-RO-01')
        On 'telemetry:plant': append new point to chart data (live chart updates)

Alarms Tab:
  └── alarmsApi.list({ plantId })  ← all alarms for this plant
        User can acknowledge active alarms

Reports Tab:
  └── reportsApi.generate(plantId, period)  ← triggers backend to build a report
```

---

### Component: `MetricRow`
A simple display row used throughout the Plant Detail page.

```jsx
<MetricRow
  label="Outlet TDS"     ← left-aligned label
  value={d?.outletTds}   ← right-aligned value (null → shows '—')
  unit="ppm"             ← appended to value
  bad={value > threshold}  ← turns text RED if true
  good={value <= threshold} ← turns text GREEN if true
/>
```

Rules:
- If `value` is `null`, `undefined`, or `""` → shows `—`
- If `value` is a Number → auto-rounded to 2 decimal places
- `bad` takes priority over `good` for color

---

## 5. Data Flow End-to-End (Full Walkthrough)

Here's exactly what happens from the moment the PLC sends a reading until
it appears on your screen:

```
[T=0s]  PLC Simulator: simulateTick('PNT-RO-01')
          → Calculates new sensor values based on previous state
          → Returns payload object with 20+ fields

[T=0s]  PLC Simulator: postTelemetry(payload)
          → HTTP POST to http://127.0.0.1:4000/api/telemetry
          → Body: JSON with all sensor fields

[T=~5ms] Backend: POST /api/telemetry handler runs
          1. Reads plantId from body
          2. Queries MongoDB: Plant.findOne({ plantId: 'PNT-RO-01' })
          3. Saves Telemetry.create({ plantId, ...allFields })
          4. Updates Plant: lastTelemetry = allFields, status = 'online'
          5. Calls processAlarms(plant, reading):
             - Checks if tds > 50 ppm → no alarm (38 ppm is fine)
             - Checks if pressure < 2.0 → no alarm (3.85 bar is fine)
             - etc.
          6. io.emit('telemetry:update', { plantId: 'PNT-RO-01', ...allFields })
          7. Returns HTTP 201 to PLC simulator → shows ✅ in console

[T=~10ms] Frontend: Socket.IO receives 'telemetry:update'
           - DashboardPage: re-fetches KPI summary
           - PlantDetailPage (if open for PNT-RO-01):
               → setLiveData(data) triggers React re-render
               → MetricRow components update with new values
               → User sees numbers change on screen
```

---

## 6. Environment Variables

### `backend/.env`
```
PORT=4000                          # Port the Express server listens on
MONGODB_URI=mongodb://localhost:27017/aqua-intellect
JWT_SECRET=some_long_random_string # Used to sign/verify JWT tokens
JWT_EXPIRES_IN=7d                  # Token validity period
NODE_ENV=development
FRONTEND_URL=http://localhost:5173 # Allowed CORS origin for Socket.IO
```

### `plc-simulator/.env` (gitignored — never commit this)
```
BACKEND_URL=http://127.0.0.1:4000  # Must use 127.0.0.1, not localhost
INTERVAL_MS=5000                   # How often each plant sends a reading
```

> **Why `127.0.0.1` and not `localhost`?**
> In Node.js 17+, `localhost` resolves to the IPv6 address `::1`.
> The backend listens on IPv4 `0.0.0.0`. Using `localhost` causes a
> `ECONNREFUSED` error. Always use `127.0.0.1` for local connections.

---

## 7. Common Errors & Fixes

| Error | Cause | Fix |
|-------|-------|-----|
| `❌ MongoDB connection failed` | MongoDB not running | Run `mongod` or start MongoDB service |
| `ECONNREFUSED 127.0.0.1:4000` in Vite | Backend not running | `cd backend && npm run dev` |
| `EADDRINUSE :::4000` | Port 4000 already taken | Kill the old process: `Get-NetTCPConnection -LocalPort 4000` → `Stop-Process -Id <PID>` |
| All simulator ticks show ❌ | Wrong `BACKEND_URL` in plc-simulator/.env | Set `BACKEND_URL=http://127.0.0.1:4000` |
| Fields show `—` on Plant Detail | Backend not restarted after code change | Restart `npm run dev` in backend |
| `Plant PNT-RO-01 not found` in backend logs | Database not seeded | Run `npm run seed:init` in backend |

---

## 8. How to Add a New Telemetry Field (Step-by-Step)

Say you want to add a new field called `conductivity` (µS/cm).

**Step 1: PLC Simulator** — Add to the payload in `plc-simulator/plc.js`
```js
const conductivity = round(s.tds * 1.4 + noise(5), 1); // ~1.4 µS/cm per ppm TDS

return {
  ...existingFields,
  conductivity,
};
```

**Step 2: Backend Schema** — Add to `backend/src/models/Telemetry.js`
```js
conductivity: { type: Number }, // µS/cm
```

**Step 3: Plant Cache** — Add to `lastTelemetry` in `backend/src/models/Plant.js`
```js
lastTelemetry: {
  ...existingFields,
  conductivity: Number,
}
```

**Step 4: API Route** — Add to the destructure in `backend/src/routes/telemetry.js`
```js
const {
  ...existingFields,
  conductivity
} = req.body;

const telemetryData = {
  ...existingFields,
  conductivity,
};
```

**Step 5: Alarm Engine** *(optional)* — Add a new rule in `backend/src/services/alarmEngine.js`
```js
{
  type: 'CONDUCTIVITY_HIGH',
  severity: 'warning',
  check: (r, t) => r.conductivity > t.conductivityMax,
  getMessage: (v, t) => `Conductivity ${v} µS/cm exceeds ${t} µS/cm`,
  getValue: (r) => r.conductivity,
  getThreshold: (t) => t.conductivityMax,
},
```

**Step 6: Frontend** — Add a `MetricRow` in `frontend/src/pages/PlantDetailPage.jsx`
```jsx
<MetricRow label="Conductivity" value={d?.conductivity} unit="µS/cm" />
```

**Done.** The new field will flow through the entire system automatically.

---

## 9. File Index (Quick Reference)

| File | Purpose |
|------|---------|
| `plc-simulator/plc.js` | Virtual PLC — generates and POSTs sensor data |
| `backend/src/index.js` | App entry point, server bootstrap |
| `backend/src/routes/telemetry.js` | Receives PLC data, saves & broadcasts |
| `backend/src/routes/auth.js` | Login, JWT issue |
| `backend/src/routes/dashboard.js` | KPI aggregations |
| `backend/src/routes/alarms.js` | List, acknowledge alarms |
| `backend/src/routes/reports.js` | Generate, export reports |
| `backend/src/models/Telemetry.js` | MongoDB schema for sensor readings |
| `backend/src/models/Plant.js` | MongoDB schema for plants + thresholds |
| `backend/src/models/Alarm.js` | MongoDB schema for alarm events |
| `backend/src/services/alarmEngine.js` | Alarm logic — create and auto-resolve |
| `backend/src/sockets/socketManager.js` | Socket.IO setup and room management |
| `backend/src/middleware/auth.js` | JWT verification middleware |
| `backend/scripts/initSeed.js` | One-time DB seed (run once on fresh setup) |
| `frontend/src/services/api.js` | Axios client + all API helpers |
| `frontend/src/services/socket.js` | Socket.IO client singleton |
| `frontend/src/pages/DashboardPage.jsx` | Main dashboard page |
| `frontend/src/pages/PlantDetailPage.jsx` | Per-plant detail with live readings |
| `frontend/src/pages/LoginPage.jsx` | Login form |
| `frontend/src/features/auth/AuthContext.jsx` | React context for current user |
| `frontend/vite.config.js` | Dev proxy config (routes /api to backend) |
