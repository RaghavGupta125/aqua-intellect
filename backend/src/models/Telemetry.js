const mongoose = require('mongoose');

const telemetrySchema = new mongoose.Schema(
  {
    plantId: { type: String, required: true, index: true },
    plant: { type: mongoose.Schema.Types.ObjectId, ref: 'Plant' },
    facility: { type: mongoose.Schema.Types.ObjectId, ref: 'Facility' },
    facilityName: { type: String },
    timestamp: { type: Date, required: true },
    flow: { type: Number },        // m³/h
    pressure: { type: Number },    // bar
    tds: { type: Number },         // ppm
    ph: { type: Number },
    tankLevel: { type: Number },   // %
    // Detailed telemetry
    inletTds: { type: Number },
    outletTds: { type: Number },
    inletPressure1: { type: Number },    // bar - stage 1
    inletPressure2: { type: Number },    // bar - stage 2 (RO only)
    inletPressure3: { type: Number },    // bar - stage 3 (RO only)
    outletPressure1: { type: Number },   // bar - stage 1
    outletPressure2: { type: Number },   // bar - stage 2 (RO only)
    rawWaterFlow: { type: Number },
    productWaterFlow: { type: Number },
    rejectFlow: { type: Number },
    rwpIndicator: { type: Boolean },
    hvpIndicator: { type: Boolean },
    lpsCutoff: { type: Boolean },
    hpsCutoff: { type: Boolean },
  },
  { timestamps: true }
);

// TTL index - keep telemetry for 90 days
telemetrySchema.index({ timestamp: 1 }, { expireAfterSeconds: 7776000 });

module.exports = mongoose.model('Telemetry', telemetrySchema);
