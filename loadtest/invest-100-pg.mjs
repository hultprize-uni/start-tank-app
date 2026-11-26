// Igual que invest-100.mjs pero directo a Postgres (sin el proxy HTTP local, que no soporta tanta
// concurrencia): 100 conexiones invierten a la vez + 20 dobles clics de una misma persona.
import pg from "pg";
const pool = new pg.Pool({ connectionString: "postgres://postgres:postgres@localhost:55433/startank", max: 60 });
const q = (t, p) => pool.query(t, p).then((r) => r.rows);
const users = (await q("select id_usuario from usuario where id_externo like 'load%' order by id_usuario")).map((r) => r.id_usuario);
const [round] = await q("select id_ronda from ronda where estado = 'ABIERTA'");
const timed = async (fn) => { const t = performance.now(); try { return { ok: true, v: await fn(), ms: performance.now() - t }; } catch (e) { return { ok: false, e: String(e).slice(0, 80), ms: performance.now() - t }; } };
const spammer = users[99];
const t0 = performance.now();
const [inv, spam] = await Promise.all([
  Promise.all(users.slice(0, 99).map((u, i) => timed(() => q("select fn_registrar_inversion($1, $2, $3) as r", [u, round.id_ronda, 250 + i * 25])))),
  Promise.all(Array.from({ length: 20 }, () => timed(() => q("select fn_registrar_inversion($1, $2, 300) as r", [spammer, round.id_ronda])))),
]);
const wall = performance.now() - t0;
const ms = inv.map((x) => x.ms).sort((a, b) => a - b);
const [c] = await q(`select (select count(*) from inversion where id_ronda=$1)::int n, (select sum(monto) from inversion where id_ronda=$1) total,
  (select monto_acumulado from startup_leaderboard where id_ronda=$1) acc, (select inversores_unicos from startup_leaderboard where id_ronda=$1) uniq,
  (select precio_vivo from startup_leaderboard where id_ronda=$1) precio, (select 100*10000 - sum(saldo_actual) from usuario where id_externo like 'load%') descontado,
  (select count(*) from usuario where saldo_actual < 0)::int negativos`, [round.id_ronda]);
console.log(JSON.stringify({ wallMs: Math.round(wall), aceptadas: inv.filter((x) => x.ok && x.v[0].r.ok).length, de: 99,
  errores: inv.filter((x) => !x.ok).length, tipos: [...new Set(inv.filter((x) => !x.ok).map((x) => x.e))], p50ms: Math.round(ms[49]), p95ms: Math.round(ms[93]), maxMs: Math.round(ms[98]),
  dobleClic: { aceptadas: spam.filter((x) => x.ok && x.v[0].r.ok).length, de: 20, motivos: [...new Set(spam.map((x) => x.v?.[0].r.error ?? "ok"))] },
  consistencia: { ...c, cuadra: Number(c.total) === Number(c.acc) && Number(c.total) === Number(c.descontado) } }, null, 2));
await pool.end();
