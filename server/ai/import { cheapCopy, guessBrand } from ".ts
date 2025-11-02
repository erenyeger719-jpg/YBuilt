import { cheapCopy, guessBrand } from "../intent/copy.ts";
import { ledgerFor } from "../ai/intent.ts";

router.post("/chips/apply", contractsHardStop(), async (req, res) => {
  try {
    const prepared: any = (req as any).__prepared;
    if (!prepared) {
      return res.status(500).json({
        ok: false,
        error: "server_error",
        message: "Contracts guard did not prepare the patch.",
      });
    }
    const preview = cheapCopy(prepared);
    const receipt = buildReceipt(prepared.before, prepared.patch, prepared);
    const intent = ledgerFor(prepared.patch?.copy || "");
    const cost = estimateCost(prepared.before, prepared.patch);
    return res.json({ ok: true, preview, meta: { cost, receipt, intent } });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "server_error", message: "Something went wrong on our side." });
  }
});

router.post("/act", contractsHardStop(), async (req, res) => {
  try {
    const { prompt } = req.body || {};
    if (!prompt) return res.status(400).json({ ok: false, error: "bad_request", message: "prompt is required" });

    const prepared: any = (req as any).__prepared || { before: {}, patch: {} };
    const result = await runWithBudget(prompt, prepared); // { patch?, copy?, ... }

    const receipt = buildReceipt(prepared.before, result.patch || {}, prepared);
    const intent = ledgerFor(result.copy || "");
    const cost = estimateCost(prepared.before, result.patch || {});
    return res.json({ ok: true, preview: result, meta: { cost, receipt, intent } });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "server_error", message: "Something went wrong on our side." });
  }
});