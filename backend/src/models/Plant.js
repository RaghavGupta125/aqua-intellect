const mongoose = require('mongoose');

const thresholdSchema = new mongoose.Schema(
  {
    tdsMax: { type: Number, default: 50 },
    pressureMin: { type: Number, default: 2.0 },
    pressureMax: { type: Number, default: 6.0 },
    phMin: { type: Number, default: 6.5 },
    phMax: { type: Number, default: 8.5 },
    tankLevelMin: { type: Number, default: 20 },
    flowMin: { type: Number, default: 50 },
  },
  { _id: false }
);

const plantSchema = new mongoose.Schema(
  {
    plantId: { type: String, required: true, unique: true, trim: true },
    name: { type: String, required: true, trim: true },
    type: { type: String, enum: ['RO', 'UF', 'NF', 'MBR'], required: true },
    facility: { type: mongoose.Schema.Types.ObjectId, ref: 'Facility', required: true },
    facilityName: { type: String },
    capacity: { type: Number, default: 0 }, // m³/day
    status: { type: String, enum: ['online', 'offline', 'maintenance', 'fault'], default: 'offline' },
    thresholds: { type: thresholdSchema, default: () => ({}) },
    lastTelemetry: {
      tds: Number,
      ph: Number,
      flow: Number,
      pressure: Number,
      tankLevel: Number,
      timestamp: Date,
      inletTds: Number,
      outletTds: Number,
      inletPressure1: Number,
      inletPressure2: Number,
      inletPressure3: Number,
      outletPressure1: Number,
      outletPressure2: Number,
      rawWaterFlow: Number,
      productWaterFlow: Number,
      rejectFlow: Number,
      rwpIndicator: Boolean,
      hvpIndicator: Boolean,
      lpsCutoff: Boolean,
      hpsCutoff: Boolean,
      // UF Specific
      feedPressure: Number,
      productPressure: Number,
      backwashPressure: Number,
      components: {
        sv: [{ id: String, state: Boolean, _id: false }],
        rawWaterPumps: [{ id: String, state: Boolean, _id: false }],
        highPressurePumps: [{ id: String, state: Boolean, _id: false }],
        backPressurePumps: [{ id: String, state: Boolean, _id: false }],
      }
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Plant', plantSchema);
