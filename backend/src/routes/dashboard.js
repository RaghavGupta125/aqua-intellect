const express = require('express');
const Facility = require('../models/Facility');
const Plant = require('../models/Plant');
const Alarm = require('../models/Alarm');
const Telemetry = require('../models/Telemetry');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// GET /api/dashboard/summary
router.get('/summary', authenticate, async (req, res) => {
  try {
    const [
      facilityCount,
      plantCount,
      activeAlarmCount,
      plants,
    ] = await Promise.all([
      Facility.countDocuments({ status: 'active' }),
      Plant.countDocuments(),
      Alarm.countDocuments({ status: { $in: ['active', 'acknowledged'] } }),
      Plant.find().populate('facility', 'name'),
    ]);

    // Calculate average TDS from lastTelemetry
    const plantsWithTDS = plants.filter((p) => p.lastTelemetry?.tds != null);
    const avgTDS =
      plantsWithTDS.length > 0
        ? plantsWithTDS.reduce((acc, p) => acc + p.lastTelemetry.tds, 0) / plantsWithTDS.length
        : 0;

    // Water produced today: sum of flow * hours for all plants
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const todayTelemetry = await Telemetry.aggregate([
      { $match: { timestamp: { $gte: startOfDay } } },
      { $group: { _id: '$plantId', avgFlow: { $avg: '$flow' }, count: { $sum: 1 } } },
    ]);

    const hoursElapsed = (Date.now() - startOfDay.getTime()) / (1000 * 60 * 60);
    const waterProducedToday = todayTelemetry.reduce(
      (acc, p) => acc + (p.avgFlow || 0) * hoursElapsed,
      0
    );

    res.json({
      facilityCount,
      plantCount,
      activeAlarmCount,
      avgTDS: parseFloat(avgTDS.toFixed(1)),
      waterProducedToday: parseFloat(waterProducedToday.toFixed(0)),
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/dashboard/plant-health
router.get('/plant-health', authenticate, async (req, res) => {
  try {
    const plants = await Plant.find().populate('facility', 'name location');
    const alarmCounts = await Alarm.aggregate([
      { $match: { status: { $in: ['active', 'acknowledged'] } } },
      { $group: { _id: '$plantId', count: { $sum: 1 } } },
    ]);
    const alarmMap = Object.fromEntries(alarmCounts.map((a) => [a._id, a.count]));

    const plantHealth = plants.map((p) => ({
      _id: p._id,
      plantId: p.plantId,
      name: p.name,
      type: p.type,
      facility: p.facility?.name || p.facilityName,
      status: p.status,
      lastTelemetry: p.lastTelemetry,
      activeAlarms: alarmMap[p.plantId] || 0,
    }));

    res.json({ plants: plantHealth });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/dashboard/recent-alarms
router.get('/recent-alarms', authenticate, async (req, res) => {
  try {
    const alarms = await Alarm.find().sort({ startTime: -1 }).limit(10);
    res.json({ alarms });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
