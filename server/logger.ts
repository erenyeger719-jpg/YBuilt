import util from 'util';

const LEVELS: Record<string, number> = { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3 };
const LEVEL = process.env.LOG_LEVEL?.toUpperCase() ?? 'INFO';
const threshold = LEVELS[LEVEL] ?? 1;
const FORMAT = process.env.LOG_FORMAT === 'json' ? 'json' : 'text';
const REDACT_KEYS = (process.env.LOG_REDACT_KEYS || 'authorization,razorpay_key,razorpay_secret,password,ssn').split(',');

function redact(obj: any) {
  if (!obj || typeof obj !== 'object') return obj;
  const copy: any = Array.isArray(obj) ? [...obj] : { ...obj };
  for (const k of Object.keys(copy)) {
    if (REDACT_KEYS.includes(k)) copy[k] = '<<REDACTED>>';
    else if (typeof copy[k] === 'object') copy[k] = redact(copy[k]);
  }
  return copy;
}

function format(level: string, args: any[]) {
  const message = args.map(a => (typeof a === 'object' ? util.inspect(redact(a), { depth: 5 }) : String(a))).join(' ');
  if (FORMAT === 'json') {
    return JSON.stringify({ ts: new Date().toISOString(), level, msg: message });
  }
  return `[${level}] ${new Date().toISOString()} ${message}`;
}

export const logger = {
  debug: (...args: any[]) => { if (threshold <= 0) console.log(format('DEBUG', args)); },
  info:  (...args: any[]) => { if (threshold <= 1) console.log(format('INFO', args)); },
  warn:  (...args: any[]) => { if (threshold <= 2) console.warn(format('WARN', args)); },
  error: (...args: any[]) => { if (threshold <= 3) console.error(format('ERROR', args)); },
};
