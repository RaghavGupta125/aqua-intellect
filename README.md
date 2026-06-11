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

Backend runs at: **http://localhost:4000**

### 2. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at: **http://localhost:5173**

### 3. Start Demo Data Seeder (Optional — recommended for demos)

In a separate terminal:

```bash
cd backend
node scripts/seeder.js
```

This sends fake PLC telemetry every 5 seconds to all plants. Dashboard will update live.

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

| Facility         | Plants                    |
|-----------------|---------------------------|
| Pantnagar Plant | PNT-RO-01, PNT-UF-01, PNT-UF-02 |
| Pune Plant      | PNE-RO-01, PNE-RO-02, PNE-UF-01 |
| Jamshedpur Plant| JSR-RO-01, JSR-UF-01      |

---

## PLC Integration

Send POST requests to ingest telemetry:

```
POST http://localhost:4000/api/telemetry
Content-Type: application/json

{
  "plantId": "PNT-RO-01",
  "facility": "Pantnagar Plant",
  "timestamp": "2026-01-01T10:00:00Z",
  "flow": 120,
  "pressure": 3.5,
  "tds": 42,
  "ph": 7.1,
  "tankLevel": 78
}
```

No authentication required on this endpoint (PLC devices).

---

## Alarm Thresholds (Default)

| Parameter    | Default Threshold   | Severity |
|-------------|---------------------|----------|
| TDS          | > 50 ppm            | Critical |
| Pressure     | < 2.0 bar           | Warning  |
| Pressure     | > 6.0 bar           | Warning  |
| Tank Level   | < 20%               | Warning  |
| pH           | < 6.5 or > 8.5      | Info     |
| Flow Rate    | < 50 m³/h           | Warning  |

Thresholds are configurable per plant via the backend API.

---

## Project Structure

```
aqua-intellect/
├── backend/
│   ├── src/
│   │   ├── controllers/
│   │   ├── routes/          # Express routers
│   │   ├── models/          # Mongoose schemas
│   │   ├── services/        # Alarm engine, report generation
│   │   ├── middleware/      # JWT auth
│   │   └── sockets/        # Socket.IO manager
│   └── scripts/
│       ├── initSeed.js     # One-time seed (users, facilities, plants)
│       └── seeder.js       # Continuous PLC simulator
│
└── frontend/
    └── src/
        ├── components/     # Layout, UI components
        ├── pages/          # Route-level pages
        ├── features/       # Auth context
        ├── services/       # API client, Socket.IO client
        └── routes/         # Route guards
```

---

## Deployment

### MongoDB Atlas

1. Create a free cluster at https://cloud.mongodb.com
2. Get your connection string: `mongodb+srv://user:pass@cluster.mongodb.net/aqua-intellect`
3. Update `MONGODB_URI` in backend `.env`

### Backend — Render

1. Push `backend/` to GitHub
2. Create a new **Web Service** on https://render.com
3. Build command: `npm install`
4. Start command: `npm start`
5. Set environment variables:
   - `MONGODB_URI` = your Atlas URI
   - `JWT_SECRET` = a long random string
   - `FRONTEND_URL` = your Vercel frontend URL
   - `PORT` = 4000

### Frontend — Vercel

1. Push `frontend/` to GitHub
2. Create a new project on https://vercel.com
3. Framework: Vite
4. Build command: `npm run build`
5. Output directory: `dist`
6. Set environment variables:
   - `VITE_API_URL` = your Render backend URL

Update `vite.config.js` proxy target to your Render URL for production.

---

## API Reference

| Method | Endpoint                         | Description           | Auth   |
|--------|----------------------------------|-----------------------|--------|
| POST   | /api/auth/login                  | Login                 | No     |
| GET    | /api/auth/me                     | Current user          | Yes    |
| GET    | /api/dashboard/summary           | KPI summary           | Yes    |
| GET    | /api/dashboard/plant-health      | Plant health table    | Yes    |
| GET    | /api/facilities                  | List facilities       | Yes    |
| POST   | /api/facilities                  | Create facility       | Admin  |
| GET    | /api/plants                      | List plants           | Yes    |
| POST   | /api/plants                      | Create plant          | Admin  |
| GET    | /api/plants/:id                  | Plant detail          | Yes    |
| POST   | /api/telemetry                   | Ingest telemetry      | No     |
| GET    | /api/telemetry/:plantId          | Telemetry history     | Yes    |
| GET    | /api/alarms                      | List alarms           | Yes    |
| POST   | /api/alarms/:id/acknowledge      | Acknowledge alarm     | Yes    |
| POST   | /api/reports/generate            | Generate report       | Yes    |
| GET    | /api/reports/:plantId/export/csv | Export CSV            | Yes    |
| GET    | /api/health                      | Health check          | No     |

---

## Socket.IO Events

| Event              | Direction       | Description               |
|--------------------|-----------------|---------------------------|
| `telemetry:update` | Server → Client | New telemetry broadcast   |
| `telemetry:plant`  | Server → Client | Plant-specific telemetry  |
| `alarm:new`        | Server → Client | New alarm created         |
| `alarm:resolved`   | Server → Client | Alarm auto-resolved       |
| `subscribe:plant`  | Client → Server | Subscribe to plant feed   |
