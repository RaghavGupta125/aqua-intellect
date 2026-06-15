/**
 * Aqua Intellect — Virtual PLC Simulator
 *
 * Simulates realistic sensor readings for all 8 plants and sends
 * them to the backend via POST /api/telemetry every INTERVAL_MS.
 *
 * Realistic behavior modelled:
 *   - Slow random drift on all parameters
 *   - Tank fills up slowly, drains quickly when flow drops
 *   - Pressure follows flow (higher flow → lower pressure)
 *   - TDS creeps up over time, resets on membrane flush
 *   - pH oscillates gently around neutral
 *   - Occasional fault events (5% chance per tick per plant)
 *   - Faults auto-recover after 2–4 ticks
 */

require('dotenv').config();
const axios = require('axios');

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:4000';
const INTERVAL_MS = parseInt(process.env.INTERVAL_MS) || 5000;

// ── Plant configurations ───────────────────────────────────────
const PLANTS = [
  {
    plantId:      'PNT-RO-01',
    facility:     'Pantnagar Plant',
    type:         'RO',
    flow:         { base: 120, min: 80,  max: 160 },
    pressure:     { base: 3.8, min: 2.5, max: 5.5  },
    tds:          { base: 38,  min: 25,  max: 52   },
    ph:           { base: 7.2, min: 6.8, max: 7.6  },
    tankLevel:    { base: 72,  min: 20,  max: 95   },
  },
  {
    plantId:      'PNT-UF-01',
    facility:     'Pantnagar Plant',
    type:         'UF',
    flow:         { base: 95,  min: 60,  max: 130  },
    pressure:     { base: 2.2, min: 1.5, max: 3.5  },
    tds:          { base: 45,  min: 30,  max: 60   },
    ph:           { base: 7.0, min: 6.7, max: 7.5  },
    tankLevel:    { base: 65,  min: 20,  max: 90   },
  },
  {
    plantId:      'PNT-UF-02',
    facility:     'Pantnagar Plant',
    type:         'UF',
    flow:         { base: 88,  min: 55,  max: 120  },
    pressure:     { base: 2.0, min: 1.5, max: 3.2  },
    tds:          { base: 48,  min: 30,  max: 62   },
    ph:           { base: 7.1, min: 6.7, max: 7.6  },
    tankLevel:    { base: 60,  min: 20,  max: 90   },
  },
  {
    plantId:      'PNE-RO-01',
    facility:     'Pune Plant',
    type:         'RO',
    flow:         { base: 180, min: 120, max: 230  },
    pressure:     { base: 4.5, min: 3.0, max: 6.5  },
    tds:          { base: 32,  min: 20,  max: 48   },
    ph:           { base: 7.3, min: 6.9, max: 7.7  },
    tankLevel:    { base: 80,  min: 25,  max: 95   },
  },
  {
    plantId:      'PNE-RO-02',
    facility:     'Pune Plant',
    type:         'RO',
    flow:         { base: 175, min: 120, max: 225  },
    pressure:     { base: 4.3, min: 3.0, max: 6.3  },
    tds:          { base: 35,  min: 20,  max: 50   },
    ph:           { base: 7.1, min: 6.8, max: 7.5  },
    tankLevel:    { base: 75,  min: 25,  max: 95   },
  },
  {
    plantId:      'PNE-UF-01',
    facility:     'Pune Plant',
    type:         'UF',
    flow:         { base: 130, min: 80,  max: 175  },
    pressure:     { base: 2.8, min: 1.8, max: 4.0  },
    tds:          { base: 42,  min: 28,  max: 58   },
    ph:           { base: 7.0, min: 6.7, max: 7.5  },
    tankLevel:    { base: 70,  min: 20,  max: 92   },
  },
  {
    plantId:      'JSR-RO-01',
    facility:     'Jamshedpur Plant',
    type:         'RO',
    flow:         { base: 140, min: 90,  max: 185  },
    pressure:     { base: 4.0, min: 2.5, max: 5.8  },
    tds:          { base: 42,  min: 28,  max: 56   },
    ph:           { base: 7.2, min: 6.8, max: 7.6  },
    tankLevel:    { base: 68,  min: 20,  max: 92   },
  },
  {
    plantId:      'JSR-UF-01',
    facility:     'Jamshedpur Plant',
    type:         'UF',
    flow:         { base: 105, min: 65,  max: 145  },
    pressure:     { base: 2.5, min: 1.6, max: 3.8  },
    tds:          { base: 50,  min: 32,  max: 65   },
    ph:           { base: 7.0, min: 6.6, max: 7.5  },
    tankLevel:    { base: 62,  min: 20,  max: 90   },
  },
];

// ── Sensor state per plant (persisted between ticks) ──────────
const state = {};
for (const p of PLANTS) {
  state[p.plantId] = {
    flow:      p.flow.base,
    pressure:  p.pressure.base,
    tds:       p.tds.base,
    ph:        p.ph.base,
    tankLevel: p.tankLevel.base,
    faultTick: 0,          // how many ticks left in current fault
    tdsCreep:  0,          // accumulated TDS creep
    tickCount: 0,
  };
}

// ── Helpers ───────────────────────────────────────────────────
function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function round(v, decimals = 2) {
  return parseFloat(v.toFixed(decimals));
}

// Gaussian-ish noise: average of 3 uniform samples
function noise(amplitude) {
  return ((Math.random() + Math.random() + Math.random()) / 3 - 0.5) * 2 * amplitude;
}

// ── Physics simulation per tick ───────────────────────────────
function simulateTick(plant) {
  const s  = state[plant.plantId];
  const cfg = plant;
  s.tickCount++;

  // ── Fault injection (5% chance per tick) ─────────────
  if (s.faultTick === 0 && Math.random() < 0.05) {
    const faultType = Math.floor(Math.random() * 4);
    s.faultTick = 2 + Math.floor(Math.random() * 3); // lasts 2–4 ticks

    switch (faultType) {
      case 0: s.tds      = cfg.tds.max + 10 + Math.random() * 10;   break; // TDS spike
      case 1: s.pressure = cfg.pressure.min * 0.4;                   break; // pressure drop
      case 2: s.tankLevel = cfg.tankLevel.min * 0.5;                 break; // tank low
      case 3: s.ph       = 5.8 + Math.random() * 0.3;               break; // pH drop
    }
  } else if (s.faultTick > 0) {
    s.faultTick--;
    // Recovery: drift back toward base values
    s.tds       += (cfg.tds.base       - s.tds)       * 0.4;
    s.pressure  += (cfg.pressure.base  - s.pressure)  * 0.4;
    s.tankLevel += (cfg.tankLevel.base - s.tankLevel) * 0.2;
    s.ph        += (cfg.ph.base        - s.ph)        * 0.4;
  } else {
    // ── Normal operation ──────────────────────────────

    // Flow: slow random walk with mean-reversion
    s.flow += (cfg.flow.base - s.flow) * 0.05 + noise(cfg.flow.base * 0.04);
    s.flow  = clamp(s.flow, cfg.flow.min, cfg.flow.max);

    // Pressure: inversely correlated with flow deviation
    const flowDeviation = (s.flow - cfg.flow.base) / cfg.flow.base;
    s.pressure = cfg.pressure.base * (1 - flowDeviation * 0.3) + noise(0.08);
    s.pressure = clamp(s.pressure, cfg.pressure.min, cfg.pressure.max);

    // TDS: slow upward creep (membrane fouling), flush every 60 ticks
    s.tdsCreep += 0.03;
    if (s.tickCount % 60 === 0) s.tdsCreep = 0; // simulated backwash/flush
    s.tds = cfg.tds.base + s.tdsCreep + noise(cfg.tds.base * 0.05);
    s.tds = clamp(s.tds, cfg.tds.min, cfg.tds.max);

    // pH: oscillates slowly around neutral
    s.ph += noise(0.04) + Math.sin(s.tickCount * 0.1) * 0.01;
    s.ph  = clamp(s.ph, cfg.ph.min, cfg.ph.max);

    // Tank level: rises proportionally to flow, drains at constant rate
    const fillRate  = (s.flow / cfg.flow.base) * 0.3;
    const drainRate = 0.25;
    s.tankLevel += fillRate - drainRate + noise(0.5);
    s.tankLevel  = clamp(s.tankLevel, cfg.tankLevel.min, cfg.tankLevel.max);
  }

  // ── Detailed Mock Data Calculation ──────────────────────────
  const isRO = cfg.type === 'RO';
  const isFault = s.faultTick > 0;

  // 1. Flow Splits (Recovery: RO ~70%, UF ~95%)
  const recoveryRate = isRO ? 0.70 : 0.95;
  const rawWaterFlow = round(s.flow / recoveryRate, 1);
  const productWaterFlow = round(s.flow, 1);
  const rejectFlow = round(rawWaterFlow - productWaterFlow, 1);

  // 2. TDS (Inlet TDS is much higher for RO than the final product)
  const inletTds = isRO ? round(s.tds * 25 + noise(10), 1) : round(s.tds * 1.2 + noise(2), 1);
  const outletTds = round(s.tds, 1);

  // 3. Individual named pressure fields (max 3 inlet stages, 2 outlet stages)
  // RO: 3 inlet + 2 outlet stages. UF: 1 inlet + 1 outlet stage (others null).
  const inletPressure1 = round(s.pressure * 1.00 + noise(0.2), 2);
  const inletPressure2 = isRO ? round(s.pressure * 1.15 + noise(0.2), 2) : null;
  const inletPressure3 = isRO ? round(s.pressure * 1.30 + noise(0.2), 2) : null;
  const outletPressure1 = round(s.pressure * 0.80 + noise(0.1), 2);
  const outletPressure2 = isRO ? round(s.pressure * 0.60 + noise(0.1), 2) : null;

  // 4. Indicators and Cutoffs (true = Normal/Run, false = Trip/Cutoff)
  // When a fault occurs, there's a chance these trip.
  const rwpIndicator = !isFault || Math.random() > 0.4;
  const hvpIndicator = !isFault || Math.random() > 0.4;
  const lpsCutoff    = !isFault || Math.random() > 0.2;
  const hpsCutoff    = !isFault || Math.random() > 0.2;

  // 5. UF Specific Data
  const isUF = !isRO;
  const feedPressure = isUF ? round(s.pressure * 1.1 + noise(0.2), 2) : undefined;
  const productPressure = isUF ? round(s.pressure * 0.9 + noise(0.1), 2) : undefined;
  // Backwash happens occasionally, randomly spike pressure
  const backwashPressure = isUF ? round(s.pressure * 1.5 + noise(0.5), 2) : undefined;
  
  // UF Components State Generation
  let components = undefined;
  if (isUF) {
    // Generate arrays of components with on/off states. Some might trip if isFault.
    const getStates = (count, baseChance) => {
      const arr = [];
      for (let i = 1; i <= count; i++) {
        arr.push({ id: `${i}`, state: Math.random() > baseChance });
      }
      return arr;
    };
    
    components = {
      sv: getStates(3, isFault ? 0.4 : 0.05), // 3 Solenoid valves
      rawWaterPumps: getStates(2, isFault ? 0.3 : 0.05), // 2 RWP
      highPressurePumps: getStates(2, isFault ? 0.5 : 0.1), // 2 HPP
      backPressurePumps: getStates(2, isFault ? 0.4 : 0.1), // 2 BPP
    };
  }

  return {
    plantId:   plant.plantId,
    facility:  plant.facility,
    timestamp: new Date().toISOString(),
    // Legacy fields (kept for backward compatibility with old UI components if any)
    flow:      productWaterFlow,
    pressure:  round(s.pressure, 2),
    tds:       outletTds,
    ph:        round(s.ph, 2),
    tankLevel: round(s.tankLevel, 1),
    // Detailed fields
    inletTds,
    outletTds,
    inletPressure1,
    inletPressure2,
    inletPressure3,
    outletPressure1,
    outletPressure2,
    rawWaterFlow,
    productWaterFlow,
    rejectFlow,
    rwpIndicator,
    hvpIndicator,
    lpsCutoff,
    hpsCutoff,
    // UF Specific fields (undefined for RO)
    feedPressure,
    productPressure,
    backwashPressure,
    components,
  };
}

// ── HTTP POST to backend ──────────────────────────────────────
async function postTelemetry(payload) {
  try {
    await axios.post(`${BACKEND_URL}/api/telemetry`, payload, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 4000,
    });
    return true;
  } catch (err) {
    return false;
  }
}

// ── Pretty console output ─────────────────────────────────────
function printRow(payload, ok) {
  const ts      = new Date().toLocaleTimeString('en-IN', { hour12: false });
  const status  = ok ? '✅' : '❌';
  const fault   = state[payload.plantId].faultTick > 0 ? ' ⚠ FAULT' : '';

  console.log(
    `${status} [${ts}] ${payload.plantId.padEnd(10)}` +
    `  TDS:${String(payload.tds).padStart(5)} ppm` +
    `  P:${String(payload.pressure).padStart(4)} bar` +
    `  Flow:${String(payload.flow).padStart(6)} m³/h` +
    `  pH:${String(payload.ph).padStart(4)}` +
    `  Tank:${String(payload.tankLevel).padStart(5)}%` +
    fault
  );
}

// ── Main loop ─────────────────────────────────────────────────
async function tick() {
  for (const plant of PLANTS) {
    const payload = simulateTick(plant);
    const ok      = await postTelemetry(payload);
    printRow(payload, ok);
  }
  console.log('─'.repeat(80));
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║         Aqua Intellect — Virtual PLC Simulator               ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log(`\n📡 Backend URL : ${BACKEND_URL}`);
  console.log(`⏱  Interval   : ${INTERVAL_MS / 1000}s`);
  console.log(`🏭 Plants      : ${PLANTS.length} (${PLANTS.map(p => p.plantId).join(', ')})`);
  console.log('\nPress Ctrl+C to stop.\n');
  console.log('─'.repeat(80));

  // First tick immediately
  await tick();

  // Then every INTERVAL_MS
  setInterval(tick, INTERVAL_MS);
}

main().catch(console.error);
