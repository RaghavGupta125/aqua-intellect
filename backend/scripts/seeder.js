require('dotenv').config();
const mongoose = require('mongoose');
const axios = require('axios').default;

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/aqua-intellect';
const API_BASE = process.env.API_URL || 'http://localhost:4000';

const PLANT_CONFIGS = [
  {
    plantId: 'PNT-RO-01',
    facility: 'Pantnagar Plant',
    baseFlow: 120,
    basePressure: 3.8,
    baseTDS: 38,
    basePH: 7.2,
    baseTankLevel: 72,
  },
  {
    plantId: 'PNT-UF-01',
    facility: 'Pantnagar Plant',
    baseFlow: 95,
    basePressure: 2.2,
    baseTDS: 45,
    basePH: 7.0,
    baseTankLevel: 65,
  },
  {
    plantId: 'PNE-RO-01',
    facility: 'Pune Plant',
    baseFlow: 180,
    basePressure: 4.5,
    baseTDS: 32,
    basePH: 7.3,
    baseTankLevel: 80,
  },
  {
    plantId: 'PNE-RO-02',
    facility: 'Pune Plant',
    baseFlow: 175,
    basePressure: 4.3,
    baseTDS: 35,
    basePH: 7.1,
    baseTankLevel: 75,
  },
  {
    plantId: 'JSR-RO-01',
    facility: 'Jamshedpur Plant',
    baseFlow: 140,
    basePressure: 4.0,
    baseTDS: 42,
    basePH: 7.2,
    baseTankLevel: 68,
  },
];

function jitter(base, pct) {
  const range = base * (pct / 100);
  return parseFloat((base + (Math.random() - 0.5) * 2 * range).toFixed(2));
}

// Occasional spike: 5% chance of alarming value
function spikeOrNormal(base, pct, spikeVal) {
  if (Math.random() < 0.05) return spikeVal;
  return jitter(base, pct);
}

async function sendTelemetry(plant) {
  const payload = {
    plantId: plant.plantId,
    facility: plant.facility,
    timestamp: new Date().toISOString(),
    flow: spikeOrNormal(plant.baseFlow, 8, plant.baseFlow * 0.3),      // spike: very low flow
    pressure: spikeOrNormal(plant.basePressure, 10, plant.basePressure * 0.4), // spike: very low pressure
    tds: spikeOrNormal(plant.baseTDS, 12, 65),                          // spike: high TDS
    ph: spikeOrNormal(plant.basePH, 3, 5.9),                           // spike: low pH
    tankLevel: spikeOrNormal(plant.baseTankLevel, 10, 15),             // spike: low tank
  };

  try {
    await axios.post(`${API_BASE}/api/telemetry`, payload, { timeout: 5000 });
    const ts = new Date().toLocaleTimeString();
    console.log(`[${ts}] ✅ ${plant.plantId} → TDS:${payload.tds} Flow:${payload.flow} P:${payload.pressure} pH:${payload.ph} Tank:${payload.tankLevel}%`);
  } catch (err) {
    console.error(`[${new Date().toLocaleTimeString()}] ❌ ${plant.plantId}: ${err.message}`);
  }
}

async function run() {
  console.log('🌊 Aqua Intellect Demo Seeder starting...');
  console.log(`📡 Sending telemetry to: ${API_BASE}`);
  console.log(`🌱 Plants: ${PLANT_CONFIGS.map((p) => p.plantId).join(', ')}`);
  console.log('⏱️  Interval: every 5 seconds\n');
  console.log('Press Ctrl+C to stop.\n');

  // Send one immediately
  for (const plant of PLANT_CONFIGS) {
    await sendTelemetry(plant);
  }

  // Then every 5 seconds
  setInterval(async () => {
    for (const plant of PLANT_CONFIGS) {
      await sendTelemetry(plant);
    }
  }, 5000);
}

run();
