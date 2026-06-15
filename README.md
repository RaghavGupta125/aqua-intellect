# Aqua Intellect

A production-quality industrial water treatment monitoring platform for RO and UF plants.

Monitors real-time telemetry from PLC systems, generates alarms, displays live charts, and produces reports.

---

## Tech Stack

| Layer     | Technology                              |
|-----------|----------------------------------------|
| Frontend  | React + Vite + Tailwind CSS + Recharts |
| Backend   | Node.js + Express + Socket.IO          |
| Database  | MongoDB (Mongoose)                     |
| Auth      | JWT                                    |
| Realtime  | Socket.IO                              |

---

## Local Setup

### Prerequisites

- Node.js 18+
- MongoDB running locally (`mongodb://localhost:27017`)
- npm

### 1. Backend Setup

```bash
cd backend
npm install

# Copy and configure .env
cp .env.example .env

# Seed demo data (facilities, plants, users)
npm run seed:init

# Start backend server
npm run dev
```

Backend runs at: **http://127.0.0.1:4000**

### 2. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at: **http://localhost:5173**

### 3. Start PLC Simulator (Recommended for live demo)

In a separate terminal:

```bash
cd plc-simulator
# Edit .env and set: BACKEND_URL=http://127.0.0.1:4000
node plc.js
```

Sends realistic PLC telemetry every 5 seconds to all 8 plants. The dashboard updates live with full sensor data including multi-stage pressures, flow splits, TDS, and equipment indicators.

---

## Demo Credentials

| Role       | Email                            | Password   |
|------------|----------------------------------|------------|
| Admin      | admin@aquaintellect.com          | admin123   |
| Supervisor | supervisor@aquaintellect.com     | super123   |
| Operator   | operator@aquaintellect.com       | oper123    |
| Viewer     | viewer@aquaintellect.com         | view123    |

---

## Demo Facilities & Plants

| Facility          | Plants                             |
|-------------------|------------------------------------|
| Pantnagar Plant   | PNT-RO-01, PNT-UF-01, PNT-UF-02   |
| Pune Plant        | PNE-RO-01, PNE-RO-02, PNE-UF-01   |
| Jamshedpur Plant  | JSR-RO-01, JSR-UF-01               |

---

## PLC Integration

Send POST requests to ingest telemetry. **No authentication required** on this endpoint (PLC devices connect directly).

```
POST http://localhost:4000/api/telemetry
Content-Type: application/json
```

### Full Telemetry Payload

```json
{
  "plantId": "PNT-RO-01",
  "timestamp": "2026-06-15T10:00:00Z",

  "flow": 120.5,
  "pressure": 3.85,
  "tds": 38.2,
  "ph": 7.21,
  "tankLevel": 72.1,

  "inletTds": 955.0,
  "outletTds": 38.2,

  "inletPressure1": 3.85,
  "inletPressure2": 4.43,
  "inletPressure3": 5.01,

  "outletPressure1": 3.08,
  "outletPressure2": 2.31,

  "rawWaterFlow": 172.1,
  "productWaterFlow": 120.5,
  "rejectFlow": 51.6,

  "rwpIndicator": true,
  "hvpIndicator": true,
  "lpsCutoff": true,
  "hpsCutoff": true
}
```

**Field notes:**
- `inletPressure2`, `inletPressure3`, `outletPressure2` — RO plants only. Send `null` or omit for UF.
- `rwpIndicator` / `hvpIndicator` — `true` = Running, `false` = Tripped.
- `lpsCutoff` / `hpsCutoff` — `true` = Normal, `false` = Cutoff/Trip.

---

## Alarm Engine

Alarms are evaluated automatically on every telemetry tick.

### Lifecycle

```
Out of Range ──► active ──► acknowledged ──► resolved (auto, when back in range)
```

- A new alarm is **only created once** per type per plant while it remains out of range.
- When the value returns to range, the alarm is **automatically resolved** with an `endTime`.
- Users can **acknowledge** an active alarm — it stays open but is marked as seen.

### Alarm Types & Default Thresholds

| Alarm Type      | Severity | Condition              | Default Threshold |
|-----------------|----------|------------------------|-------------------|
| `TDS_HIGH`      | Critical | `tds > tdsMax`         | > 50 ppm          |
| `PRESSURE_LOW`  | Warning  | `pressure < pressureMin` | < 2.0 bar       |
| `PRESSURE_HIGH` | Warning  | `pressure > pressureMax` | > 6.0 bar       |
| `TANK_LEVEL_LOW`| Warning  | `tankLevel < tankLevelMin` | < 20%         |
| `PH_LOW`        | Info     | `ph < phMin`           | < 6.5             |
| `PH_HIGH`       | Info     | `ph > phMax`           | > 8.5             |
| `FLOW_LOW`      | Warning  | `flow < flowMin`       | < 50 m³/h         |

Thresholds are configurable per plant via the UI (admin/supervisor role) or API.

---

## Project Structure

```
aqua-intellect/
├── backend/
│   ├── src/
│   │   ├── routes/          # Express routers (auth, plants, telemetry, alarms, reports, dashboard)
│   │   ├── models/          # Mongoose schemas (Plant, Telemetry, Alarm, Facility, Report, User)
│   │   ├── services/        # Alarm engine (alarmEngine.js)
│   │   ├── middleware/      # JWT auth middleware
│   │   └── sockets/         # Socket.IO manager
│   └── scripts/
│       ├── initSeed.js      # One-time seed (users, facilities, plants)
│       └── seeder.js        # Legacy data seeder
│
├── plc-simulator/
│   ├── plc.js               # Virtual PLC — simulates 8 plants with realistic sensor payloads
│   └── .env                 # BACKEND_URL, INTERVAL_MS (gitignored)
│
└── frontend/
    └── src/
        ├── components/      # Layout, UI primitives (Badge, Spinner, Sidebar)
        ├── pages/           # Route-level pages (Dashboard, Plants, PlantDetail, Login)
        ├── features/        # Auth context
        ├── services/        # Axios API client, Socket.IO client
        └── routes/          # Auth-guarded route wrappers
```

---

## Deployment

### MongoDB Atlas

1. Create a free cluster at https://cloud.mongodb.com
2. Get connection string: `mongodb+srv://user:pass@cluster.mongodb.net/aqua-intellect`
3. Set `MONGODB_URI` in backend `.env`

### Backend — Render

1. Push to GitHub
2. Create a **Web Service** on https://render.com
3. Build command: `npm install`
4. Start command: `npm start`
5. Environment variables:
   - `MONGODB_URI` — Atlas URI
   - `JWT_SECRET` — long random string
   - `FRONTEND_URL` — Vercel frontend URL
   - `PORT` — 4000

### Frontend — Vercel

1. Push to GitHub
2. Create a project on https://vercel.com
3. Framework: Vite · Build: `npm run build` · Output: `dist`

---

## API Reference

| Method | Endpoint                          | Description           | Auth  |
|--------|-----------------------------------|-----------------------|-------|
| POST   | /api/auth/login                   | Login                 | No    |
| GET    | /api/auth/me                      | Current user          | Yes   |
| GET    | /api/dashboard/summary            | KPI summary           | Yes   |
| GET    | /api/dashboard/plant-health       | Plant health table    | Yes   |
| GET    | /api/dashboard/recent-alarms      | Recent alarms         | Yes   |
| GET    | /api/facilities                   | List facilities       | Yes   |
| POST   | /api/facilities                   | Create facility       | Admin |
| GET    | /api/plants                       | List plants           | Yes   |
| POST   | /api/plants                       | Create plant          | Admin |
| GET    | /api/plants/:id                   | Plant detail          | Yes   |
| PATCH  | /api/plants/:id/thresholds        | Update thresholds     | Admin |
| POST   | /api/telemetry                    | Ingest telemetry      | No    |
| GET    | /api/telemetry/:plantId           | Telemetry history     | Yes   |
| GET    | /api/telemetry/:plantId/latest    | Latest reading        | Yes   |
| GET    | /api/alarms                       | List alarms           | Yes   |
| POST   | /api/alarms/:id/acknowledge       | Acknowledge alarm     | Yes   |
| POST   | /api/reports/generate             | Generate report       | Yes   |
| GET    | /api/reports/:plantId/export/csv  | Export CSV            | Yes   |
| GET    | /api/health                       | Health check          | No    |

---

## Socket.IO Events

| Event               | Direction       | Description                         |
|---------------------|-----------------|-------------------------------------|
| `telemetry:update`  | Server → Client | Full telemetry broadcast (all PLCs) |
| `telemetry:plant`   | Server → Client | Plant-specific telemetry feed       |
| `alarm:new`         | Server → Client | New alarm created                   |
| `alarm:resolved`    | Server → Client | Alarm auto-resolved                 |
| `subscribe:plant`   | Client → Server | Subscribe to a plant's live feed    |
| `unsubscribe:plant` | Client → Server | Unsubscribe from a plant's feed     |
