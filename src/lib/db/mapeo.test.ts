import { describe, expect, it } from "vitest";
import {
  construirPantalla,
  construirVistaJurado,
  construirVistaOperador,
  parsearOds,
  rondaReferenciaOperador,
  type DatosJurado,
  type DatosOperador,
  type DatosPantalla,
  type FilaRonda,
  type VotoRonda,
} from "./mapeo";

const AHORA = new Date("2026-11-08T15:00:00.000Z");

/** Fila de ronda con valores por defecto que cada prueba sobrescribe. */
function ronda(parcial: Partial<FilaRonda> & Pick<FilaRonda, "numero" | "estado">): FilaRonda {
  return {
    id_ronda: String(parcial.numero),
    multiplicador: null,
    segundos_ultima_llamada: null,
    startup_nombre: `Startup ${parcial.numero}`,
    ods: "ODS 6",
    monto_acumulado: "0",
    inversores_unicos: 0,
    precio_vivo: "100",
    fraccion_respaldo: null,
    puntaje: null,
    monto_invertido: "0",
    retorno_ronda: "0",
    ...parcial,
  };
}

function voto(id: string, nombre: string, decision: VotoRonda["decision"]): VotoRonda {
  return { id_jurado: id, nombre, decision };
}

const VOTOS_COMPLETOS: VotoRonda[] = [
  voto("1", "Jurado 1", "RESPALDA"),
  voto("2", "Jurado 2", "RESPALDA"),
  voto("3", "Jurado 3", "RECHAZA"),
  voto("4", "Jurado 4", "SE_ABSTIENE"),
];

function pantalla(
  rondas: FilaRonda[],
  extra: Partial<DatosPantalla> = {},
): DatosPantalla {
  return { rondas, votos: [], ranking: [], usuariosActivos: 0, ...extra };
}

describe("parsearOds", () => {
  it("extrae el número y el nombre oficial del ODS", () => {
    expect(parsearOds("ODS 6")).toEqual({
      numero: 6,
      nombre: "Agua limpia y saneamiento",
    });
  });

  it("devuelve número cero y nombre vacío cuando el texto no contiene un ODS", () => {
    expect(parsearOds(null)).toEqual({ numero: 0, nombre: "" });
  });
});

describe("construirPantalla", () => {
  it("devuelve nulo cuando el evento no tiene rondas", () => {
    expect(construirPantalla(pantalla([]), AHORA)).toBeNull();
  });

  it("muestra el mercado con precio, acumulado e inversores de la ronda abierta", () => {
    const abierta = ronda({
      numero: 1,
      estado: "ABIERTA",
      precio_vivo: "148.50",
      monto_acumulado: "9500",
      inversores_unicos: 31,
    });
    const vm = construirPantalla(pantalla([abierta]), AHORA);

    expect(vm).toMatchObject({
      fase: "MERCADO",
      actualizadoEn: AHORA.toISOString(),
      precio: 148.5,
      acumulado: 9500,
      inversoresUnicos: 31,
      ronda: { numero: 1, startup: { nombre: "Startup 1", ods: { numero: 6 } } },
    });
  });

  it("calcula la cuenta regresiva de la última llamada sin bajar de cero", () => {
    const enCurso = ronda({ numero: 2, estado: "ULTIMA_LLAMADA", segundos_ultima_llamada: 15 });
    const vencida = ronda({ numero: 2, estado: "ULTIMA_LLAMADA", segundos_ultima_llamada: 90 });

    expect(construirPantalla(pantalla([enCurso]), AHORA)).toMatchObject({
      fase: "ULTIMA_LLAMADA",
      segundosRestantes: 45,
    });
    expect(construirPantalla(pantalla([vencida]), AHORA)).toMatchObject({
      segundosRestantes: 0,
    });
  });

  it("no revela el sentido de los votos durante la votación", () => {
    const votacion = ronda({ numero: 2, estado: "EN_VOTACION" });
    const votos = [
      voto("1", "Jurado 1", "RESPALDA"),
      voto("2", "Jurado 2", null),
      voto("3", "Jurado 3", null),
      voto("4", "Jurado 4", null),
    ];
    const vm = construirPantalla(pantalla([votacion], { votos }), AHORA);

    expect(vm).toMatchObject({ fase: "VOTACION", votosEmitidos: 1, juradosTotal: 4 });
    expect(JSON.stringify(vm)).not.toContain("RESPALDA");
  });

  it("revela los cuatro votos y el multiplicador en la liquidación", () => {
    const liquidada = ronda({
      numero: 1,
      estado: "LIQUIDADA",
      multiplicador: "1.400",
      fraccion_respaldo: "0.6667",
      monto_invertido: "7500",
      retorno_ronda: "10500",
    });
    const pendiente = ronda({ numero: 2, estado: "PROGRAMADA" });
    const vm = construirPantalla(
      pantalla([liquidada, pendiente], { votos: VOTOS_COMPLETOS }),
      AHORA,
    );

    expect(vm).toMatchObject({
      fase: "LIQUIDACION",
      multiplicador: 1.4,
      fraccionRespaldo: 0.6667,
      montoInvertido: 7500,
      retornoRonda: 10500,
    });
    expect(vm?.fase === "LIQUIDACION" ? vm.votos : []).toEqual([
      { jurado: "Jurado 1", decision: "RESPALDA" },
      { jurado: "Jurado 2", decision: "RESPALDA" },
      { jurado: "Jurado 3", decision: "RECHAZA" },
      { jurado: "Jurado 4", decision: "SE_ABSTIENE" },
    ]);
  });

  it("muestra el leaderboard entre rondas con las startups ordenadas por acumulado", () => {
    const anulada = ronda({ numero: 1, estado: "ANULADA", multiplicador: "1.0" });
    const pendiente = ronda({ numero: 2, estado: "PROGRAMADA", monto_acumulado: "4000" });
    const otra = ronda({ numero: 3, estado: "PROGRAMADA", monto_acumulado: "9000" });
    const ranking = [
      { id_usuario: "1", nombre: "Ana", posicion: 1, saldo: "12000", aciertos: 2 },
      { id_usuario: "2", nombre: "Luis", posicion: 2, saldo: "9500", aciertos: 1 },
    ];
    const vm = construirPantalla(pantalla([anulada, pendiente, otra], { ranking }), AHORA);

    expect(vm).toMatchObject({ fase: "ENTRE_RONDAS", rondaCerrada: { numero: 1 } });
    if (vm?.fase !== "ENTRE_RONDAS") throw new Error("Fase inesperada");
    expect(vm.inversionistas).toEqual([
      { posicion: 1, nombre: "Ana", saldo: 12000 },
      { posicion: 2, nombre: "Luis", saldo: 9500 },
    ]);
    expect(vm.startups.map((s) => s.nombre)).toEqual(["Startup 3", "Startup 2", "Startup 1"]);
    expect(vm.startups.map((s) => s.posicion)).toEqual([1, 2, 3]);
  });

  it("declara la ganadora, el top 3 y el mejor ojo al cerrar el evento", () => {
    const rondas = [
      ronda({
        numero: 1,
        estado: "LIQUIDADA",
        fraccion_respaldo: "0.7500",
        puntaje: "0.6900",
        inversores_unicos: 6,
        startup_nombre: "AgroSense",
        ods: "ODS 2",
      }),
      ronda({
        numero: 2,
        estado: "LIQUIDADA",
        fraccion_respaldo: "0.5000",
        puntaje: "0.3800",
        inversores_unicos: 2,
        startup_nombre: "AguaClara",
      }),
    ];
    const ranking = [
      { id_usuario: "1", nombre: "Ana", posicion: 1, saldo: "18400", aciertos: 3 },
      { id_usuario: "2", nombre: "Luis", posicion: 2, saldo: "17900", aciertos: 5 },
      { id_usuario: "3", nombre: "Eva", posicion: 3, saldo: "16200", aciertos: 1 },
      { id_usuario: "4", nombre: "Rosa", posicion: 4, saldo: "15000", aciertos: 0 },
    ];
    const vm = construirPantalla(
      pantalla(rondas, { ranking, usuariosActivos: 10 }),
      AHORA,
    );

    if (vm?.fase !== "CIERRE") throw new Error("Fase inesperada");
    expect(vm.ganadora.nombre).toBe("AgroSense");
    expect(vm.ganadora.ods).toEqual({ numero: 2, nombre: "Hambre cero" });
    expect(vm.ganadora.porcentajeInversores).toBeCloseTo(0.6);
    expect(vm.ganadora.puntaje).toBeCloseTo(0.6 * 0.75 + 0.4 * 0.6);
    expect(vm.top3.map((f) => f.nombre)).toEqual(["Ana", "Luis", "Eva"]);
    expect(vm.mejorOjo).toEqual({ nombre: "Luis", aciertos: 5 });
  });
});

describe("construirVistaJurado", () => {
  const base: Omit<DatosJurado, "rondas" | "votos"> = {
    juradoId: "2",
    nombre: "Jurado de ejemplo 2",
    totalJurados: 4,
  };

  it("muestra la espera cuando no hay ronda activa", () => {
    const vm = construirVistaJurado({
      ...base,
      rondas: [ronda({ numero: 1, estado: "PROGRAMADA" })],
      votos: [],
    });
    expect(vm).toMatchObject({ screen: "espera", round: null, jurorLabel: "Jurado de ejemplo 2" });
  });

  it("muestra la votación hasta que el jurado registra su voto", () => {
    const rondas = [ronda({ numero: 3, estado: "EN_VOTACION", startup_nombre: "EduRuta" })];
    const sinVoto = construirVistaJurado({
      ...base,
      rondas,
      votos: [voto("2", "Jurado de ejemplo 2", null), voto("1", "Jurado de ejemplo 1", "RESPALDA")],
    });
    const conVoto = construirVistaJurado({
      ...base,
      rondas,
      votos: [voto("2", "Jurado de ejemplo 2", "RECHAZA"), voto("1", "Jurado de ejemplo 1", "RESPALDA")],
    });

    expect(sinVoto).toMatchObject({
      screen: "votacion",
      round: { number: 3, startupName: "EduRuta" },
      votes: { emitted: 1, total: 4 },
    });
    expect(conVoto).toMatchObject({ screen: "voto_registrado", votes: { emitted: 2, total: 4 } });
  });

  it("no expone el sentido de los votos de otros jurados", () => {
    const vm = construirVistaJurado({
      ...base,
      rondas: [ronda({ numero: 3, estado: "EN_VOTACION" })],
      votos: [voto("1", "Jurado de ejemplo 1", "RESPALDA"), voto("2", "Jurado de ejemplo 2", null)],
    });
    expect(JSON.stringify(vm)).not.toContain("RESPALDA");
  });
});

describe("construirVistaOperador", () => {
  function operador(
    rondas: FilaRonda[],
    extra: Partial<DatosOperador> = {},
  ): DatosOperador {
    return {
      rondas,
      votos: [],
      accionAnulacion: null,
      usuariosActivos: 0,
      saldos: [],
      posiciones: [],
      acciones: [],
      ahora: AHORA,
      ...extra,
    };
  }

  it("devuelve nulo cuando no hay rondas", () => {
    expect(construirVistaOperador(operador([]))).toBeNull();
  });

  it("habilita la última llamada con la ronda abierta y mantiene bloqueado el veredicto", () => {
    const vm = construirVistaOperador(operador([ronda({ numero: 1, estado: "ABIERTA" })]));
    const acciones = Object.fromEntries((vm?.actions ?? []).map((a) => [a.id, a]));

    expect(acciones.ultima_llamada).toMatchObject({ enabled: true, done: false });
    expect(acciones.cerrar).toMatchObject({ enabled: true, done: false });
    expect(acciones.abrir).toMatchObject({ enabled: false, done: true });
    expect(acciones.revelar).toMatchObject({ enabled: false, done: false });
    expect(vm?.canCancel).toBe(true);
  });

  it("indica cuántos votos faltan antes de revelar", () => {
    const vm = construirVistaOperador(
      operador([ronda({ numero: 2, estado: "EN_VOTACION" })], {
        votos: [
          voto("1", "Jurado 1", "RESPALDA"),
          voto("2", "Jurado 2", "RESPALDA"),
          voto("3", "Jurado 3", "RECHAZA"),
          voto("4", "Jurado 4", null),
        ],
      }),
    );
    const revelar = vm?.actions.find((a) => a.id === "revelar");

    expect(revelar).toMatchObject({ enabled: false, blockedReason: "Faltan 1 voto(s)" });
    expect(vm?.jurors.map((j) => j.sense)).toEqual([null, null, null, null]);
  });

  it("revela el sentido de los votos solo cuando la ronda está liquidada", () => {
    const vm = construirVistaOperador(
      operador([ronda({ numero: 1, estado: "LIQUIDADA", multiplicador: "1.4" })], {
        votos: VOTOS_COMPLETOS,
      }),
    );

    expect(vm?.jurors.map((j) => j.sense)).toEqual([
      "respalda",
      "respalda",
      "rechaza",
      "abstiene",
    ]);
    expect(vm?.round.multiplier).toBe(1.4);
  });

  it("identifica el modo de anulación registrado para la ronda", () => {
    const vm = construirVistaOperador(
      operador([ronda({ numero: 4, estado: "ANULADA", multiplicador: "1.0" })], {
        accionAnulacion: "ANULAR_LIQUIDAR_1X",
      }),
    );
    expect(vm?.round.cancelMode).toBe("liquidar_1x");
  });

  it("muestra la siguiente ronda programada una vez liquidada la anterior", () => {
    const rondas = [
      ronda({ numero: 1, estado: "LIQUIDADA" }),
      ronda({ numero: 2, estado: "PROGRAMADA", startup_nombre: "SolRed" }),
    ];
    expect(rondaReferenciaOperador(rondas)?.numero).toBe(2);
  });

  it("deja el retorno nulo mientras la posición no esté liquidada", () => {
    const vm = construirVistaOperador(
      operador([ronda({ numero: 1, estado: "ABIERTA" })], {
        posiciones: [
          { id_usuario: "5", nombre: "Ana", numero: 1, startup_nombre: "Startup 1", monto: "2000", retorno: null },
          { id_usuario: "5", nombre: "Ana", numero: 2, startup_nombre: "Startup 2", monto: "500", retorno: "700" },
        ],
      }),
    );
    expect(vm?.positions.map((p) => p.returnAmount)).toEqual([null, 700]);
  });
});
