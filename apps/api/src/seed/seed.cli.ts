import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { seedDatabase } from './seed';

async function runSeed() {
  const AppDataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'arogya_dev',
    entities: [__dirname + '/../**/entities/*.entity.ts'],
    synchronize: true,
  });

  try {
    await AppDataSource.initialize();
    console.log('✅ Database connection established');
    await seedDatabase(AppDataSource);
    await AppDataSource.destroy();
    console.log('✅ Seed completed and connection closed');
  } catch (error) {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  }
}

runSeed();
