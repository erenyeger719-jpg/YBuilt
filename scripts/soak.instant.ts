// scripts/soak.instant.ts
//
// Simple local soak tester for /api/ai/instant.
// Hammers the endpoint for about 60 seconds and prints a summary.

const ENDPOINT = "http://localhost:5050/api/ai/instant";
const DURATION_SECONDS = 60;
const PROMPT = "soak test prompt";

async function main() {
  const endTime = Date.now() + DURATION_SECONDS * 1000;

  let total = 0;
  let ok = 0;
  let s500 = 0;
  let other = 0;

  console.log(
    `[SOAK] Hitting ${ENDPOINT} for ~${DURATION_SECONDS} seconds with prompt="${PROMPT}"`,
  );

  while (Date.now() < endTime) {
    total++;
    try {
      const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt: PROMPT }),
      });

      if (res.status === 500) {
        s500++;
      } else if (res.ok) {
        ok++;
      } else {
        other++;
      }

      if (total % 50 === 0) {
        console.log(
          `[SOAK] so far: total=${total}, ok=${ok}, 500=${s500}, other=${other}`,
        );
      }
    } catch (err) {
      console.error("[SOAK] request error", err);
      other++;
    }
  }

  console.log("=== SOAK DONE ===");
  console.log({ total, ok, s500, other });
  process.exit(0);
}

main().catch((err) => {
  console.error("[SOAK] fatal error", err);
  process.exit(1);
});