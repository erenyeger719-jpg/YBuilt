import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  vus: 25,
  duration: "1m",
  thresholds: { http_req_duration: ["p(95)<120"] },
};

export default function () {
  const url = `${__ENV.BASE || "http://localhost:3000"}/api/ai/instant`;
  const res = http.post(url, JSON.stringify({ prompt: "minimal light portfolio", sessionId: "k6" }), {
    headers: { "Content-Type": "application/json" },
  });
  check(res, { "status is 200": (r) => r.status === 200 });
  sleep(0.5);
}
