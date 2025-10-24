// server/routes/ai.qna.js
const fs = require("fs");
const { safeJoinTeam } = require("./_teamPaths");

function safePath(teamId, previewPath) {
  return safeJoinTeam(teamId, previewPath || "");
}
function readFileSafe(absDir, file) {
  try { return fs.readFileSync(require("path").join(absDir, file), "utf8"); } catch { return ""; }
}

exports.qna = async (req, res) => {
  try {
    const { path: previewPath, file, question, tier } = req.body || {};
    const teamId = req.cookies?.teamId || req.headers["x-team-id"] || null;
    const abs = safePath(teamId, previewPath);
    const html = readFileSafe(abs, "index.html");
    const css  = readFileSafe(abs, "styles.css");
    const js   = readFileSafe(abs, "app.js");
    const target = readFileSafe(abs, file || "index.html");

    const system = `You are a helpful code assistant. Be concise.`;
    const user = [
      `Question about file: ${file || "index.html"}`,
      "",
      "---- FILE START ----",
      target.slice(0, 15000),
      "---- FILE END ----",
      "",
      "Project context (optional):",
      "/* index.html */", html.slice(0, 8000),
      "/* styles.css */", css.slice(0, 8000),
      "/* app.js */", js.slice(0, 8000),
      "",
      `Question: ${String(question || "").slice(0, 1500)}`
    ].join("\n");

    // If no key, return a mock so UI works
    if (!process.env.OPENAI_API_KEY) {
      return res.json({ ok: true, answer: "Mock answer (no OPENAI_API_KEY set). The issue is likely in your CSS selector; ensure the class names match and the stylesheet is linked." });
    }

    // Use built-in fetch (Node 18+)
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "system", content: system }, { role: "user", content: user }],
        temperature: tier === "best" ? 0.2 : 0.1,
      }),
    });
    const data = await r.json();
    const answer = data?.choices?.[0]?.message?.content || "No answer.";
    res.json({ ok: true, answer });
  } catch (e) {
    res.status(500).json({ ok: false, error: e?.message || "qna failed" });
  }
};

// ESM/CJS interop
module.exports.default = module.exports;
