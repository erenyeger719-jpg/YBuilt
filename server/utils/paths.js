import path from 'path';

export function safeDecodeOnce(raw) {
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
export function validateAndResolvePath(workspaceDir, requestedPath) {
  if (typeof requestedPath !== 'string' || requestedPath.length === 0) {
    const e = new Error('Invalid path');
    e.code = 400;
    throw e;
  }

  // Reject backslashes (windows-style traversal) and leftover percent signs
  if (requestedPath.includes('\\') || requestedPath.includes('%')) {
    const e = new Error('Forbidden path');
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
    const e = new Error('Forbidden path');
    e.code = 403;
    throw e;
  }

  // Ensure resolved path remains inside workspaceDir
  const resolved = path.resolve(workspaceDir, '.' + path.posix.sep + normalized);
  const workspaceAbs = path.resolve(workspaceDir) + path.sep;
  if (!resolved.startsWith(workspaceAbs)) {
    const e = new Error('Forbidden path');
    e.code = 403;
    throw e;
  }

  return resolved;
}
