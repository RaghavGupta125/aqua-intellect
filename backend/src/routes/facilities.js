const express = require('express');
const Facility = require('../models/Facility');
const Plant = require('../models/Plant');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// GET /api/facilities
router.get('/', authenticate, async (req, res) => {
  try {
    const facilities = await Facility.find().sort({ name: 1 });
    // Count plants per facility
    const facilitiesWithCount = await Promise.all(
      facilities.map(async (f) => {
        const plantCount = await Plant.countDocuments({ facility: f._id });
        return { ...f.toObject(), plantCount };
      })
    );
    res.json({ facilities: facilitiesWithCount });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/facilities/:id
router.get('/:id', authenticate, async (req, res) => {
  try {
    const facility = await Facility.findById(req.params.id);
    if (!facility) return res.status(404).json({ message: 'Facility not found' });
    const plants = await Plant.find({ facility: facility._id });
    res.json({ facility: { ...facility.toObject(), plants } });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/facilities
router.post('/', authenticate, authorize('admin', 'supervisor'), async (req, res) => {
  try {
    const { name, location, state, contactPerson, contactPhone } = req.body;
    const facility = await Facility.create({ name, location, state, contactPerson, contactPhone });
    res.status(201).json({ facility });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/facilities/:id
router.put('/:id', authenticate, authorize('admin', 'supervisor'), async (req, res) => {
  try {
    const facility = await Facility.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!facility) return res.status(404).json({ message: 'Facility not found' });
    res.json({ facility });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/facilities/:id
router.delete('/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    await Facility.findByIdAndDelete(req.params.id);
    res.json({ message: 'Facility deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
