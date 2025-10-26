import path from 'path';
export function safeJoinTeam(teamId: string|null, rel: string) {
  const base = path.resolve('.cache', 'teams', String(teamId || 'anon'));
  return path.resolve(base, rel.replace(/^\/+/, ''));
}
