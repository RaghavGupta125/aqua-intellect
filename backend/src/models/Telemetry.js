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
  },
  { timestamps: true }
);

// TTL index - keep telemetry for 90 days
telemetrySchema.index({ timestamp: 1 }, { expireAfterSeconds: 7776000 });

module.exports = mongoose.model('Telemetry', telemetrySchema);
