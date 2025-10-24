// server/routes/teams.js
const fs = require("fs");
const path = require("path");
const DB = path.join(process.cwd(), "server/data/teams.json");

function load() {
  try {
    return JSON.parse(fs.readFileSync(DB, "utf8"));
  } catch {
    return { teams: [], invites: [] };
  }
}
function save(d) {
  fs.mkdirSync(path.dirname(DB), { recursive: true });
  fs.writeFileSync(DB, JSON.stringify(d, null, 2));
}
const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
const slugify = (s) =>
  String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
function requireUser(req) {
  const id = req.user?.id || req.headers["x-demo-user"] || "demo-user";
  return { id, email: req.user?.email || "demo@example.com", name: req.user?.name || "Demo" };
}

function session(req, res) {
  const user = requireUser(req);
  const d = load();
  const teamId = req.cookies?.teamId || req.headers["x-team-id"] || null;
  const mine = d.teams.filter(
    (t) => t.ownerId === user.id || t.members.some((m) => m.userId === user.id)
  );
  const current = (teamId && mine.find((t) => t.id === teamId)) || mine[0] || null;
  res.json({ ok: true, user, currentTeam: current, teams: mine });
}
function create(req, res) {
  const user = requireUser(req);
  const d = load();
  const name = String(req.body?.name || "Team").slice(0, 60);
  const team = {
    id: uid(),
    name,
    slug: slugify(name),
    ownerId: user.id,
    members: [{ userId: user.id, role: "owner" }],
    createdAt: Date.now(),
  };
  d.teams.unshift(team);
  save(d);
  res.json({ ok: true, team });
}
function mine(req, res) {
  const user = requireUser(req);
  const d = load();
  const teams = d.teams.filter(
    (t) => t.ownerId === user.id || t.members.some((m) => m.userId === user.id)
  );
  res.json({ ok: true, teams });
}
function switchTeam(req, res) {
  const user = requireUser(req);
  const { teamId } = req.body || {};
  const d = load();
  const team = d.teams.find((t) => t.id === teamId);
  if (!team) return res.status(404).json({ ok: false, error: "not found" });
  const isMember = team.ownerId === user.id || team.members.some((m) => m.userId === user.id);
  if (!isMember) return res.status(403).json({ ok: false, error: "forbidden" });
  res.cookie("teamId", teamId, { httpOnly: false, sameSite: "lax" });
  res.json({ ok: true });
}
function invite(req, res) {
  const user = requireUser(req);
  const { teamId, email, role } = req.body || {};
  const d = load();
  const team = d.teams.find((t) => t.id === teamId);
  if (!team) return res.status(404).json({ ok: false, error: "not found" });
  const isAdmin =
    team.ownerId === user.id ||
    team.members.some((m) => ["admin", "owner"].includes(m.role) && m.userId === user.id);
  if (!isAdmin) return res.status(403).json({ ok: false, error: "forbidden" });
  const inv = {
    id: uid(),
    teamId,
    email: String(email || "").toLowerCase(),
    role: role === "viewer" ? "viewer" : "editor",
    token: uid(),
    status: "pending",
    createdAt: Date.now(),
  };
  d.invites.unshift(inv);
  save(d);
  res.json({ ok: true, invite: inv });
}
function accept(req, res) {
  const user = requireUser(req);
  const { token } = req.body || {};
  const d = load();
  const inv = d.invites.find((i) => i.token === token && i.status === "pending");
  if (!inv) return res.status(404).json({ ok: false, error: "invalid" });
  const team = d.teams.find((t) => t.id === inv.teamId);
  if (!team) return res.status(404).json({ ok: false, error: "not found" });
  if (!team.members.some((m) => m.userId === user.id))
    team.members.push({ userId: user.id, role: inv.role });
  inv.status = "accepted";
  save(d);
  res.json({ ok: true, teamId: team.id });
}

// --- extra handlers ---
const adminRoles = new Set(["owner", "admin"]);
const editableRoles = new Set(["admin", "editor", "viewer"]);

function detail(req, res) {
  const user = requireUser(req);
  const teamId = req.params.id;
  const d = load();
  const team = d.teams.find((t) => t.id === teamId);
  if (!team) return res.status(404).json({ ok: false, error: "not found" });
  const isMember = team.ownerId === user.id || team.members.some((m) => m.userId === user.id);
  if (!isMember) return res.status(403).json({ ok: false, error: "forbidden" });
  const invites = (d.invites || []).filter((i) => i.teamId === teamId).slice(0, 200);
  res.json({ ok: true, team, invites });
}

function updateRole(req, res) {
  const user = requireUser(req);
  const { teamId, userId, role } = req.body || {};
  if (!teamId || !userId || !editableRoles.has(role))
    return res.status(400).json({ ok: false, error: "bad args" });
  const d = load();
  const team = d.teams.find((t) => t.id === teamId);
  if (!team) return res.status(404).json({ ok: false, error: "not found" });
  const me = team.ownerId === user.id ? { role: "owner" } : team.members.find((m) => m.userId === user.id);
  if (!me || !adminRoles.has(me.role)) return res.status(403).json({ ok: false, error: "forbidden" });
  if (userId === team.ownerId) return res.status(400).json({ ok: false, error: "cannot change owner" });

  const idx = team.members.findIndex((m) => m.userId === userId);
  if (idx === -1) {
    team.members.push({ userId, role });
  } else {
    team.members[idx].role = role;
  }
  save(d);
  res.json({ ok: true });
}

function removeMember(req, res) {
  const user = requireUser(req);
  const { teamId, userId } = req.body || {};
  if (!teamId || !userId) return res.status(400).json({ ok: false, error: "bad args" });
  const d = load();
  const team = d.teams.find((t) => t.id === teamId);
  if (!team) return res.status(404).json({ ok: false, error: "not found" });
  const me = team.ownerId === user.id ? { role: "owner" } : team.members.find((m) => m.userId === user.id);
  if (!me || !adminRoles.has(me.role)) return res.status(403).json({ ok: false, error: "forbidden" });
  if (userId === team.ownerId) return res.status(400).json({ ok: false, error: "cannot remove owner" });
  team.members = team.members.filter((m) => m.userId !== userId);
  save(d);
  res.json({ ok: true });
}

function revokeInvite(req, res) {
  const user = requireUser(req);
  const { inviteId } = req.body || {};
  const d = load();
  const inv = (d.invites || []).find((i) => i.id === inviteId);
  if (!inv) return res.status(404).json({ ok: false, error: "not found" });
  const team = d.teams.find((t) => t.id === inv.teamId);
  const me = team && (team.ownerId === user.id ? { role: "owner" } : team.members.find((m) => m.userId === user.id));
  if (!me || !adminRoles.has(me.role)) return res.status(403).json({ ok: false, error: "forbidden" });
  inv.status = "revoked";
  save(d);
  res.json({ ok: true });
}

function resendInvite(req, res) {
  const user = requireUser(req);
  const { inviteId } = req.body || {};
  const d = load();
  const inv = (d.invites || []).find((i) => i.id === inviteId);
  if (!inv) return res.status(404).json({ ok: false, error: "not found" });
  const team = d.teams.find((t) => t.id === inv.teamId);
  const me = team && (team.ownerId === user.id ? { role: "owner" } : team.members.find((m) => m.userId === user.id));
  if (!me || !adminRoles.has(me.role)) return res.status(403).json({ ok: false, error: "forbidden" });
  inv.token = uid();
  inv.status = "pending";
  inv.createdAt = Date.now();
  save(d);
  res.json({ ok: true, token: inv.token });
}

// Named exports (ESM-friendly)
exports.session = session;
exports.create = create;
exports.mine = mine;
exports.switch = switchTeam;
exports.invite = invite;
exports.accept = accept;
exports.detail = detail;
exports.updateRole = updateRole;
exports.removeMember = removeMember;
exports.revokeInvite = revokeInvite;
exports.resendInvite = resendInvite;

// interop
module.exports.default = module.exports;
