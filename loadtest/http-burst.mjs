// Ráfagas HTTP contra la app: N peticiones simultáneas a una ruta, 3 rondas. Uso: node loadtest/http-burst.mjs api/screen 100
const APP = process.env.APP_URL ?? "http://localhost:3102";
const [raw = "api/screen", n = "100"] = process.argv.slice(2);
const path = "/" + raw.slice(raw.indexOf("api/")); // Git Bash convierte "/api/..." en ruta de Windows
for (let round = 1; round <= 3; round++) {
  const ms = await Promise.all(Array.from({ length: Number(n) }, async () => {
    const t = performance.now(); const r = await fetch(APP + path).catch(() => ({ status: "ERR" })); return [performance.now() - t, r.status];
  }));
  const t = ms.map((x) => x[0]).sort((a, b) => a - b);
  const codes = {}; for (const [, s] of ms) codes[s] = (codes[s] ?? 0) + 1;
  console.log(`${path} x${n} ronda ${round}: p50 ${Math.round(t[Math.floor(t.length / 2)])} ms, p95 ${Math.round(t[Math.floor(t.length * 0.95) - 1])} ms, max ${Math.round(t.at(-1))} ms`, codes);
}
