import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  vus: 10,
  duration: "2m",
  thresholds: { http_req_duration: ["p(95)<450"] },
};

export default function () {
  const base = `${__ENV.BASE || "http://localhost:3000"}`;
  const retrieve = http.post(`${base}/api/ai/act`, JSON.stringify({
    sessionId: "k6",
    spec: { layout: { sections: ["hero-basic"] } },
    action: { kind: "retrieve", args: { sections: ["hero-basic"], audience: "founders" } }
  }), { headers: { "Content-Type": "application/json" } });

  const sections = (retrieve.json()?.result?.sections) || ["hero-basic","pricing-simple"];

  const compose = http.post(`${base}/api/ai/act`, JSON.stringify({
    sessionId: "k6",
    spec: { layout: { sections } },
    action: { kind: "compose", args: { sections } }
  }), { headers: { "Content-Type": "application/json" } });

  check(compose, { "compose ok": (r) => r.status === 200 });
  sleep(0.5);
}
import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  vus: 10,
  duration: "2m",
  thresholds: { http_req_duration: ["p(95)<450"] },
};

export default function () {
  const base = `${__ENV.BASE || "http://localhost:3000"}`;
  const retrieve = http.post(`${base}/api/ai/act`, JSON.stringify({
    sessionId: "k6",
    spec: { layout: { sections: ["hero-basic"] } },
    action: { kind: "retrieve", args: { sections: ["hero-basic"], audience: "founders" } }
  }), { headers: { "Content-Type": "application/json" } });

  const sections = (retrieve.json()?.result?.sections) || ["hero-basic","pricing-simple"];

  const compose = http.post(`${base}/api/ai/act`, JSON.stringify({
    sessionId: "k6",
    spec: { layout: { sections } },
    action: { kind: "compose", args: { sections } }
  }), { headers: { "Content-Type": "application/json" } });

  check(compose, { "compose ok": (r) => r.status === 200 });
  sleep(0.5);
}
