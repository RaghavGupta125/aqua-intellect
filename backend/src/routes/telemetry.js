const express = require('express');
const Telemetry = require('../models/Telemetry');
const Plant = require('../models/Plant');
const { processAlarms } = require('../services/alarmEngine');
const { getIO } = require('../sockets/socketManager');

const router = express.Router();

// POST /api/telemetry  (PLC endpoint - no auth required for PLC devices)
router.post('/', async (req, res) => {
  try {
    const { 
      plantId, facility, timestamp, flow, pressure, tds, ph, tankLevel,
      inletTds, outletTds,
      inletPressure1, inletPressure2, inletPressure3,
      outletPressure1, outletPressure2,
      rawWaterFlow, productWaterFlow, rejectFlow,
      rwpIndicator, hvpIndicator, lpsCutoff, hpsCutoff,
      feedPressure, productPressure, backwashPressure, components
    } = req.body;

    if (!plantId) {
      return res.status(400).json({ message: 'plantId is required' });
    }

    // Find plant
    const plant = await Plant.findOne({ plantId });
    if (!plant) {
      return res.status(404).json({ message: `Plant ${plantId} not found` });
    }

    const ts = timestamp ? new Date(timestamp) : new Date();

    const telemetryData = {
      flow, pressure, tds, ph, tankLevel, timestamp: ts,
      inletTds, outletTds,
      inletPressure1, inletPressure2, inletPressure3,
      outletPressure1, outletPressure2,
      rawWaterFlow, productWaterFlow, rejectFlow,
      rwpIndicator, hvpIndicator, lpsCutoff, hpsCutoff,
      feedPressure, productPressure, backwashPressure, components
    };

    // Save telemetry
    const telemetry = await Telemetry.create({
      plantId,
      plant: plant._id,
      facility: plant.facility,
      facilityName: plant.facilityName,
      ...telemetryData
    });

    // Update plant last telemetry and set online
    await Plant.findByIdAndUpdate(plant._id, {
      status: 'online',
      lastTelemetry: telemetryData,
    });

    // Process alarms
    await processAlarms(plant, telemetryData);

    // Broadcast telemetry update
    const io = getIO();
    if (io) {
      const payload = { plantId, ...telemetryData };
      io.emit('telemetry:update', payload);
      io.to(`plant:${plantId}`).emit('telemetry:plant', payload);
    }

    res.status(201).json({ message: 'Telemetry received', id: telemetry._id });
  } catch (err) {
    console.error('Telemetry error:', err.message);
    res.status(500).json({ message: err.message });
  }
});

// GET /api/telemetry/:plantId
router.get('/:plantId', async (req, res) => {
  try {
    const { plantId } = req.params;
    const { hours = 24, limit = 500 } = req.query;

    const since = new Date(Date.now() - hours * 60 * 60 * 1000);

    const telemetry = await Telemetry.find({
      plantId,
      timestamp: { $gte: since },
    })
      .sort({ timestamp: 1 })
      .limit(parseInt(limit))
      .select('-__v');

    res.json({ telemetry });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/telemetry/:plantId/latest
router.get('/:plantId/latest', async (req, res) => {
  try {
    const telemetry = await Telemetry.findOne({ plantId: req.params.plantId }).sort({ timestamp: -1 });
    res.json({ telemetry });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
