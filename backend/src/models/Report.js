const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema(
  {
    plantId: { type: String, required: true },
    plant: { type: mongoose.Schema.Types.ObjectId, ref: 'Plant' },
    plantName: { type: String },
    facility: { type: mongoose.Schema.Types.ObjectId, ref: 'Facility' },
    facilityName: { type: String },
    period: { type: String, enum: ['daily', 'weekly', 'monthly'], required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    generatedAt: { type: Date, default: Date.now },
    generatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    stats: {
      avgTDS: Number,
      maxTDS: Number,
      minTDS: Number,
      avgPressure: Number,
      avgFlow: Number,
      avgPH: Number,
      totalWaterProduced: Number, // m³
      uptimePercent: Number,
      alarmCount: Number,
      criticalAlarmCount: Number,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Report', reportSchema);
