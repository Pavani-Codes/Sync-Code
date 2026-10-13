import mongoose from 'mongoose';
import dns from 'node:dns';
import { envConfig } from './env.config.js';

// Resolves SRV queries via Google & Cloudflare DNS
dns.setServers(['8.8.8.8', '1.1.1.1']);

export const connectDatabase = async (): Promise<void> => {
  try {
    const conn = await mongoose.connect(envConfig.mongoUri, {
      serverSelectionTimeoutMS: 5000, // Fail fast after 5 seconds if offline
    });
    console.log(`[Database]: Connected to MongoDB -> ${conn.connection.host}`);
  } catch (error) {
    console.warn('[Database]: Warning - Could not connect to MongoDB. Running on in-memory storage fallback.');
    // Do NOT call process.exit(1) here, so the server stays up!
  }
};