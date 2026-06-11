require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../src/models/User');
const Facility = require('../src/models/Facility');
const Plant = require('../src/models/Plant');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/aqua-intellect';

const facilities = [
  {
    name: 'Pantnagar Plant',
    location: 'Pantnagar, Uttarakhand',
    state: 'Uttarakhand',
    contactPerson: 'Rajesh Kumar',
    contactPhone: '+91-5944-250000',
    status: 'active',
  },
  {
    name: 'Pune Plant',
    location: 'Chakan, Pune, Maharashtra',
    state: 'Maharashtra',
    contactPerson: 'Suresh Patil',
    contactPhone: '+91-2135-660000',
    status: 'active',
  },
  {
    name: 'Jamshedpur Plant',
    location: 'Jamshedpur, Jharkhand',
    state: 'Jharkhand',
    contactPerson: 'Amit Singh',
    contactPhone: '+91-657-280000',
    status: 'active',
  },
];

async function seed() {
  await mongoose.connect(MONGODB_URI);
  console.log('✅ Connected to MongoDB');

  // Clear existing data
  await Promise.all([
    User.deleteMany({}),
    Facility.deleteMany({}),
    Plant.deleteMany({}),
  ]);
  console.log('🗑️  Cleared existing data');

  // Create facilities
  const createdFacilities = await Facility.insertMany(facilities);
  console.log(`✅ Created ${createdFacilities.length} facilities`);

  // Create plants
  const plants = [];
  for (const facility of createdFacilities) {
    if (facility.name.includes('Pantnagar')) {
      plants.push(
        { plantId: 'PNT-RO-01', name: 'RO Plant 1', type: 'RO', facility: facility._id, facilityName: facility.name, capacity: 200, status: 'online', thresholds: { tdsMax: 50, pressureMin: 2.5, pressureMax: 6.0, phMin: 6.5, phMax: 8.5, tankLevelMin: 20, flowMin: 80 } },
        { plantId: 'PNT-UF-01', name: 'UF Plant 1', type: 'UF', facility: facility._id, facilityName: facility.name, capacity: 150, status: 'online', thresholds: { tdsMax: 60, pressureMin: 1.5, pressureMax: 4.0, phMin: 6.5, phMax: 8.5, tankLevelMin: 25, flowMin: 60 } },
        { plantId: 'PNT-UF-02', name: 'UF Plant 2', type: 'UF', facility: facility._id, facilityName: facility.name, capacity: 150, status: 'maintenance', thresholds: { tdsMax: 60, pressureMin: 1.5, pressureMax: 4.0, phMin: 6.5, phMax: 8.5, tankLevelMin: 25, flowMin: 60 } }
      );
    } else if (facility.name.includes('Pune')) {
      plants.push(
        { plantId: 'PNE-RO-01', name: 'RO Plant 1', type: 'RO', facility: facility._id, facilityName: facility.name, capacity: 300, status: 'online', thresholds: { tdsMax: 45, pressureMin: 3.0, pressureMax: 7.0, phMin: 6.8, phMax: 8.2, tankLevelMin: 20, flowMin: 100 } },
        { plantId: 'PNE-RO-02', name: 'RO Plant 2', type: 'RO', facility: facility._id, facilityName: facility.name, capacity: 300, status: 'online', thresholds: { tdsMax: 45, pressureMin: 3.0, pressureMax: 7.0, phMin: 6.8, phMax: 8.2, tankLevelMin: 20, flowMin: 100 } },
        { plantId: 'PNE-UF-01', name: 'UF Plant 1', type: 'UF', facility: facility._id, facilityName: facility.name, capacity: 200, status: 'online', thresholds: { tdsMax: 60, pressureMin: 1.5, pressureMax: 4.0, phMin: 6.5, phMax: 8.5, tankLevelMin: 20, flowMin: 70 } }
      );
    } else if (facility.name.includes('Jamshedpur')) {
      plants.push(
        { plantId: 'JSR-RO-01', name: 'RO Plant 1', type: 'RO', facility: facility._id, facilityName: facility.name, capacity: 250, status: 'online', thresholds: { tdsMax: 55, pressureMin: 2.5, pressureMax: 6.5, phMin: 6.5, phMax: 8.5, tankLevelMin: 20, flowMin: 90 } },
        { plantId: 'JSR-UF-01', name: 'UF Plant 1', type: 'UF', facility: facility._id, facilityName: facility.name, capacity: 180, status: 'fault', thresholds: { tdsMax: 60, pressureMin: 1.5, pressureMax: 4.0, phMin: 6.5, phMax: 8.5, tankLevelMin: 20, flowMin: 65 } }
      );
    }
  }

  const createdPlants = await Plant.insertMany(plants);
  console.log(`✅ Created ${createdPlants.length} plants`);

  // Create users
  const users = [
    { name: 'Admin User', email: 'admin@aquaintellect.com', password: 'admin123', role: 'admin' },
    { name: 'Supervisor Sharma', email: 'supervisor@aquaintellect.com', password: 'super123', role: 'supervisor', facility: createdFacilities[0]._id },
    { name: 'Operator Verma', email: 'operator@aquaintellect.com', password: 'oper123', role: 'operator', facility: createdFacilities[0]._id },
    { name: 'Viewer Demo', email: 'viewer@aquaintellect.com', password: 'view123', role: 'viewer' },
  ];

  for (const userData of users) {
    await User.create(userData);
  }
  console.log(`✅ Created ${users.length} users`);

  console.log('\n🎉 Seed complete!');
  console.log('\n📋 Demo Credentials:');
  console.log('  admin@aquaintellect.com    / admin123  (Admin)');
  console.log('  supervisor@aquaintellect.com / super123 (Supervisor)');
  console.log('  operator@aquaintellect.com  / oper123  (Operator)');
  console.log('  viewer@aquaintellect.com    / view123  (Viewer)');
  console.log('\n🏭 Plants created:', createdPlants.map((p) => p.plantId).join(', '));

  await mongoose.disconnect();
  process.exit(0);
}

seed().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
