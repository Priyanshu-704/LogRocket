import mongoose from 'mongoose';
import config from './index';

export async function connectDB(): Promise<void> {
  try {
    const conn = await mongoose.connect(config.mongoUri);
    console.log(`[Database] MongoDB Connected: ${conn.connection.host}`);
  } catch (err) {
    console.error(`[Database] Connection Error:`, err);
    process.exit(1);
  }
}
