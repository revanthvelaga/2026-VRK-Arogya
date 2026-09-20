import 'reflect-metadata';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { DataSource } from 'typeorm';
import { seedDatabase } from './seed';

dotenv.config({ path: path.join(__dirname, '../../.env') });

async function runSeed() {
  const AppDataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '55432'),
    username: process.env.DB_USERNAME || 'arogya',
    password: process.env.DB_PASSWORD || 'arogya_dev_pw',
    database: process.env.DB_NAME || 'arogya',
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
