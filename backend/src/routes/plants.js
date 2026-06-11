const express = require('express');
const Plant = require('../models/Plant');
const Alarm = require('../models/Alarm');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// GET /api/plants
router.get('/', authenticate, async (req, res) => {
  try {
    const filter = {};
    if (req.query.facility) filter.facility = req.query.facility;
    const plants = await Plant.find(filter).populate('facility', 'name location').sort({ name: 1 });
    res.json({ plants });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/plants/:id
router.get('/:id', authenticate, async (req, res) => {
  try {
    const plant = await Plant.findById(req.params.id).populate('facility', 'name location');
    if (!plant) return res.status(404).json({ message: 'Plant not found' });
    const activeAlarms = await Alarm.find({ plant: plant._id, status: { $in: ['active', 'acknowledged'] } });
    res.json({ plant, activeAlarms });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/plants
router.post('/', authenticate, authorize('admin', 'supervisor'), async (req, res) => {
  try {
    const { plantId, name, type, facility, facilityName, capacity, thresholds } = req.body;
    const plant = await Plant.create({ plantId, name, type, facility, facilityName, capacity, thresholds });
    res.status(201).json({ plant });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ message: 'Plant ID already exists' });
    }
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/plants/:id
router.put('/:id', authenticate, authorize('admin', 'supervisor'), async (req, res) => {
  try {
    const plant = await Plant.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!plant) return res.status(404).json({ message: 'Plant not found' });
    res.json({ plant });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/plants/:id/thresholds
router.put('/:id/thresholds', authenticate, authorize('admin', 'supervisor'), async (req, res) => {
  try {
    const plant = await Plant.findByIdAndUpdate(
      req.params.id,
      { thresholds: req.body },
      { new: true }
    );
    if (!plant) return res.status(404).json({ message: 'Plant not found' });
    res.json({ plant });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/plants/:id
router.delete('/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    await Plant.findByIdAndDelete(req.params.id);
    res.json({ message: 'Plant deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
