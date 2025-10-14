import bcrypt from 'bcryptjs';
import { run, get } from './sqlite.js';

/**
 * Seed demo user and sample data
 */
export async function seed(): Promise<void> {
  console.log('Seeding database...\n');
  
  // Check if demo user exists
  const existingUser = get<{ id: number }>('SELECT id FROM users WHERE email = ?', ['demo@example.com']);
  
  if (existingUser) {
    console.log('✓ Demo user already exists (demo@example.com)');
    return;
  }
  
  // Create demo user with password: demo1234
  const passwordHash = await bcrypt.hash('demo1234', 10);
  const userResult = run(
    'INSERT INTO users (email, password_hash) VALUES (?, ?)',
    ['demo@example.com', passwordHash]
  );
  
  console.log(`✓ Created demo user: demo@example.com (password: demo1234)`);
  
  const userId = userResult.lastInsertRowid;
  
  // Create sample project
  const projectResult = run(
    'INSERT INTO projects (user_id, name, content) VALUES (?, ?, ?)',
    [userId, 'My First Project', '# Welcome to YBuilt\n\nThis is a sample project.']
  );
  
  console.log(`✓ Created sample project (ID: ${projectResult.lastInsertRowid})`);
  
  // Create sample chat message
  const chatResult = run(
    'INSERT INTO chats (user_id, message) VALUES (?, ?)',
    [userId, 'Welcome to YBuilt! How can I help you build today?']
  );
  
  console.log(`✓ Created sample chat message (ID: ${chatResult.lastInsertRowid})`);
  
  console.log('\n✓ Database seeded successfully!');
}

// Run seed if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seed()
    .then(() => {
      console.log('\nSeeding complete!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Seed error:', error);
      process.exit(1);
    });
}
