import path from 'path';
import fs from 'fs/promises';

export function safeDecodeOnce(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

/**
 * Validate and resolve a requestedPath (query or form input) into an absolute path
 * inside workspaceDir. Throws Error with .code = 400 or 403.
 * Now includes symlink protection via realpath.
 */
export async function validateAndResolvePath(workspaceDir: string, requestedPath: string): Promise<string> {
  if (typeof requestedPath !== 'string' || requestedPath.length === 0) {
    const e: any = new Error('Invalid path');
    e.code = 400;
    throw e;
  }

  // Reject backslashes (windows-style traversal) and leftover percent signs
  if (requestedPath.includes('\\') || requestedPath.includes('%')) {
    const e: any = new Error('Forbidden path');
    e.code = 403;
    throw e;
  }

  const decoded = safeDecodeOnce(requestedPath);

  // normalize to posix separators
  const normalized = path.posix.normalize(decoded.replace(/\\/g, '/'));
  // split segments and detect traversal markers
  const segments = normalized.split('/').filter(Boolean);
  
  if (segments.some(seg => {
    // Exact match for . or ..
    if (seg === '..' || seg === '.') return true;
    // Reject segments with 3+ consecutive dots (suspicious patterns like ....)
    if (/^\.{3,}$/.test(seg)) return true;
    return false;
  })) {
    const e: any = new Error('Forbidden path');
    e.code = 403;
    throw e;
  }

  // Ensure resolved path remains inside workspaceDir
  const resolved = path.resolve(workspaceDir, '.' + path.posix.sep + normalized);
  const workspaceAbs = path.resolve(workspaceDir) + path.sep;
  if (!resolved.startsWith(workspaceAbs)) {
    const e: any = new Error('Forbidden path');
    e.code = 403;
    throw e;
  }

  // Symlink protection: resolve canonical paths
  try {
    const realResolved = await fs.realpath(resolved);
    const realWorkspace = await fs.realpath(workspaceDir);
    
    // Ensure canonical resolved path is within canonical workspace
    if (!realResolved.startsWith(realWorkspace + path.sep)) {
      const e: any = new Error('Forbidden path');
      e.code = 403;
      throw e;
    }
    
    return realResolved;
  } catch (err: any) {
    // Handle ENOENT - file doesn't exist yet, check parent directory
    if (err.code === 'ENOENT') {
      const parentDir = path.dirname(resolved);
      try {
        const realParent = await fs.realpath(parentDir);
        const realWorkspace = await fs.realpath(workspaceDir);
        
        if (!realParent.startsWith(realWorkspace + path.sep) && realParent !== realWorkspace) {
          const e: any = new Error('Forbidden path');
          e.code = 403;
          throw e;
        }
        
        // Return the resolved path (not canonical since it doesn't exist yet)
        return resolved;
      } catch (parentErr: any) {
        // Parent doesn't exist either - that's OK if it's within workspace bounds
        return resolved;
      }
    }
    throw err;
  }
}
