import fs from 'fs/promises';
import { randomUUID } from 'crypto';
import path from 'path';

export async function atomicWriteFile(finalPath, data, options = {}) {
  const dir = path.dirname(finalPath);
  const tmpPath = path.join(dir, `.tmp-${randomUUID()}`);
  let fd = null;
  
  try {
    // open the tmp file descriptor directly so we can fsync
    fd = await fs.open(tmpPath, 'w');
    
    if (typeof data === 'string' || Buffer.isBuffer(data)) {
      await fd.writeFile(data, options);
    } else {
      // if stream-like or object, stringify
      await fd.writeFile(JSON.stringify(data, null, 2), options);
    }
    
    await fd.sync();
    await fd.close();
    fd = null; // Mark as closed
    
    // rename is atomic on same fs
    await fs.rename(tmpPath, finalPath);
  } catch (err) {
    // Clean up temp file on error
    try { 
      await fs.unlink(tmpPath); 
    } catch (_) {
      // Ignore unlink errors
    }
    throw err;
  } finally {
    // Ensure file descriptor is always closed
    if (fd !== null) {
      try {
        await fd.close();
      } catch (_) {
        // Ignore close errors in cleanup
      }
    }
  }
}
