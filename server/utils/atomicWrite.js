import fs from 'fs/promises';
import { randomUUID } from 'crypto';
import path from 'path';

// Feature flag for parent directory fsync (default: true)
const USE_ATOMIC_FSYNC = process.env.USE_ATOMIC_FSYNC !== 'false';

// Lazy-load telemetry counter to avoid circular dependencies and test issues
let atomicWriteFailuresCounter = null;
let telemetryLoaded = false;

async function getTelemetryCounter() {
  if (!telemetryLoaded) {
    try {
      const telemetry = await import('../telemetry.js');
      atomicWriteFailuresCounter = telemetry.atomicWriteFailuresCounter;
    } catch (err) {
      // Telemetry not available (e.g., in test environment or build)
    }
    telemetryLoaded = true;
  }
  return atomicWriteFailuresCounter;
}

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
    
    // Parent directory fsync for durability
    if (USE_ATOMIC_FSYNC) {
      let dirFd = null;
      try {
        dirFd = await fs.open(dir, 'r');
        await dirFd.sync();
        await dirFd.close();
        dirFd = null;
      } catch (fsyncErr) {
        // Log the error but don't fail the operation - file is already renamed
        console.error('[ATOMIC_WRITE] Parent dir fsync failed:', fsyncErr.message);
        const counter = await getTelemetryCounter();
        if (counter) {
          counter.inc();
        }
        // Ensure dirFd is closed even on error
        if (dirFd !== null) {
          try {
            await dirFd.close();
          } catch (_) {
            // Ignore close errors
          }
        }
      }
    }
  } catch (err) {
    // Clean up temp file on error
    try { 
      await fs.unlink(tmpPath); 
    } catch (_) {
      // Ignore unlink errors
    }
    const counter = await getTelemetryCounter();
    if (counter) {
      counter.inc();
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
