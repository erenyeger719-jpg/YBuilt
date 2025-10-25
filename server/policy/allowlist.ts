// server/policy/allowlist.ts
export type LangKey = 'node' | 'python';

export const LANGS: Record<LangKey, {
  image: string;
  filename: string;
  cmd: string[];
}> = {
  node: {
    image: 'node:20-alpine',
    filename: 'main.js',
    cmd: ['node', '/sandbox/main.js'],
  },
  python: {
    image: 'python:3.11-alpine',
    filename: 'main.py',
    cmd: ['python', '/sandbox/main.py'],
  },
};
