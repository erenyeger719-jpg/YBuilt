import path from 'path';

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
 */
export function validateAndResolvePath(workspaceDir: string, requestedPath: string): string {
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
  if (segments.some(seg => seg === '..' || seg === '.')) {
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

  return resolved;
}
