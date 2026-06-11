const mongoose = require('mongoose');

const alarmSchema = new mongoose.Schema(
  {
    plantId: { type: String, required: true, index: true },
    plant: { type: mongoose.Schema.Types.ObjectId, ref: 'Plant' },
    plantName: { type: String },
    facility: { type: mongoose.Schema.Types.ObjectId, ref: 'Facility' },
    facilityName: { type: String },
    type: {
      type: String,
      enum: ['TDS_HIGH', 'PRESSURE_LOW', 'PRESSURE_HIGH', 'PH_LOW', 'PH_HIGH', 'TANK_LEVEL_LOW', 'FLOW_LOW'],
      required: true,
    },
    severity: { type: String, enum: ['critical', 'warning', 'info'], required: true },
    message: { type: String, required: true },
    value: { type: Number },
    threshold: { type: Number },
    startTime: { type: Date, default: Date.now },
    endTime: { type: Date },
    status: { type: String, enum: ['active', 'resolved', 'acknowledged'], default: 'active' },
    acknowledgedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    acknowledgedAt: { type: Date },
    resolvedAt: { type: Date },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Alarm', alarmSchema);
