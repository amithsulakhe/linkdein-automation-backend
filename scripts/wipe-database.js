/**
 * Deletes all documents in every MongoDB collection (fresh start).
 * Usage: node scripts/wipe-database.js
 */
import mongoose from 'mongoose';
import { connectDb, disconnectDb } from '../src/config/db.js';
import { logger } from '../src/config/logger.js';

async function main() {
  await connectDb();
  const db = mongoose.connection.db;
  const collections = await db.listCollections().toArray();
  for (const { name } of collections) {
    const result = await db.collection(name).deleteMany({});
    logger.info({ collection: name, deleted: result.deletedCount }, 'Wiped collection');
  }
  await disconnectDb();
  logger.info('Database wipe complete.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
