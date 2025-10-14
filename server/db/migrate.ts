import fs from 'fs';
import path from 'path';
import { db, run, all } from './sqlite.js';

/**
 * Migration tracking table
 */
function createMigrationsTable(): void {
  run(`
    CREATE TABLE IF NOT EXISTS _migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
}

/**
 * Get list of applied migrations
 */
function getAppliedMigrations(): number[] {
  const migrations = all<{ version: number }>('SELECT version FROM _migrations ORDER BY version');
  return migrations.map(m => m.version);
}

/**
 * Apply a migration file
 */
function applyMigration(version: number, sql: string): void {
  console.log(`Applying migration ${version}...`);
  
  // Run migration in transaction
  db.transaction(() => {
    // Execute migration SQL
    db.exec(sql);
    
    // Record migration
    run('INSERT INTO _migrations (version) VALUES (?)', [version]);
  })();
  
  console.log(`✓ Migration ${version} applied successfully`);
}

/**
 * Run all pending migrations
 */
export async function runMigrations(): Promise<void> {
  console.log('Running database migrations...\n');
  
  // Create migrations tracking table
  createMigrationsTable();
  
  // Get applied migrations
  const applied = getAppliedMigrations();
  console.log(`Applied migrations: ${applied.length > 0 ? applied.join(', ') : 'none'}`);
  
  // Get migration files
  const migrationsDir = path.join(process.cwd(), 'server', 'db', 'migrations');
  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();
  
  if (files.length === 0) {
    console.log('No migration files found');
    return;
  }
  
  // Apply pending migrations
  let appliedCount = 0;
  for (const file of files) {
    // Extract version from filename (e.g., 001_init.sql -> 1)
    const version = parseInt(file.split('_')[0], 10);
    
    if (applied.includes(version)) {
      console.log(`Skipping migration ${version} (already applied)`);
      continue;
    }
    
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
    applyMigration(version, sql);
    appliedCount++;
  }
  
  if (appliedCount === 0) {
    console.log('\n✓ All migrations up to date');
  } else {
    console.log(`\n✓ Applied ${appliedCount} migration(s) successfully`);
  }
}

// Run migrations if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runMigrations()
    .then(() => {
      console.log('\nMigrations complete!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration error:', error);
      process.exit(1);
    });
}
