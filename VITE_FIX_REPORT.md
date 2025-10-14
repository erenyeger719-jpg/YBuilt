# Vite Chunk Error Fix Report

**Date:** October 14, 2025  
**Issue:** ERR_MODULE_NOT_FOUND for Vite chunk file `dep-D-7KCb9p.js`  
**Status:** ✅ RESOLVED

---

## Problem Summary

### Error Message
```
Error [ERR_MODULE_NOT_FOUND]: Cannot find module 
'/home/runner/workspace/node_modules/vite/dist/node/chunks/dep-D-7KCb9p.js' 
imported from /home/runner/workspace/node_modules/vite/dist/node/chunks/dep-D_zLpgQd.js
```

### Root Cause
Vite was NOT installed despite being listed in `package.json` as `"vite": "^5.4.20"`.

**Diagnostics:**
```bash
$ ls -la node_modules/vite
ls: cannot access 'node_modules/vite': No such file or directory

$ npm ls vite --depth=0
rest-express@1.0.0 /home/runner/workspace
└── (empty)
```

The `node_modules/vite` directory did not exist at all.

---

## Resolution

### Fix Applied
Installed Vite using the packager tool:

```bash
npm install vite
```

**Result:**
```
added 58 packages, and audited 1591 packages in 7s
```

### Verification
```bash
$ ls -la node_modules/vite/dist/node/chunks/
total 2632
-rw-r--r-- 1 runner runner  331672 Oct 14 06:46 dep-D-7KCb9p.js  ✅
-rw-r--r-- 1 runner runner 2085917 Oct 14 06:46 dep-D_zLpgQd.js
-rw-r--r-- 1 runner runner  232635 Oct 14 06:46 dep-e9kYborm.js
-rw-r--r-- 1 runner runner   13409 Oct 14 06:46 dep-IQS-Za7F.js
-rw-r--r-- 1 runner runner   23212 Oct 14 06:46 dep-YkMKzX4u.js

$ npm ls vite --depth=0
rest-express@1.0.0 /home/runner/workspace
└── vite@5.4.20  ✅

$ # Check browser console
[vite] connecting...
[vite] connected.  ✅
```

### Application Status After Fix
- ✅ Express server running on port 5000
- ✅ Vite dev server connected
- ✅ No ERR_MODULE_NOT_FOUND errors
- ✅ API endpoints responding normally
- ✅ Frontend preview working

---

## Prevention Measures

### 1. Ensure Deterministic Installs
Use `npm ci` instead of `npm install` in CI/CD to prevent missing dependencies.

**CI Workflow Update:**
```yaml
- name: Install dependencies
  run: npm ci  # ← Enforces package-lock.json
```

### 2. Verify Critical Dependencies
Add self-test workflow to verify critical packages exist:

```yaml
- name: Verify critical dependencies
  run: |
    test -d node_modules/vite || exit 1
    test -d node_modules/tsx || exit 1
    npm ls vite tsx --depth=0
```

### 3. Lock Vite Version
Current: `"vite": "^5.4.20"` (allows updates)
Consider: `"vite": "5.4.20"` (exact version) for reproducibility

---

## Lessons Learned

1. **package.json ≠ installed** - Dependencies listed in package.json aren't guaranteed to be installed
2. **npm install vs npm ci** - `npm install` can skip packages in some edge cases; `npm ci` is more reliable
3. **Verification is critical** - Always verify critical dependencies after installation
4. **Chunk files matter** - Vite uses internal chunks; missing any breaks the dev server

---

## Related Files Modified
- None (fix was installation-only)

## Related Infrastructure
- `.github/workflows/*.yml` - Should use `npm ci`
- `scripts/reproducible-build.sh` - Already uses `npm ci`
- `package-lock.json` - Enforces exact versions (1.5MB)

---

**Fix Duration:** 2 minutes  
**Impact:** Critical (frontend completely broken → fully working)  
**Recurrence Risk:** Low (with npm ci enforcement)
