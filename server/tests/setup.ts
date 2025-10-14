import { beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import path from 'path';

// Use test database
process.env.DATABASE_FILE = './data/test.db';
process.env.JWT_SECRET = 'test-secret-key-for-testing-only';
process.env.NODE_ENV = 'test';

beforeAll(async () => {
  // Ensure test data directory exists
  const testDbPath = path.resolve(process.env.DATABASE_FILE!);
  const testDbDir = path.dirname(testDbPath);
  
  if (!fs.existsSync(testDbDir)) {
    fs.mkdirSync(testDbDir, { recursive: true });
  }
  
  // Remove old test database if exists
  if (fs.existsSync(testDbPath)) {
    fs.unlinkSync(testDbPath);
  }
  
  // Run migrations
  const { runMigrations } = await import('../db/migrate.js');
  await runMigrations();
});

afterAll(() => {
  // Clean up test database
  const testDbPath = path.resolve(process.env.DATABASE_FILE!);
  if (fs.existsSync(testDbPath)) {
    fs.unlinkSync(testDbPath);
  }
});
