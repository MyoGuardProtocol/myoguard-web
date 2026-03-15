require('dotenv/config');
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');

const adapter = new PrismaPg({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL });
const p = new PrismaClient({ adapter });

p.physicianProfile
  .upsert({
    where:  { slug: 'dr-b' },
    update: {},
    create: {
      slug:        'dr-b',
      displayName: 'Dr. B, MBBS',
      clinicName:  'MyoGuard Protocol',
      specialty:   'Preventive Medicine',
      isActive:    true,
    },
  })
  .then(r => {
    console.log('✓ Seeded PhysicianProfile:', r.slug);
    return p.$disconnect();
  })
  .catch(e => {
    console.error(e);
    return p.$disconnect();
  });
