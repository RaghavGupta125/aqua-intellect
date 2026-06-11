const Alarm = require('../models/Alarm');
const Plant = require('../models/Plant');
const { getIO } = require('../sockets/socketManager');

const ALARM_DEFINITIONS = [
  {
    type: 'TDS_HIGH',
    severity: 'critical',
    check: (reading, thresholds) => reading.tds > thresholds.tdsMax,
    getMessage: (value, threshold) => `TDS level ${value} ppm exceeds threshold of ${threshold} ppm`,
    getValue: (r) => r.tds,
    getThreshold: (t) => t.tdsMax,
  },
  {
    type: 'PRESSURE_LOW',
    severity: 'warning',
    check: (reading, thresholds) => reading.pressure < thresholds.pressureMin,
    getMessage: (value, threshold) => `Pressure ${value} bar below minimum threshold of ${threshold} bar`,
    getValue: (r) => r.pressure,
    getThreshold: (t) => t.pressureMin,
  },
  {
    type: 'PRESSURE_HIGH',
    severity: 'warning',
    check: (reading, thresholds) => reading.pressure > thresholds.pressureMax,
    getMessage: (value, threshold) => `Pressure ${value} bar exceeds maximum threshold of ${threshold} bar`,
    getValue: (r) => r.pressure,
    getThreshold: (t) => t.pressureMax,
  },
  {
    type: 'TANK_LEVEL_LOW',
    severity: 'warning',
    check: (reading, thresholds) => reading.tankLevel < thresholds.tankLevelMin,
    getMessage: (value, threshold) => `Tank level ${value}% below minimum threshold of ${threshold}%`,
    getValue: (r) => r.tankLevel,
    getThreshold: (t) => t.tankLevelMin,
  },
  {
    type: 'PH_LOW',
    severity: 'info',
    check: (reading, thresholds) => reading.ph < thresholds.phMin,
    getMessage: (value, threshold) => `pH ${value} below minimum threshold of ${threshold}`,
    getValue: (r) => r.ph,
    getThreshold: (t) => t.phMin,
  },
  {
    type: 'PH_HIGH',
    severity: 'info',
    check: (reading, thresholds) => reading.ph > thresholds.phMax,
    getMessage: (value, threshold) => `pH ${value} exceeds maximum threshold of ${threshold}`,
    getValue: (r) => r.ph,
    getThreshold: (t) => t.phMax,
  },
  {
    type: 'FLOW_LOW',
    severity: 'warning',
    check: (reading, thresholds) => reading.flow < thresholds.flowMin,
    getMessage: (value, threshold) => `Flow rate ${value} m³/h below minimum of ${threshold} m³/h`,
    getValue: (r) => r.flow,
    getThreshold: (t) => t.flowMin,
  },
];

async function processAlarms(plant, reading) {
  const io = getIO();
  const thresholds = plant.thresholds || {};

  for (const def of ALARM_DEFINITIONS) {
    const value = def.getValue(reading);
    const threshold = def.getThreshold(thresholds);

    if (value === undefined || value === null) continue;

    const isTriggered = def.check(reading, thresholds);

    // Check for existing active alarm of this type for this plant
    const existingAlarm = await Alarm.findOne({
      plantId: plant.plantId,
      type: def.type,
      status: { $in: ['active', 'acknowledged'] },
    });

    if (isTriggered && !existingAlarm) {
      // Create new alarm
      const alarm = await Alarm.create({
        plantId: plant.plantId,
        plant: plant._id,
        plantName: plant.name,
        facility: plant.facility,
        facilityName: plant.facilityName,
        type: def.type,
        severity: def.severity,
        message: def.getMessage(value.toFixed(2), threshold),
        value,
        threshold,
        startTime: reading.timestamp || new Date(),
      });

      if (io) {
        io.emit('alarm:new', alarm);
      }
    } else if (!isTriggered && existingAlarm) {
      // Auto-resolve alarm
      existingAlarm.status = 'resolved';
      existingAlarm.endTime = new Date();
      existingAlarm.resolvedAt = new Date();
      await existingAlarm.save();

      if (io) {
        io.emit('alarm:resolved', existingAlarm);
      }
    }
  }
}

module.exports = { processAlarms };
