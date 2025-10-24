// server/routes/previews.remove-file.js
const fs = require("fs");
const path = require("path");
const { safeJoinTeam } = require("./_teamPaths");

exports.removeFile = (req, res) => {
  try {
    const { path: pp, file } = req.body || {};
    if (!pp || !file)
      return res.status(400).json({ ok: false, error: "bad args" });

    const teamId = req.cookies?.teamId || req.headers["x-team-id"] || null;
    const abs = safeJoinTeam(teamId, pp);
    fs.unlinkSync(path.join(abs, file));
    res.json({ ok: true });
  } catch (e) {
    res
      .status(500)
      .json({ ok: false, error: e?.message || "delete failed" });
  }
};

// interop for ESM default import
module.exports.default = module.exports;
