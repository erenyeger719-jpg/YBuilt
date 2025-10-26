import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

const defaultPath = path.resolve(process.cwd(), '.env');
const envPath = process.env.DOTENV_PATH || defaultPath;

if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
  console.log('[ENV] loaded', envPath);
} else {
  console.log('[ENV] not found at', envPath);
}
