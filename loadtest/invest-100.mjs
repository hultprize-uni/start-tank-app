// Prueba de carga local: 100 inversiones simultáneas (misma función SQL que /api/participant/invest,
// mismo driver de Neon vía el proxy local) y, en paralelo, 100 lecturas HTTP de la app.
// Uso local: NEON_LOCAL_PROXY_URL=http://localhost:55434 node loadtest/invest-100.mjs
// Uso en una rama de Neon: node --env-file=.env.loadtest loadtest/invest-100.mjs (APP_URL apunta a la app)
import { neon, neonConfig } from "@neondatabase/serverless";

const APP = process.env.APP_URL ?? "http://localhost:3101";
if (process.env.NEON_LOCAL_PROXY_URL) {
  neonConfig.fetchEndpoint = `${process.env.NEON_LOCAL_PROXY_URL}/sql`;
  neonConfig.useSecureWebSocket = false;
  neonConfig.poolQueryViaFetch = true;
}
// Sin DATABASE_URL usa el stack local de e2e. Nunca apuntar a la base del evento: crea inversiones.
const sql = neon(process.env.DATABASE_URL ?? "postgres://postgres:postgres@db.localtest.me:55433/startank");

const p95 = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length * 0.95) - 1];
const timed = async (fn) => { const t = performance.now(); try { return { ok: true, v: await fn(), ms: performance.now() - t }; } catch (e) { return { ok: false, e: String(e).slice(0, 80), ms: performance.now() - t }; } };

const users = (await sql`select id_usuario from usuario where id_externo like 'load%' order by id_usuario`).map((r) => r.id_usuario);
const [round] = await sql`select id_ronda from ronda where estado = 'ABIERTA'`;
if (!round || users.length < 100) throw new Error("Falta ronda ABIERTA o 100 usuarios de carga");

const before = await sql`select sum(saldo_actual)::numeric as s from usuario where id_externo like 'load%'`;
const t0 = performance.now();
const [invest, reads, spam] = await Promise.all([
  Promise.all(users.slice(0, 100).map((u, i) => timed(() => sql`select fn_registrar_inversion(${u}::bigint, ${round.id_ronda}::bigint, ${250 + i * 25}::numeric) as r`))),
  Promise.all(Array.from({ length: 100 }, (_, i) => timed(async () => { const r = await fetch(`${APP}${i % 2 ? "/api/screen" : "/api/participant/invest"}`, { method: i % 2 ? "GET" : "POST", body: i % 2 ? undefined : "{}" }); return r.status; }))),
  // Doble clic: la misma persona pulsa Invertir 20 veces a la vez; solo una puede pasar.
  Promise.all(Array.from({ length: 20 }, () => timed(() => sql`select fn_registrar_inversion(${users[0]}::bigint, ${round.id_ronda}::bigint, 300::numeric) as r`))),
]);
const wall = performance.now() - t0;

const accepted = invest.filter((x) => x.ok && x.v[0].r.ok).length;
const rejected = invest.filter((x) => x.ok && !x.v[0].r.ok).map((x) => x.v[0].r.error);
const crashes = invest.filter((x) => !x.ok).map((x) => x.e);
const [db] = await sql`select count(*)::int as n, sum(monto)::numeric as total from inversion where id_ronda = ${round.id_ronda}`;
const [sl] = await sql`select monto_acumulado, inversores_unicos, precio_vivo from startup_leaderboard where id_ronda = ${round.id_ronda}`;
const after = await sql`select sum(saldo_actual)::numeric as s from usuario where id_externo like 'load%'`;
const [neg] = await sql`select count(*)::int as n from usuario where saldo_actual < 0`;
const [dup] = await sql`select count(*)::int as n from (select id_usuario from inversion group by id_usuario, id_ronda having count(*) > 1) d`;

console.log(JSON.stringify({
  wallMs: Math.round(wall),
  inversiones: { aceptadas: accepted, rechazadas: rejected.length, motivos: [...new Set(rejected)], errores: crashes, p95ms: Math.round(p95(invest.map((x) => x.ms))), maxMs: Math.round(Math.max(...invest.map((x) => x.ms))) },
  dobleClic: { aceptadas: spam.filter((x) => x.ok && x.v[0].r.ok).length, de: spam.length },
  http: { status: Object.fromEntries([...new Set(reads.map((r) => r.v ?? r.e))].map((s) => [s, reads.filter((r) => (r.v ?? r.e) === s).length])), p95ms: Math.round(p95(reads.map((x) => x.ms))) },
  consistencia: {
    filasInversion: db.n, sumaInversiones: db.total, montoAcumuladoPantalla: sl.monto_acumulado, inversoresUnicos: sl.inversores_unicos, precio: sl.precio_vivo,
    saldoAntes: before[0].s, saldoDespues: after[0].s, cuadra: Number(before[0].s) - Number(after[0].s) === Number(db.total) && Number(db.total) === Number(sl.monto_acumulado),
    saldosNegativos: neg.n, inversionesDuplicadas: dup.n,
  },
}, null, 2));
