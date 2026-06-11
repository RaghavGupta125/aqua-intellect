const mongoose = require('mongoose');

const facilitySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    location: { type: String, required: true, trim: true },
    state: { type: String, trim: true },
    contactPerson: { type: String, trim: true },
    contactPhone: { type: String, trim: true },
    status: { type: String, enum: ['active', 'inactive', 'maintenance'], default: 'active' },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

facilitySchema.virtual('plants', {
  ref: 'Plant',
  localField: '_id',
  foreignField: 'facility',
});

module.exports = mongoose.model('Facility', facilitySchema);
