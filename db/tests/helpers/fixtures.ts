/**
 * Funciones de apoyo para las pruebas de integración. Cada función recibe el pool de la base de
 * datos aislada de la prueba y encapsula una llamada a las funciones SQL o una consulta de lectura.
 */
import { randomUUID } from "node:crypto";
import type { Pool } from "pg";

export type Decision = "RESPALDA" | "RECHAZA" | "SE_ABSTIENE";

/** Respuesta jsonb de las funciones transaccionales. Solo aparecen las claves que la función devuelve. */
export interface FunctionResult {
  ok: boolean;
  error?: string;
  saldo?: number | null;
  estado?: string;
  multiplicador?: number;
  fraccion_respaldo?: number;
  idempotente?: boolean;
}

export interface PriceRow {
  montoAcumulado: number;
  inversoresUnicos: number;
  precioVivo: number;
  fraccionRespaldo: number | null;
  puntaje: number | null;
}

export interface LeaderboardRow {
  userId: number;
  position: number;
  balance: number;
  roundGain: number;
  hits: number;
}

export interface InvestmentRow {
  userId: number;
  amount: number;
  priceAtPurchase: number;
  returnAmount: number | null;
  state: string;
}

let sequence = 0;

/** Crea un asistente con el saldo indicado (por omisión, el capital inicial de 10,000). */
export async function createUser(
  pool: Pool,
  options: { balance?: number; state?: string } = {},
): Promise<number> {
  sequence += 1;
  const { rows } = await pool.query<{ id: string }>(
    `insert into usuario (proveedor_oauth, id_externo, correo, nombre, saldo_actual, estado)
     values ('test', $1, $2, $3, $4, $5)
     returning id_usuario as id`,
    [
      randomUUID(),
      `asistente-${sequence}@example.test`,
      `Asistente ${sequence}`,
      options.balance ?? 10000,
      options.state ?? "ACTIVO",
    ],
  );
  return Number(rows[0].id);
}

/** Devuelve el identificador de la ronda con el número indicado (1 a 5 en los datos de ejemplo). */
export async function getRoundId(pool: Pool, number: number): Promise<number> {
  const { rows } = await pool.query<{ id: string }>(
    "select id_ronda as id from ronda where numero = $1",
    [number],
  );
  return Number(rows[0].id);
}

/** Devuelve los identificadores de los jurados en orden ascendente. */
export async function getJurorIds(pool: Pool): Promise<number[]> {
  const { rows } = await pool.query<{ id: string }>(
    "select id_jurado as id from jurado order by id_jurado",
  );
  return rows.map((row) => Number(row.id));
}

/**
 * Espera hasta que alguna sesión de la base de datos quede bloqueada por un bloqueo de fila o de
 * transacción. Sirve para confirmar que una operación concurrente espera a otra sin confirmar.
 */
export async function waitForLockWait(pool: Pool, timeoutMs = 10000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const { rows } = await pool.query<{ waiting: number }>(
      `select count(*)::int as waiting
         from pg_stat_activity
        where datname = current_database()
          and wait_event_type = 'Lock'`,
    );
    if (rows[0].waiting > 0) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error("Ninguna sesión quedó en espera de un bloqueo dentro del plazo previsto.");
}

/** Devuelve el identificador del operador de los datos de ejemplo. */
export async function getOperatorId(pool: Pool): Promise<number> {
  const { rows } = await pool.query<{ id: string }>(
    "select id_operador as id from operador order by id_operador limit 1",
  );
  return Number(rows[0].id);
}

export async function getBalance(pool: Pool, userId: number): Promise<number> {
  const { rows } = await pool.query<{ saldo: string }>(
    "select saldo_actual as saldo from usuario where id_usuario = $1",
    [userId],
  );
  return Number(rows[0].saldo);
}

export async function getRoundState(pool: Pool, roundId: number): Promise<string> {
  const { rows } = await pool.query<{ estado: string }>(
    "select estado from ronda where id_ronda = $1",
    [roundId],
  );
  return rows[0].estado;
}

export async function getRoundMultiplier(pool: Pool, roundId: number): Promise<number | null> {
  const { rows } = await pool.query<{ multiplicador: string | null }>(
    "select multiplicador from ronda where id_ronda = $1",
    [roundId],
  );
  return rows[0].multiplicador === null ? null : Number(rows[0].multiplicador);
}

export async function getPriceRow(pool: Pool, roundId: number): Promise<PriceRow> {
  const { rows } = await pool.query<{
    monto_acumulado: string;
    inversores_unicos: number;
    precio_vivo: string;
    fraccion_respaldo: string | null;
    puntaje: string | null;
  }>(
    `select monto_acumulado, inversores_unicos, precio_vivo, fraccion_respaldo, puntaje
       from startup_leaderboard
      where id_ronda = $1`,
    [roundId],
  );
  const row = rows[0];
  return {
    montoAcumulado: Number(row.monto_acumulado),
    inversoresUnicos: row.inversores_unicos,
    precioVivo: Number(row.precio_vivo),
    fraccionRespaldo: row.fraccion_respaldo === null ? null : Number(row.fraccion_respaldo),
    puntaje: row.puntaje === null ? null : Number(row.puntaje),
  };
}

export async function getInvestments(pool: Pool, roundId: number): Promise<InvestmentRow[]> {
  const { rows } = await pool.query<{
    id_usuario: string;
    monto: string;
    precio_momento: string;
    retorno: string | null;
    estado: string;
  }>(
    `select id_usuario, monto, precio_momento, retorno, estado
       from inversion
      where id_ronda = $1
      order by id_inversion`,
    [roundId],
  );
  return rows.map((row) => ({
    userId: Number(row.id_usuario),
    amount: Number(row.monto),
    priceAtPurchase: Number(row.precio_momento),
    returnAmount: row.retorno === null ? null : Number(row.retorno),
    state: row.estado,
  }));
}

export async function getLeaderboard(pool: Pool, roundId: number): Promise<LeaderboardRow[]> {
  const { rows } = await pool.query<{
    id_usuario: string;
    posicion: number;
    saldo: string;
    ganancia_ronda: string;
    aciertos: number;
  }>(
    `select id_usuario, posicion, saldo, ganancia_ronda, aciertos
       from leaderboard
      where id_ronda = $1
      order by posicion`,
    [roundId],
  );
  return rows.map((row) => ({
    userId: Number(row.id_usuario),
    position: row.posicion,
    balance: Number(row.saldo),
    roundGain: Number(row.ganancia_ronda),
    hits: row.aciertos,
  }));
}

/** Registra una inversión mediante fn_registrar_inversion. */
export async function invest(
  pool: Pool,
  userId: number,
  roundId: number,
  amount: number,
): Promise<FunctionResult> {
  const { rows } = await pool.query<{ resultado: FunctionResult }>(
    "select fn_registrar_inversion($1, $2, $3) as resultado",
    [userId, roundId, amount],
  );
  return rows[0].resultado;
}

/** Ejecuta una acción del operador mediante fn_accion_operador. */
export async function operatorAction(
  pool: Pool,
  operatorId: number,
  roundId: number,
  action: string,
): Promise<FunctionResult> {
  const { rows } = await pool.query<{ resultado: FunctionResult }>(
    "select fn_accion_operador($1, $2, $3) as resultado",
    [operatorId, roundId, action],
  );
  return rows[0].resultado;
}

/** Registra el voto de un jurado mediante fn_registrar_voto. */
export async function castVote(
  pool: Pool,
  jurorId: number,
  roundId: number,
  decision: string,
): Promise<FunctionResult> {
  const { rows } = await pool.query<{ resultado: FunctionResult }>(
    "select fn_registrar_voto($1, $2, $3) as resultado",
    [jurorId, roundId, decision],
  );
  return rows[0].resultado;
}

/** Revela el veredicto mediante fn_revelar_veredicto. */
export async function reveal(
  pool: Pool,
  operatorId: number,
  roundId: number,
): Promise<FunctionResult> {
  const { rows } = await pool.query<{ resultado: FunctionResult }>(
    "select fn_revelar_veredicto($1, $2) as resultado",
    [operatorId, roundId],
  );
  return rows[0].resultado;
}

/** Abre una ronda y comprueba que la acción tuvo éxito. */
export async function openRound(pool: Pool, operatorId: number, roundId: number): Promise<void> {
  const result = await operatorAction(pool, operatorId, roundId, "ABRIR");
  if (!result.ok) {
    throw new Error(`No fue posible abrir la ronda ${roundId}: ${result.error}`);
  }
}

/** Abre la ronda con el número indicado y devuelve sus identificadores. */
export async function openRoundNumber(
  pool: Pool,
  number: number,
): Promise<{ operatorId: number; roundId: number }> {
  const operatorId = await getOperatorId(pool);
  const roundId = await getRoundId(pool, number);
  await openRound(pool, operatorId, roundId);
  return { operatorId, roundId };
}

/** Cierra una ronda abierta y habilita la votación. */
export async function closeForVoting(
  pool: Pool,
  operatorId: number,
  roundId: number,
): Promise<void> {
  for (const action of ["CERRAR", "HABILITAR_VOTO"]) {
    const result = await operatorAction(pool, operatorId, roundId, action);
    if (!result.ok) {
      throw new Error(`Acción ${action} rechazada en la ronda ${roundId}: ${result.error}`);
    }
  }
}

/**
 * Registra un voto por cada jurado, en orden de identificador, y revela el veredicto. Devuelve el
 * resultado de la revelación.
 */
export async function settleRound(
  pool: Pool,
  operatorId: number,
  roundId: number,
  decisions: Decision[],
): Promise<FunctionResult> {
  const jurors = await getJurorIds(pool);
  if (decisions.length !== jurors.length) {
    throw new Error("La cantidad de decisiones debe coincidir con la cantidad de jurados.");
  }
  for (let index = 0; index < jurors.length; index += 1) {
    const vote = await castVote(pool, jurors[index], roundId, decisions[index]);
    if (!vote.ok) {
      throw new Error(`Voto rechazado en la ronda ${roundId}: ${vote.error}`);
    }
  }
  return reveal(pool, operatorId, roundId);
}

/**
 * Ejecuta un ciclo completo de ronda con inversiones previas: abre la ronda, cierra el mercado,
 * habilita la votación, registra los votos y revela el veredicto.
 */
export async function runFullRound(
  pool: Pool,
  operatorId: number,
  roundId: number,
  decisions: Decision[],
): Promise<FunctionResult> {
  await openRound(pool, operatorId, roundId);
  await closeForVoting(pool, operatorId, roundId);
  return settleRound(pool, operatorId, roundId, decisions);
}
