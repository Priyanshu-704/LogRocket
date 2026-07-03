import mongoose from 'mongoose';
import User from '../models/User';
import { connectDB } from '../config/db';
import config from '../config';

async function seed() {
  console.log('[Seed] Starting database seeding...');
  
  // 1. Establish connection
  await connectDB();

  try {
    const email = 'admin@example.com';
    const existing = await User.findOne({ email });

    if (existing) {
      console.log(`[Seed] User ${email} already exists. Skipping.`);
    } else {
      const user = await User.create({
        name: 'Default Developer',
        email,
        password: 'password123',
        role: 'developer'
      });
      console.log(`[Seed] Successfully created default user:`);
      console.log(`  - Name: ${user.name}`);
      console.log(`  - Email: ${user.email}`);
      console.log(`  - Password: password123`);
    }
  } catch (err) {
    console.error('[Seed] Seeding failed with error:', err);
  } finally {
    await mongoose.connection.close();
    console.log('[Seed] MongoDB connection closed.');
  }
}

seed().catch(err => {
  console.error('[Seed] Critical failure:', err);
  process.exit(1);
});
