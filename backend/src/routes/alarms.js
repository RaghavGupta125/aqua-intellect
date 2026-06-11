const express = require('express');
const Alarm = require('../models/Alarm');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// GET /api/alarms
router.get('/', authenticate, async (req, res) => {
  try {
    const filter = {};
    if (req.query.plantId) filter.plantId = req.query.plantId;
    if (req.query.status) filter.status = req.query.status;
    if (req.query.severity) filter.severity = req.query.severity;
    if (req.query.facility) filter.facility = req.query.facility;

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    const [alarms, total] = await Promise.all([
      Alarm.find(filter).sort({ startTime: -1 }).skip(skip).limit(limit),
      Alarm.countDocuments(filter),
    ]);

    res.json({ alarms, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/alarms/active/count
router.get('/active/count', authenticate, async (req, res) => {
  try {
    const count = await Alarm.countDocuments({ status: { $in: ['active', 'acknowledged'] } });
    const bySeverity = await Alarm.aggregate([
      { $match: { status: { $in: ['active', 'acknowledged'] } } },
      { $group: { _id: '$severity', count: { $sum: 1 } } },
    ]);
    res.json({ count, bySeverity });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/alarms/:id/acknowledge
router.post('/:id/acknowledge', authenticate, async (req, res) => {
  try {
    const alarm = await Alarm.findById(req.params.id);
    if (!alarm) return res.status(404).json({ message: 'Alarm not found' });
    if (alarm.status === 'resolved') {
      return res.status(400).json({ message: 'Cannot acknowledge a resolved alarm' });
    }
    alarm.status = 'acknowledged';
    alarm.acknowledgedBy = req.user._id;
    alarm.acknowledgedAt = new Date();
    await alarm.save();
    res.json({ alarm });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/alarms/:id/resolve
router.post('/:id/resolve', authenticate, authorize('admin', 'supervisor', 'operator'), async (req, res) => {
  try {
    const alarm = await Alarm.findById(req.params.id);
    if (!alarm) return res.status(404).json({ message: 'Alarm not found' });
    alarm.status = 'resolved';
    alarm.endTime = new Date();
    alarm.resolvedAt = new Date();
    await alarm.save();
    res.json({ alarm });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
