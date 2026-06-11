const express = require('express');
const Report = require('../models/Report');
const Telemetry = require('../models/Telemetry');
const Alarm = require('../models/Alarm');
const Plant = require('../models/Plant');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

async function generateReportStats(plantId, startDate, endDate) {
  const telemetry = await Telemetry.find({
    plantId,
    timestamp: { $gte: startDate, $lte: endDate },
  });

  if (telemetry.length === 0) {
    return null;
  }

  const tdsValues = telemetry.map((t) => t.tds).filter(Boolean);
  const pressureValues = telemetry.map((t) => t.pressure).filter(Boolean);
  const flowValues = telemetry.map((t) => t.flow).filter(Boolean);
  const phValues = telemetry.map((t) => t.ph).filter(Boolean);

  const avg = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length;
  const max = (arr) => Math.max(...arr);
  const min = (arr) => Math.min(...arr);

  // Water produced: average flow * hours
  const hours = (endDate - startDate) / (1000 * 60 * 60);
  const avgFlow = flowValues.length ? avg(flowValues) : 0;
  const totalWaterProduced = avgFlow * hours;

  const alarmCount = await Alarm.countDocuments({
    plantId,
    startTime: { $gte: startDate, $lte: endDate },
  });
  const criticalAlarmCount = await Alarm.countDocuments({
    plantId,
    severity: 'critical',
    startTime: { $gte: startDate, $lte: endDate },
  });

  // Uptime: % of time slots that have telemetry data
  const expectedPoints = Math.floor(hours * 12); // 1 reading every 5 min
  const uptimePercent = Math.min(100, (telemetry.length / expectedPoints) * 100);

  return {
    avgTDS: tdsValues.length ? parseFloat(avg(tdsValues).toFixed(2)) : 0,
    maxTDS: tdsValues.length ? parseFloat(max(tdsValues).toFixed(2)) : 0,
    minTDS: tdsValues.length ? parseFloat(min(tdsValues).toFixed(2)) : 0,
    avgPressure: pressureValues.length ? parseFloat(avg(pressureValues).toFixed(2)) : 0,
    avgFlow: parseFloat(avgFlow.toFixed(2)),
    avgPH: phValues.length ? parseFloat(avg(phValues).toFixed(2)) : 0,
    totalWaterProduced: parseFloat(totalWaterProduced.toFixed(1)),
    uptimePercent: parseFloat(uptimePercent.toFixed(1)),
    alarmCount,
    criticalAlarmCount,
  };
}

// GET /api/reports/:plantId
router.get('/:plantId', authenticate, async (req, res) => {
  try {
    const { plantId } = req.params;
    const { period } = req.query;
    const filter = { plantId };
    if (period) filter.period = period;
    const reports = await Report.find(filter).sort({ generatedAt: -1 }).limit(20);
    res.json({ reports });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/reports/generate
router.post('/generate', authenticate, async (req, res) => {
  try {
    const { plantId, period } = req.body;
    const plant = await Plant.findOne({ plantId });
    if (!plant) return res.status(404).json({ message: 'Plant not found' });

    const now = new Date();
    let startDate, endDate;
    endDate = now;

    if (period === 'daily') {
      startDate = new Date(now);
      startDate.setHours(0, 0, 0, 0);
    } else if (period === 'weekly') {
      startDate = new Date(now);
      startDate.setDate(now.getDate() - 7);
    } else if (period === 'monthly') {
      startDate = new Date(now);
      startDate.setDate(now.getDate() - 30);
    } else {
      return res.status(400).json({ message: 'Invalid period. Use daily, weekly, or monthly' });
    }

    const stats = await generateReportStats(plantId, startDate, endDate);

    const report = await Report.create({
      plantId,
      plant: plant._id,
      plantName: plant.name,
      facility: plant.facility,
      facilityName: plant.facilityName,
      period,
      startDate,
      endDate,
      generatedBy: req.user._id,
      stats: stats || {},
    });

    res.status(201).json({ report });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/reports/:plantId/export/csv
router.get('/:plantId/export/csv', authenticate, async (req, res) => {
  try {
    const { plantId } = req.params;
    const { hours = 24 } = req.query;
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    const telemetry = await Telemetry.find({ plantId, timestamp: { $gte: since } }).sort({ timestamp: 1 });

    const header = 'Timestamp,Flow (m³/h),Pressure (bar),TDS (ppm),pH,Tank Level (%)\n';
    const rows = telemetry
      .map(
        (t) =>
          `${new Date(t.timestamp).toISOString()},${t.flow ?? ''},${t.pressure ?? ''},${t.tds ?? ''},${t.ph ?? ''},${t.tankLevel ?? ''}`
      )
      .join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${plantId}-telemetry.csv"`);
    res.send(header + rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
