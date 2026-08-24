import { performance } from "node:perf_hooks";

const base = (process.argv[2] || "http://localhost:3104").replace(/\/$/, "");
const count = Number(process.argv[3] || 15);
if (!Number.isInteger(count) || count < 1 || count > 30) {
  throw new Error("request count must be between 1 and 30");
}

const paths = [
  "/from-ask?src=ask&entity=contractor&category=roofing&state=FL&county=miami-dade&city=miami",
  "/from-ask?src=ask&entity=contractor&category=hvac&state=FL&county=hillsborough&city=tampa",
  "/from-ask?src=ask&entity=contractor&category=general_contractor&state=FL&county=orange&city=orlando",
];

const outcomes = await Promise.all(
  Array.from({ length: count }, async (_, index) => {
    const started = performance.now();
    try {
      const response = await fetch(`${base}${paths[index % paths.length]}`, {
        redirect: "follow",
        signal: AbortSignal.timeout(180_000),
      });
      const html = await response.text();
      const firmMatch = html.match(
        /Firms in this view[\s\S]{0,300}?\\?"children\\?":\\?"([0-9][0-9,]*)/i
      );
      const firms = firmMatch ? Number(firmMatch[1].replaceAll(",", "")) : 0;
      return {
        ok:
          response.ok &&
          firms > 0 &&
          !html.includes('data-discovery-state="temporarily-unavailable"'),
        http: response.status,
        firms,
        unavailable: html.includes('data-discovery-state=\\"temporarily-unavailable\\"') || html.includes('data-discovery-state="temporarily-unavailable"'),
        ms: performance.now() - started,
      };
    } catch {
      return { ok: false, http: 0, firms: 0, unavailable: false, ms: performance.now() - started };
    }
  })
);

const durations = outcomes.map((x) => x.ms).sort((a, b) => a - b);
const percentile = (p) => Math.round(durations[Math.ceil(p * durations.length) - 1] || 0);
const httpSuccess = outcomes.filter((x) => x.http >= 200 && x.http < 400).length;
const realData = outcomes.filter((x) => x.ok).length;
const silentZeros = outcomes.filter((x) => x.http === 200 && x.firms === 0).length;
const unavailable = outcomes.filter((x) => x.unavailable).length;
console.log(
  `requests=${count} http_success=${httpSuccess} real_data=${realData} silent_zeros=${silentZeros} unavailable=${unavailable} p50_ms=${percentile(0.5)} p95_ms=${percentile(0.95)} firms=${outcomes.map((x) => x.firms).join(",")}`
);
if (realData !== count) process.exitCode = 1;
