// server/mw/hash-outgoing.ts
import type { Request, Response, NextFunction } from "express";
import * as crypto from "node:crypto";

function sha(s: string) {
  return crypto.createHash("sha256").update(s).digest("hex");
}

/** Sets X-Content-Hash for res.json/res.send payloads */
export function hashOutgoing() {
  return function (_req: Request, res: Response, next: NextFunction) {
    const send0 = res.send.bind(res);
    const json0 = res.json.bind(res);

    function setHash(payload: any) {
  try {
    const bodyStr =
      typeof payload === "string"
        ? payload
        : Buffer.isBuffer(payload)
        ? payload.toString("utf8")
        : JSON.stringify(payload);
    res.setHeader("X-Content-Hash", sha(bodyStr));
  } catch {
    /* no-op */
  }
}


    // @ts-expect-error override
    res.send = (body: any) => { setHash(body); return send0(body); };

    // @ts-expect-error override
    res.json = (body: any) => { setHash(body); return json0(body); };

    next();
  };
}
