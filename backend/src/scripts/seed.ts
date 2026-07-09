import mongoose from 'mongoose';
import User from '../models/User';
import Project from '../models/Project';
import ApiKey from '../models/ApiKey';
import { connectDB } from '../config/db';

async function seed() {
  console.log('[Seed] Starting database seeding...');
  
  // 1. Establish connection
  await connectDB();

  try {
    const email = 'admin@example.com';
    let user = await User.findOne({ email });

    if (user) {
      console.log(`[Seed] User ${email} already exists.`);
    } else {
      user = await User.create({
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

    // 2. Seed a default Project for instant testing
    const projectId = new mongoose.Types.ObjectId('663d12f3fcf12cd7994390aa');
    let project = await Project.findById(projectId);

    if (project) {
      console.log('[Seed] Demo project already exists.');
    } else {
      project = await Project.create({
        _id: projectId,
        name: 'Demo Project',
        ownerId: user._id
      });
      console.log(`[Seed] Successfully created default demo project:`);
      console.log(`  - Project ID: ${project._id}`);
      console.log(`  - Name: ${project.name}`);
    }

    // 3. Seed a default API Key for the project
    const demoApiKey = 'key_demo_api_key_123456';
    // The ApiKey pre-save hook handles hashing, so we check using the hashed key or just check if any key exists for this project
    const existingKey = await ApiKey.findOne({ projectId: project._id });

    if (existingKey) {
      console.log('[Seed] SDK API Key for demo project already exists.');
    } else {
      await ApiKey.create({
        key: demoApiKey,
        projectId: project._id,
        name: 'Default SDK Key'
      });
      console.log(`[Seed] Successfully provisioned SDK API Key:`);
      console.log(`  - API Key: ${demoApiKey}`);
      console.log(`  - Status: Active`);
    }

    console.log('[Seed] Seeding completed successfully!');
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

