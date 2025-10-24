// server/routes/_teamPaths.js
const path = require("path");
function safeJoinTeam(teamId, previewPath){
  const rel = String(previewPath||"").replace(/^\/+/, "").replace(/\.\./g,"");
  const base = teamId ? path.join("teams", String(teamId), "previews") : "previews";
  return path.join(process.cwd(), base, rel.replace(/^previews\//,""));
}
exports.safeJoinTeam = safeJoinTeam;
module.exports.default = module.exports;
