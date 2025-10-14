import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import fs from 'fs';
import path from 'path';

export interface DbUser {
  id: number;
  email: string;
  password_hash: string;
  created_at: number;
}

export interface DbProject {
  id: number;
  name: string;
  content: string;
  user_id: number | null;
  created_at: number;
  updated_at: number;
}

export interface DbChat {
  id: number;
  user_id: number | null;
  message: string;
  created_at: number;
}

export interface DatabaseSchema {
  users: DbUser[];
  projects: DbProject[];
  chats: DbChat[];
}

export type Database = Low<DatabaseSchema>;

export async function initDb(file: string = './data/db.json'): Promise<Database> {
  try {
    const filePath = path.resolve(file);
    const dir = path.dirname(filePath);
    
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const adapter = new JSONFile<DatabaseSchema>(filePath);
    const db = new Low<DatabaseSchema>(adapter, { users: [], projects: [], chats: [] });

    await db.read();
    
    db.data ||= { users: [], projects: [], chats: [] };
    
    await db.write();

    return db;
  } catch (error) {
    console.error('DB initialization error:', error);
    throw error;
  }
}
