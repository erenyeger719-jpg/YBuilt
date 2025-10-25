// server/logs.sink.jsonl.js
import fs from 'fs';
import path from 'path';
import { logsBus } from './logs.js';

const ENABLE = String(process.env.LOG_JSONL || 'false') === 'true';
const LOG_DIR = process.env.LOG_DIR || './data/logs';
const HOOK_URL = process.env.LOG_WEBHOOK_URL || '';
const HOOK_MS = Math.max(1000, parseInt(process.env.LOG_WEBHOOK_BATCH_MS || '5000', 10));

if (ENABLE) {
  console.log('[LOGS] JSONL sink enabled at', LOG_DIR);

  // ensure dir
  fs.mkdirSync(LOG_DIR, { recursive: true });

  let currentDate = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  let stream = fs.createWriteStream(path.join(LOG_DIR, `app-${currentDate}.log`), { flags: 'a' });

  function rotateIfNeeded() {
    const today = new Date().toISOString().slice(0, 10);
    if (today !== currentDate) {
      try { stream.end(); } catch {}
      currentDate = today;
      stream = fs.createWriteStream(path.join(LOG_DIR, `app-${currentDate}.log`), { flags: 'a' });
    }
  }

  logsBus.on('log', (row) => {
    try {
      rotateIfNeeded();
      // keep line compact & consistent
      const line = JSON.stringify({
        ts: row.ts || Date.now(),
        level: row.level || 'info',
        source: row.source || 'server',
        type: row.type || 'log',
        rid: row.rid || '',
        method: row.method || '',
        path: row.path || '',
        status: typeof row.status === 'number' ? row.status : undefined,
        ms: typeof row.ms === 'number' ? row.ms : undefined,
        message: row.message,
        stack: row.stack,
        ip: row.ip,
        ua: row.ua,
        extras: row.extras,
      });
      stream.write(line + '\n');
    } catch {}
  });

  // optional webhook fan-out (batched)
  if (HOOK_URL) {
    const buf = [];
    let timer = null;
    function flush() {
      timer = null;
      if (buf.length === 0) return;
      const payload = JSON.stringify({ items: buf.splice(0, buf.length) });
      // best-effort POST using global fetch (Node 18+)
      fetch(HOOK_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: payload,
      }).catch(() => {});
    }
    function schedule() {
      if (!timer) timer = setTimeout(flush, HOOK_MS);
    }
    logsBus.on('log', (row) => {
      // push normalized row only (same shape as file)
      buf.push({
        ts: row.ts || Date.now(),
        level: row.level || 'info',
        source: row.source || 'server',
        type: row.type || 'log',
        rid: row.rid || '',
        method: row.method || '',
        path: row.path || '',
        status: typeof row.status === 'number' ? row.status : undefined,
        ms: typeof row.ms === 'number' ? row.ms : undefined,
        message: row.message,
        stack: row.stack,
        ip: row.ip,
        ua: row.ua,
        extras: row.extras,
      });
      if (buf.length >= 200) flush(); else schedule();
    });
  }
}
