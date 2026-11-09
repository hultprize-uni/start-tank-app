import { EVENT_CONFIG } from "@/lib/domain/config";
import { pickWinner, startupScore, type StartupStanding } from "@/lib/domain/scoring";
import { calcVerdict } from "@/lib/domain/verdict";
import type { Decision, RoundState } from "@/lib/domain/types";
import type { JuryCriterion, JuryScreen, JuryViewModel } from "@/lib/api/jury.types";
import type {
  BalanceRow,
  CancelMode,
  JurorSense,
  JurorVoteView,
  LogEntryView,
  OperatorActionId,
  OperatorActionView,
  OperatorViewModel,
  PositionRow,
  RoundStatus,
} from "@/lib/api/operator.types";
import type {
  EntreRondas,
  FilaInversionista,
  FilaStartup,
  Cierre,
  Liquidacion,
  OdsRef,
  RondaRef,
  ScreenViewModel,
  VotoRevelado,
} from "@/lib/api/screen.types";

/*
 * Constructores puros de los view models de pantalla, jurado y operador. Reciben las filas que
 * devuelven las consultas de queries.ts y no acceden a la base de datos, de modo que el mapeo
 * se prueba sin conexión.
 */

/** Filas crudas. Los valores numeric y bigint de Postgres llegan como cadenas y se convierten aquí. */

/** Ronda con los datos de su startup y de su fila de startup_leaderboard. */
export interface FilaRonda {
  id_ronda: string;
  numero: number;
  estado: RoundState;
  multiplicador: string | null;
  /** Segundos transcurridos desde el inicio de la última llamada. Nulo fuera de esa fase. */
  segundos_ultima_llamada: number | null;
  startup_nombre: string;
  ods: string | null;
  monto_acumulado: string | null;
  inversores_unicos: number | null;
  precio_vivo: string | null;
  fraccion_respaldo: string | null;
  puntaje: string | null;
  monto_invertido: string;
  retorno_ronda: string;
}

/** Voto de un jurado en una ronda. Decision es nula cuando el jurado aún no ha votado. */
export interface VotoRonda {
  id_jurado: string;
  nombre: string;
  decision: Decision | null;
}

/** Fila del leaderboard de asistentes de una ronda. */
export interface FilaRanking {
  id_usuario: string;
  nombre: string;
  posicion: number;
  saldo: string;
  aciertos: number;
}

/** Saldo actual de un asistente. */
export interface FilaSaldo {
  id_usuario: string;
  nombre: string;
  saldo_actual: string;
}

/** Posición de un asistente en una ronda: suma de sus inversiones y su retorno, si ya está liquidado. */
export interface FilaPosicion {
  id_usuario: string;
  nombre: string;
  numero: number;
  startup_nombre: string;
  monto: string;
  retorno: string | null;
}

/** Acción registrada por un operador sobre una ronda. */
export interface FilaAccion {
  id_accion: string;
  accion: string;
  ejecutada_en: Date;
  operador: string;
  numero: number;
  startup_nombre: string;
}

export interface DatosPantalla {
  rondas: readonly FilaRonda[];
  /** Votos de la ronda de referencia de la pantalla (activa, o la última terminada). */
  votos: readonly VotoRonda[];
  /** Leaderboard de la última ronda terminada. */
  ranking: readonly FilaRanking[];
  usuariosActivos: number;
}

export interface DatosJurado {
  juradoId: string;
  nombre: string;
  rondas: readonly FilaRonda[];
  /** Votos de la ronda activa. Vacío cuando no hay ronda activa. */
  votos: readonly VotoRonda[];
  totalJurados: number;
}

export interface DatosOperador {
  rondas: readonly FilaRonda[];
  /** Votos de la ronda que controla el operador. */
  votos: readonly VotoRonda[];
  /** Acción de anulación registrada para la ronda que controla el operador, si existe. */
  accionAnulacion: string | null;
  usuariosActivos: number;
  saldos: readonly FilaSaldo[];
  posiciones: readonly FilaPosicion[];
  acciones: readonly FilaAccion[];
  /** Fecha de referencia para el registro de acciones y la cuenta regresiva. */
  ahora: Date;
}

/** Nombres oficiales de los Objetivos de Desarrollo Sostenible, indexados por número. */
const NOMBRES_ODS: Readonly<Record<number, string>> = {
  1: "Fin de la pobreza",
  2: "Hambre cero",
  3: "Salud y bienestar",
  4: "Educación de calidad",
  5: "Igualdad de género",
  6: "Agua limpia y saneamiento",
  7: "Energía asequible y no contaminante",
  8: "Trabajo decente y crecimiento económico",
  9: "Industria, innovación e infraestructura",
  10: "Reducción de las desigualdades",
  11: "Ciudades y comunidades sostenibles",
  12: "Producción y consumo responsables",
  13: "Acción por el clima",
  14: "Vida submarina",
  15: "Vida de ecosistemas terrestres",
  16: "Paz, justicia e instituciones sólidas",
  17: "Alianzas para lograr los objetivos",
};

/** Criterios de evaluación que el portal del jurado recuerda en cada ronda. */
export const CRITERIOS_JURADO: readonly JuryCriterion[] = [
  { id: "viabilidad", label: "Viabilidad" },
  { id: "impacto_ods", label: "Impacto ODS" },
];

/** Estados en los que una ronda ocupa el turno de la sala. Solo puede existir una a la vez. */
const ESTADOS_ACTIVOS: ReadonlySet<RoundState> = new Set<RoundState>([
  "ABIERTA",
  "ULTIMA_LLAMADA",
  "CERRADA",
  "EN_VOTACION",
]);

/** Zona horaria del evento para el registro de acciones del operador. */
const ZONA_EVENTO = "America/Lima";

const FORMATO_HORA = new Intl.DateTimeFormat("es-PE", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: ZONA_EVENTO,
});

/** Etiquetas visibles de las acciones registradas en accion_ronda. */
const ETIQUETAS_ACCION: Readonly<Record<string, string>> = {
  ABRIR: "Abrir mercado",
  ULTIMA_LLAMADA: "Declarar última llamada",
  CERRAR: "Cerrar mercado",
  HABILITAR_VOTO: "Habilitar votación",
  REVELAR: "Revelar veredicto",
  ANULAR_DEVOLVER: "Anular y devolver",
  ANULAR_LIQUIDAR_1X: "Anular y liquidar a 1.0x",
};

/** Convierte un valor numérico de la base de datos. Los nulos equivalen a cero. */
export function aNumero(valor: string | number | null | undefined): number {
  if (valor === null || valor === undefined) return 0;
  return Number(valor);
}

/** Obtiene el número y el nombre del ODS a partir de su texto de base de datos, por ejemplo "ODS 6". */
export function parsearOds(texto: string | null): OdsRef {
  const coincidencia = texto?.match(/\d+/);
  const numero = coincidencia ? Number(coincidencia[0]) : 0;
  return { numero, nombre: NOMBRES_ODS[numero] ?? "" };
}

/** Ordena las rondas por número ascendente sin modificar la lista original. */
function ordenarRondas(rondas: readonly FilaRonda[]): FilaRonda[] {
  return [...rondas].sort((a, b) => a.numero - b.numero);
}

export interface ClasificacionRondas {
  /** Ronda en curso: ABIERTA, ULTIMA_LLAMADA, CERRADA o EN_VOTACION. */
  activa: FilaRonda | undefined;
  /** Primera ronda aún no abierta. */
  pendiente: FilaRonda | undefined;
  /** Última ronda liquidada o anulada. */
  ultimaTerminada: FilaRonda | undefined;
}

/** Clasifica las rondas según su estado para determinar la ronda en curso y las de referencia. */
export function clasificarRondas(rondas: readonly FilaRonda[]): ClasificacionRondas {
  const ordenadas = ordenarRondas(rondas);
  const terminadas = ordenadas.filter((r) => r.estado === "LIQUIDADA" || r.estado === "ANULADA");
  return {
    activa: ordenadas.find((r) => ESTADOS_ACTIVOS.has(r.estado)),
    pendiente: ordenadas.find((r) => r.estado === "PROGRAMADA"),
    ultimaTerminada: terminadas[terminadas.length - 1],
  };
}

/** Ronda que la pantalla proyecta: la activa, o la última terminada, o la siguiente programada. */
export function rondaReferenciaPantalla(rondas: readonly FilaRonda[]): FilaRonda | undefined {
  const c = clasificarRondas(rondas);
  return c.activa ?? c.ultimaTerminada ?? c.pendiente ?? ordenarRondas(rondas)[0];
}

/** Ronda que controla el operador: la activa, o la siguiente programada, o la última terminada. */
export function rondaReferenciaOperador(rondas: readonly FilaRonda[]): FilaRonda | undefined {
  const c = clasificarRondas(rondas);
  return c.activa ?? c.pendiente ?? c.ultimaTerminada ?? ordenarRondas(rondas)[0];
}

function rondaRef(fila: FilaRonda): RondaRef {
  return {
    numero: fila.numero,
    startup: { nombre: fila.startup_nombre, ods: parsearOds(fila.ods) },
  };
}

function precioDe(fila: FilaRonda): number {
  return fila.precio_vivo === null ? EVENT_CONFIG.priceBase : aNumero(fila.precio_vivo);
}

function acumuladoDe(fila: FilaRonda): number {
  return aNumero(fila.monto_acumulado);
}

function segundosRestantes(fila: FilaRonda): number {
  if (fila.segundos_ultima_llamada === null) return EVENT_CONFIG.lastCallSeconds;
  const transcurridos = Math.floor(aNumero(fila.segundos_ultima_llamada));
  return Math.max(0, EVENT_CONFIG.lastCallSeconds - transcurridos);
}

/** Fila de inversionista a partir del leaderboard de la última ronda terminada. */
function filaInversionista(fila: FilaRanking): FilaInversionista {
  return { posicion: fila.posicion, nombre: fila.nombre, saldo: aNumero(fila.saldo) };
}

/** Lista de startups ordenada por monto acumulado, con su precio vivo. */
function filasStartup(rondas: readonly FilaRonda[]): FilaStartup[] {
  return ordenarRondas(rondas)
    .map((r) => ({ fila: r, acumulado: acumuladoDe(r) }))
    .sort((a, b) => b.acumulado - a.acumulado || a.fila.numero - b.fila.numero)
    .map((item, indice) => ({
      posicion: indice + 1,
      nombre: item.fila.startup_nombre,
      acumulado: item.acumulado,
      precio: precioDe(item.fila),
    }));
}

function votosRevelados(votos: readonly VotoRonda[]): VotoRevelado[] {
  return votos
    .filter((v): v is VotoRonda & { decision: Decision } => v.decision !== null)
    .map((v) => ({ jurado: v.nombre, decision: v.decision }));
}

function construirLiquidacion(
  ultima: FilaRonda,
  votos: readonly VotoRonda[],
  actualizadoEn: string,
): Liquidacion {
  const revelados = votosRevelados(votos);
  const fraccionRespaldo =
    ultima.fraccion_respaldo === null
      ? calcVerdict(revelados.map((v) => v.decision)).fraction
      : aNumero(ultima.fraccion_respaldo);

  return {
    fase: "LIQUIDACION",
    actualizadoEn,
    ronda: rondaRef(ultima),
    votos: revelados,
    fraccionRespaldo,
    multiplicador: aNumero(ultima.multiplicador ?? 1),
    montoInvertido: aNumero(ultima.monto_invertido),
    retornoRonda: aNumero(ultima.retorno_ronda),
  };
}

function construirEntreRondas(
  datos: DatosPantalla,
  rondaCerrada: FilaRonda,
  actualizadoEn: string,
): EntreRondas {
  return {
    fase: "ENTRE_RONDAS",
    actualizadoEn,
    rondaCerrada: rondaRef(rondaCerrada),
    inversionistas: datos.ranking.map(filaInversionista),
    startups: filasStartup(datos.rondas),
  };
}

/**
 * Construye el cierre con la startup ganadora, el top 3 y el asistente con mejor ojo.
 * Devuelve nulo cuando ninguna startup tiene puntaje calculado.
 */
function construirCierre(datos: DatosPantalla, actualizadoEn: string): Cierre | null {
  const candidatas = datos.rondas
    .filter((r) => r.fraccion_respaldo !== null && r.puntaje !== null)
    .map((fila) => {
      const standing: StartupStanding & { fila: FilaRonda } = {
        id: fila.id_ronda,
        fraction: aNumero(fila.fraccion_respaldo),
        investorPct:
          datos.usuariosActivos > 0 ? (fila.inversores_unicos ?? 0) / datos.usuariosActivos : 0,
        fila,
      };
      return standing;
    });

  const ganador = pickWinner(candidatas);
  if (ganador === undefined) return null;

  const mejor = [...datos.ranking].sort(
    (a, b) => b.aciertos - a.aciertos || a.posicion - b.posicion,
  )[0];

  return {
    fase: "CIERRE",
    actualizadoEn,
    ganadora: {
      nombre: ganador.fila.startup_nombre,
      ods: parsearOds(ganador.fila.ods),
      puntaje: startupScore(ganador.fraction, ganador.investorPct),
      fraccionRespaldo: ganador.fraction,
      porcentajeInversores: ganador.investorPct,
    },
    top3: datos.ranking.slice(0, 3).map(filaInversionista),
    mejorOjo: mejor
      ? { nombre: mejor.nombre, aciertos: mejor.aciertos }
      : { nombre: "", aciertos: 0 },
  };
}

/**
 * Construye el view model de la pantalla pública. Devuelve nulo cuando no existen rondas.
 * La fase se deduce del estado de la ronda activa o de la última ronda terminada.
 */
export function construirPantalla(datos: DatosPantalla, ahora: Date): ScreenViewModel | null {
  if (datos.rondas.length === 0) return null;

  const actualizadoEn = ahora.toISOString();
  const c = clasificarRondas(datos.rondas);
  const activa = c.activa;

  if (activa !== undefined) {
    const ronda = rondaRef(activa);
    if (activa.estado === "ABIERTA") {
      return {
        fase: "MERCADO",
        actualizadoEn,
        ronda,
        precio: precioDe(activa),
        acumulado: acumuladoDe(activa),
        inversoresUnicos: activa.inversores_unicos ?? 0,
      };
    }
    if (activa.estado === "ULTIMA_LLAMADA") {
      return {
        fase: "ULTIMA_LLAMADA",
        actualizadoEn,
        ronda,
        precio: precioDe(activa),
        acumulado: acumuladoDe(activa),
        inversoresUnicos: activa.inversores_unicos ?? 0,
        segundosRestantes: segundosRestantes(activa),
      };
    }
    return {
      fase: "VOTACION",
      actualizadoEn,
      ronda,
      votosEmitidos: datos.votos.filter((v) => v.decision !== null).length,
      juradosTotal: datos.votos.length,
    };
  }

  const ultima = c.ultimaTerminada;
  if (ultima !== undefined) {
    if (c.pendiente === undefined) {
      const cierre = construirCierre(datos, actualizadoEn);
      if (cierre !== null) return cierre;
    }
    if (ultima.estado === "LIQUIDADA") {
      return construirLiquidacion(ultima, datos.votos, actualizadoEn);
    }
  }

  const rondaCerrada = ultima ?? c.pendiente ?? ordenarRondas(datos.rondas)[0];
  return construirEntreRondas(datos, rondaCerrada, actualizadoEn);
}

/**
 * Construye el view model del portal del jurado. La pantalla "votacion" se muestra solo cuando la
 * ronda está en EN_VOTACION y el jurado aún no ha votado en ella.
 */
export function construirVistaJurado(datos: DatosJurado): JuryViewModel {
  const activa = clasificarRondas(datos.rondas).activa;
  const emitidos = datos.votos.filter((v) => v.decision !== null).length;
  const propio = datos.votos.find((v) => v.id_jurado === datos.juradoId);
  const votoRegistrado = propio !== undefined && propio.decision !== null;

  let pantalla: JuryScreen = "espera";
  if (activa?.estado === "EN_VOTACION") {
    pantalla = votoRegistrado ? "voto_registrado" : "votacion";
  }

  return {
    screen: pantalla,
    access: { status: "inactivo", errorMessage: null },
    jurorLabel: datos.nombre,
    round: activa ? { number: activa.numero, startupName: activa.startup_nombre } : null,
    criteria: CRITERIOS_JURADO,
    vote: { draft: null, confirming: false, submitting: false, errorMessage: null },
    votes: { emitted: emitidos, total: datos.totalJurados },
  };
}

/** Acciones que el operador puede disparar en cada estado de la ronda que controla. */
function construirAcciones(
  estado: RoundStatus,
  votosEmitidos: number,
  totalVotos: number,
  hayUltimaTerminada: boolean,
): OperatorActionView[] {
  const pendientes = Math.max(0, totalVotos - votosEmitidos);
  const revelarHabilitado = estado === "EN_VOTACION" && pendientes === 0 && totalVotos > 0;

  const revelarMotivo = revelarHabilitado
    ? null
    : estado === "EN_VOTACION"
      ? `Faltan ${pendientes} voto(s)`
      : "Requiere votación habilitada.";

  const fila = (
    id: OperatorActionId,
    label: string,
    done: boolean,
    enabled: boolean,
    blockedReason: string | null,
  ): OperatorActionView => ({ id, label, done, enabled, blockedReason });

  return [
    fila("abrir", "Abrir mercado", estado !== "PROGRAMADA", estado === "PROGRAMADA", null),
    fila(
      "ultima_llamada",
      "Última llamada",
      ["ULTIMA_LLAMADA", "CERRADA", "EN_VOTACION", "LIQUIDADA"].includes(estado),
      estado === "ABIERTA",
      estado === "ABIERTA" ? null : "Requiere la ronda abierta.",
    ),
    fila(
      "cerrar",
      "Cerrar mercado",
      ["CERRADA", "EN_VOTACION", "LIQUIDADA"].includes(estado),
      estado === "ABIERTA" || estado === "ULTIMA_LLAMADA",
      estado === "ABIERTA" || estado === "ULTIMA_LLAMADA" ? null : "Requiere el mercado abierto.",
    ),
    fila("revelar", "Revelar veredicto", estado === "LIQUIDADA", revelarHabilitado, revelarMotivo),
    // La acción siguiente no tiene operación propia en la base de datos: avanzar de ronda
    // ocurre al abrir la siguiente ronda. Se muestra deshabilitada para conservar el contrato.
    fila(
      "siguiente",
      "Siguiente startup",
      false,
      false,
      hayUltimaTerminada ? "Avanza al abrir la siguiente ronda." : null,
    ),
  ];
}

function sentidoDe(decision: Decision | null, estado: RoundStatus): JurorSense | null {
  if (estado !== "LIQUIDADA" || decision === null) return null;
  const sentidos: Readonly<Record<Decision, JurorSense>> = {
    RESPALDA: "respalda",
    RECHAZA: "rechaza",
    SE_ABSTIENE: "abstiene",
  };
  return sentidos[decision];
}

function horaDe(fecha: Date): string {
  return FORMATO_HORA.format(fecha);
}

/** Modo de anulación derivado de la acción registrada para la ronda. */
function modoAnulacion(accion: string | null): CancelMode | null {
  if (accion === "ANULAR_DEVOLVER") return "devolver";
  if (accion === "ANULAR_LIQUIDAR_1X") return "liquidar_1x";
  return null;
}

/**
 * Construye el view model de la consola del operador. Devuelve nulo cuando no existen rondas.
 * El sentido de los votos se revela solo cuando la ronda está LIQUIDADA.
 */
export function construirVistaOperador(datos: DatosOperador): OperatorViewModel | null {
  const actual = rondaReferenciaOperador(datos.rondas);
  if (actual === undefined) return null;

  const estado = actual.estado as RoundStatus;
  const c = clasificarRondas(datos.rondas);
  const emitidos = datos.votos.filter((v) => v.decision !== null).length;
  const totalVotos = datos.votos.length;

  const jurados: JurorVoteView[] = datos.votos.map((voto) => ({
    id: `jurado-${voto.id_jurado}`,
    label: voto.nombre,
    emitted: voto.decision !== null,
    sense: sentidoDe(voto.decision, estado),
  }));

  const log: LogEntryView[] = datos.acciones.map((accion) => ({
    id: accion.id_accion,
    time: horaDe(accion.ejecutada_en),
    label: ETIQUETAS_ACCION[accion.accion] ?? accion.accion,
    operator: accion.operador,
    detail: `Ronda ${accion.numero}: ${accion.startup_nombre}`,
  }));

  return {
    round: {
      number: actual.numero,
      total: datos.rondas.length,
      startupName: actual.startup_nombre,
      status: estado,
      multiplier: actual.multiplicador === null ? null : aNumero(actual.multiplicador),
      result: null,
      cancelMode: modoAnulacion(datos.accionAnulacion),
    },
    screenSynced: true,
    actions: construirAcciones(estado, emitidos, totalVotos, c.ultimaTerminada !== undefined),
    jurors: jurados,
    market: {
      accumulated: acumuladoDe(actual),
      uniqueInvestors: actual.inversores_unicos ?? 0,
      // La base de datos no registra sesiones activas; se usa el número de asistentes activos.
      connectedAttendees: datos.usuariosActivos,
      price: precioDe(actual),
    },
    log,
    canUndo: false,
    canCancel: ["ABIERTA", "ULTIMA_LLAMADA", "CERRADA", "EN_VOTACION"].includes(estado),
    canManualSettle: false,
    balances: datos.saldos.map(
      (fila): BalanceRow => ({
        attendeeId: fila.id_usuario,
        attendeeName: fila.nombre,
        balance: aNumero(fila.saldo_actual),
      }),
    ),
    positions: datos.posiciones.map(
      (fila): PositionRow => ({
        attendeeId: fila.id_usuario,
        attendeeName: fila.nombre,
        round: fila.numero,
        startupName: fila.startup_nombre,
        amount: aNumero(fila.monto),
        returnAmount: fila.retorno === null ? null : aNumero(fila.retorno),
      }),
    ),
  };
}
