// node tests/personalization.deep.mjs http://localhost:5050
const base = process.argv[2] || "http://localhost:5050";
async function post(path, body, headers = {}) {
  const r = await fetch(`${base}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
  const j = await r.json();
  if (!j.ok) throw new Error(`${path} failed: ${JSON.stringify(j)}`);
  return j;
}
(async () => {
  const cases = [
    {
      name: "header: developers",
      req: {
        path: "/api/ai/act",
        headers: { "x-audience": "developers" },
        body: {
          sessionId: "pd-1",
          spec: { layout: { sections: ["cta-simple"] } },
          action: { kind: "retrieve", args: { sections: ["cta-simple"] } },
        },
      },
    },
    {
      name: "header: founders",
      req: {
        path: "/api/ai/act",
        headers: { "x-audience": "founders" },
        body: {
          sessionId: "pd-2",
          spec: { layout: { sections: ["hero-basic","cta-simple"] } },
          action: { kind: "retrieve", args: { sections: ["hero-basic","cta-simple"] } },
        },
      },
    },
    {
      name: "args: founders (deterministic)",
      req: {
        path: "/api/ai/act",
        headers: {},
        body: {
          sessionId: "pd-3",
          spec: { layout: { sections: ["hero-basic","cta-simple"] } },
          action: { kind: "retrieve", args: { sections: ["hero-basic","cta-simple"], audience: "founders" } },
        },
      },
    },
    {
      name: "spec.intent: developers",
      req: {
        path: "/api/ai/act",
        headers: {},
        body: {
          sessionId: "pd-4",
          spec: { intent: { audience: "developers" }, layout: { sections: ["cta-simple"] } },
          action: { kind: "retrieve", args: { sections: ["cta-simple"] } },
        },
      },
    },
  ];
  for (const c of cases) {
    const j = await post(c.req.path, c.req.body, c.req.headers);
    console.log(`\n[${c.name}]`);
    console.log("sections_in:", c.req.body.action.args.sections.join(","));
    console.log("sections_out:", (j.result.sections || []).join(","));
  }
  console.log("\n— personalization.deep: DONE");
})().catch((e) => { console.error(e); process.exit(1); });
