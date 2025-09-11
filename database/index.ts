/**
 * CythroDash - MongoDB Database Connection and Configuration
 *
 * DISCLAIMER: This code is provided as-is for CythroDash.
 * Any modifications or issues arising from the use of this code
 * are not the responsibility of the original developers.
 */

import { MongoClient, Db } from 'mongodb';

let client: MongoClient;
let db: Db;

export async function connectToDatabase(): Promise<Db> {
  if (db) {
    return db;
  }

  // Prefer database-driven config with env fallback
  const { getConfig } = await import('./config-manager.js')
  const uri: string | undefined = await (getConfig as any)('database.uri', process.env.MONGODB_URI)
  if (!uri) {
    throw new Error('Database URI is not configured. Set MONGODB_URI or run `npx cythrodash setup`.');
  }

  try {
    client = new MongoClient(uri);
    await client.connect();
    db = client.db(); // Uses database from connection string
    console.log('Connected to MongoDB successfully');
    try {
      const { primeEnvFromDb } = await import('./config-manager.js')
      await (primeEnvFromDb as any)()
    } catch {}
    return db;
  } catch (error) {
    console.error('Failed to connect to MongoDB:', error);
    throw error;
  }
}

export async function closeDatabaseConnection(): Promise<void> {
  if (client) {
    await client.close();
    console.log('MongoDB connection closed');
  }
}

export { db };