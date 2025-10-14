import fs from 'fs';
import path from 'path';
import { run, get, transaction } from './sqlite.js';

interface LowdbUser {
  id: number;
  email: string;
  password_hash: string;
  created_at: number;
}

interface LowdbProject {
  id: number;
  name: string;
  content: string;
  user_id: number | null;
  created_at: number;
  updated_at: number;
}

interface LowdbChat {
  id: number;
  user_id: number | null;
  message: string;
  created_at: number;
}

interface LowdbData {
  users?: LowdbUser[];
  projects?: LowdbProject[];
  chats?: LowdbChat[];
}

/**
 * Convert Unix timestamp to ISO string
 */
function timestampToISO(timestamp: number): string {
  return new Date(timestamp).toISOString();
}

/**
 * Migrate data from lowdb JSON to SQLite
 */
export async function migrateFromLowdb(): Promise<void> {
  const lowdbPath = path.resolve('./data/db.json');
  
  if (!fs.existsSync(lowdbPath)) {
    console.log('No lowdb file found at ./data/db.json - skipping migration');
    return;
  }
  
  console.log('Migrating data from lowdb to SQLite...\n');
  
  const lowdbData: LowdbData = JSON.parse(fs.readFileSync(lowdbPath, 'utf-8'));
  
  let usersImported = 0;
  let projectsImported = 0;
  let chatsImported = 0;
  let usersSkipped = 0;
  
  transaction(() => {
    // Migrate users
    if (lowdbData.users && lowdbData.users.length > 0) {
      console.log(`Migrating ${lowdbData.users.length} users...`);
      
      for (const user of lowdbData.users) {
        // Check if user already exists
        const existing = get('SELECT id FROM users WHERE email = ?', [user.email]);
        
        if (existing) {
          console.log(`  Skipping user ${user.email} (already exists)`);
          usersSkipped++;
          continue;
        }
        
        run(
          'INSERT INTO users (id, email, password_hash, created_at) VALUES (?, ?, ?, ?)',
          [user.id, user.email, user.password_hash, timestampToISO(user.created_at)]
        );
        usersImported++;
      }
    }
    
    // Migrate projects
    if (lowdbData.projects && lowdbData.projects.length > 0) {
      console.log(`\nMigrating ${lowdbData.projects.length} projects...`);
      
      for (const project of lowdbData.projects) {
        // Skip if user_id is null
        if (!project.user_id) {
          console.log(`  Skipping project ${project.id} (no user_id)`);
          continue;
        }
        
        // Check if user exists
        const userExists = get('SELECT id FROM users WHERE id = ?', [project.user_id]);
        if (!userExists) {
          console.log(`  Skipping project ${project.id} (user ${project.user_id} doesn't exist)`);
          continue;
        }
        
        run(
          'INSERT INTO projects (id, user_id, name, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
          [
            project.id,
            project.user_id,
            project.name,
            project.content,
            timestampToISO(project.created_at),
            timestampToISO(project.updated_at)
          ]
        );
        projectsImported++;
      }
    }
    
    // Migrate chats
    if (lowdbData.chats && lowdbData.chats.length > 0) {
      console.log(`\nMigrating ${lowdbData.chats.length} chat messages...`);
      
      for (const chat of lowdbData.chats) {
        // Skip if user_id is null
        if (!chat.user_id) {
          console.log(`  Skipping chat ${chat.id} (no user_id)`);
          continue;
        }
        
        // Check if user exists
        const userExists = get('SELECT id FROM users WHERE id = ?', [chat.user_id]);
        if (!userExists) {
          console.log(`  Skipping chat ${chat.id} (user ${chat.user_id} doesn't exist)`);
          continue;
        }
        
        run(
          'INSERT INTO chats (id, user_id, message, created_at) VALUES (?, ?, ?, ?)',
          [chat.id, chat.user_id, chat.message, timestampToISO(chat.created_at)]
        );
        chatsImported++;
      }
    }
  });
  
  console.log(`\n✓ Migration complete!`);
  console.log(`  Users: ${usersImported} imported, ${usersSkipped} skipped`);
  console.log(`  Projects: ${projectsImported} imported`);
  console.log(`  Chats: ${chatsImported} imported`);
}

// Run migration if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  migrateFromLowdb()
    .then(() => {
      console.log('\nMigration from lowdb complete!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration error:', error);
      process.exit(1);
    });
}
