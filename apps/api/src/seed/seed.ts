import { DataSource } from 'typeorm';
import { Test } from '../catalog/entities/test.entity';
import { Package } from '../catalog/entities/package.entity';
import { DiagnosticCenter } from '../centers/entities/diagnostic-center.entity';
import { PickupPoint } from '../centers/entities/pickup-point.entity';
import { Audience } from '../common/enums/audience.enum';

export async function seedDatabase(dataSource: DataSource) {
  console.log('🌱 Starting database seed...');

  // Clear existing data
  await dataSource.query('DELETE FROM "package_tests"');
  await dataSource.query('DELETE FROM "packages"');
  await dataSource.query('DELETE FROM "tests"');
  await dataSource.query('DELETE FROM "pickup_points"');
  await dataSource.query('DELETE FROM "diagnostic_centers"');

  // Create Tests
  const testRepo = dataSource.getRepository(Test);
  const tests = await testRepo.save([
    // Basic Tests
    {
      name: 'Complete Blood Count (CBC)',
      code: 'CBC',
      sampleType: 'Blood',
      price: 299,
      isInHouse: true,
      turnaroundHours: 24,
      audience: Audience.EVERYONE,
      isActive: true,
    },
    {
      name: 'Thyroid Stimulating Hormone (TSH)',
      code: 'TSH',
      sampleType: 'Blood',
      price: 399,
      isInHouse: true,
      turnaroundHours: 24,
      audience: Audience.EVERYONE,
      isActive: true,
    },
    {
      name: 'Liver Function Test (LFT)',
      code: 'LFT',
      sampleType: 'Blood',
      price: 349,
      isInHouse: true,
      turnaroundHours: 24,
      audience: Audience.EVERYONE,
      isActive: true,
    },
    {
      name: 'Kidney Function Test (KFT)',
      code: 'KFT',
      sampleType: 'Blood',
      price: 349,
      isInHouse: true,
      turnaroundHours: 24,
      audience: Audience.EVERYONE,
      isActive: true,
    },
    {
      name: 'Fasting Blood Sugar (FBS)',
      code: 'FBS',
      sampleType: 'Blood',
      price: 199,
      isInHouse: true,
      turnaroundHours: 24,
      audience: Audience.EVERYONE,
      isActive: true,
    },
    {
      name: 'Lipid Profile',
      code: 'LIPID',
      sampleType: 'Blood',
      price: 399,
      isInHouse: true,
      turnaroundHours: 24,
      audience: Audience.EVERYONE,
      isActive: true,
    },
    {
      name: 'Vitamin D (25-OH)',
      code: 'VITD',
      sampleType: 'Blood',
      price: 449,
      isInHouse: true,
      turnaroundHours: 48,
      audience: Audience.EVERYONE,
      isActive: true,
    },
    {
      name: 'Vitamin B12',
      code: 'VITB12',
      sampleType: 'Blood',
      price: 399,
      isInHouse: true,
      turnaroundHours: 48,
      audience: Audience.EVERYONE,
      isActive: true,
    },
    {
      name: 'COVID-19 RT-PCR',
      code: 'COVID_RTPCR',
      sampleType: 'Nasopharyngeal Swab',
      price: 599,
      isInHouse: false,
      turnaroundHours: 24,
      audience: Audience.EVERYONE,
      isActive: true,
    },
    {
      name: 'Hemoglobin A1C',
      code: 'HBA1C',
      sampleType: 'Blood',
      price: 299,
      isInHouse: true,
      turnaroundHours: 24,
      audience: Audience.EVERYONE,
      isActive: true,
    },
    // Women's specific tests
    {
      name: 'Thyroid Profile (Women)',
      code: 'THYROID_PROFILE_F',
      sampleType: 'Blood',
      price: 599,
      isInHouse: true,
      turnaroundHours: 24,
      audience: Audience.WOMEN,
      isActive: true,
    },
    {
      name: 'Pap Smear Test',
      code: 'PAP_SMEAR',
      sampleType: 'Cervical Swab',
      price: 799,
      isInHouse: false,
      turnaroundHours: 48,
      audience: Audience.WOMEN,
      isActive: true,
    },
    // Elderly specific tests
    {
      name: 'Bone Density Test (DEXA)',
      code: 'DEXA',
      sampleType: 'Non-invasive',
      price: 1299,
      isInHouse: false,
      turnaroundHours: 24,
      audience: Audience.ELDERLY,
      isActive: true,
    },
  ]);

  console.log(`✅ Created ${tests.length} tests`);

  // Create Packages
  const packageRepo = dataSource.getRepository(Package);
  const packages = await packageRepo.save([
    {
      name: 'Full Body Checkup',
      description: 'Comprehensive health screening with CBC, LFT, KFT, Lipid Profile, FBS',
      price: 1499,
      audience: Audience.EVERYONE,
      isActive: true,
      tests: tests.filter((t) =>
        ['CBC', 'LFT', 'KFT', 'LIPID', 'FBS'].includes(t.code),
      ),
    },
    {
      name: 'Thyroid + Vitamin Combo',
      description: 'TSH, Vitamin D, Vitamin B12 - check thyroid and nutritional deficiencies',
      price: 999,
      audience: Audience.EVERYONE,
      isActive: true,
      tests: tests.filter((t) => ['TSH', 'VITD', 'VITB12'].includes(t.code)),
    },
    {
      name: 'Diabetes Screening',
      description: 'FBS, HbA1c, Lipid Profile - comprehensive diabetes risk assessment',
      price: 799,
      audience: Audience.EVERYONE,
      isActive: true,
      tests: tests.filter((t) =>
        ['FBS', 'HBA1C', 'LIPID'].includes(t.code),
      ),
    },
    {
      name: "Women's Health Essential",
      description: 'CBC, LFT, KFT, Thyroid Profile, Lipid Profile - designed for women',
      price: 1799,
      audience: Audience.WOMEN,
      isActive: true,
      tests: tests.filter((t) =>
        ['CBC', 'LFT', 'KFT', 'THYROID_PROFILE_F', 'LIPID'].includes(t.code),
      ),
    },
    {
      name: "Senior Citizen Health Check",
      description: 'Comprehensive package for 60+ years - includes basic panels and specialist tests',
      price: 2499,
      audience: Audience.ELDERLY,
      isActive: true,
      tests: tests.filter((t) =>
        ['CBC', 'LFT', 'KFT', 'LIPID', 'VITD', 'VITB12', 'TSH'].includes(t.code),
      ),
    },
  ]);

  console.log(`✅ Created ${packages.length} packages`);

  // Create Diagnostic Centers
  const centerRepo = dataSource.getRepository(DiagnosticCenter);
  const centers = await centerRepo.save([
    {
      name: 'Arogya Diagnostics - Main Center',
      address: 'Plot 123, Medical Plaza, Downtown District',
      location: {
        type: 'Point',
        coordinates: [77.5946, 12.9716], // Bangalore
      },
      serviceRadiusKm: 25,
      isActive: true,
    },
    {
      name: 'Arogya Diagnostics - Suburbs',
      address: 'Building A, Tech Park, Suburb Area',
      location: {
        type: 'Point',
        coordinates: [77.6412, 12.9352], // Bangalore suburbs
      },
      serviceRadiusKm: 20,
      isActive: true,
    },
    {
      name: 'Arogya Diagnostics - Outer Ring',
      address: 'Healthcare Hub, Outer Ring Road',
      location: {
        type: 'Point',
        coordinates: [77.5493, 12.9250], // Bangalore outer area
      },
      serviceRadiusKm: 30,
      isActive: true,
    },
  ]);

  console.log(`✅ Created ${centers.length} diagnostic centers`);

  // Create Pickup Points
  const pickupRepo = dataSource.getRepository(PickupPoint);
  const pickupPoints = await pickupRepo.save([
    // For Main Center
    {
      centerId: centers[0].id,
      name: 'Downtown Clinic',
      location: {
        type: 'Point',
        coordinates: [77.5946, 12.9716],
      },
      villageName: 'Bangalore City',
      distanceKm: 0,
      isActive: true,
    },
    {
      centerId: centers[0].id,
      name: 'Medical Square Pickup',
      location: {
        type: 'Point',
        coordinates: [77.6145, 12.9753],
      },
      villageName: 'Bangalore',
      distanceKm: 2.5,
      isActive: true,
    },
    // For Suburbs Center
    {
      centerId: centers[1].id,
      name: 'Tech Park Clinic',
      location: {
        type: 'Point',
        coordinates: [77.6412, 12.9352],
      },
      villageName: 'Whitefield',
      distanceKm: 0,
      isActive: true,
    },
    {
      centerId: centers[1].id,
      name: 'IT Hub Pickup Point',
      location: {
        type: 'Point',
        coordinates: [77.6489, 12.9456],
      },
      villageName: 'Whitefield',
      distanceKm: 1.2,
      isActive: true,
    },
    // For Outer Ring Center
    {
      centerId: centers[2].id,
      name: 'Healthcare Hub Main',
      location: {
        type: 'Point',
        coordinates: [77.5493, 12.9250],
      },
      villageName: 'Outer Ring Road',
      distanceKm: 0,
      isActive: true,
    },
    {
      centerId: centers[2].id,
      name: 'Ring Road Clinic',
      location: {
        type: 'Point',
        coordinates: [77.5389, 12.9189],
      },
      villageName: 'Koramangala',
      distanceKm: 1.8,
      isActive: true,
    },
  ]);

  console.log(`✅ Created ${pickupPoints.length} pickup points`);

  console.log('✨ Database seed completed successfully!');
}
