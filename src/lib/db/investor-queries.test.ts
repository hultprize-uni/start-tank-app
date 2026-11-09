import { beforeEach, describe, expect, it, vi } from "vitest";

const sqlMock = vi.hoisted(() => vi.fn());

vi.mock("./client", () => ({ sql: sqlMock }));

import {
  construirEstadoInversionista,
  type DatosEstadoInversionista,
  type FilaRondaInversionista,
  registrarInversion,
} from "./investor-queries";

/** Fila de ronda con valores por defecto; cada prueba sobrescribe solo lo que necesita. */
function ronda(
  numero: number,
  estado: FilaRondaInversionista["estado"],
  extra: Partial<FilaRondaInversionista> = {},
): FilaRondaInversionista {
  return {
    id_ronda: String(numero),
    numero,
    estado,
    multiplicador: null,
    segundos_ultima_llamada: null,
    startup_nombre: "AgroSense",
    ods: "ODS 2",
    descripcion: "Descripción de prueba",
    monto_acumulado: "0",
    inversores_unicos: 0,
    precio_vivo: "100.00",
    ...extra,
  };
}

/** Datos base del inversionista con saldo de 10,000 y sin inversiones. */
function datos(extra: Partial<DatosEstadoInversionista>): DatosEstadoInversionista {
  return {
    idUsuario: 7,
    saldo: 10_000,
    rondas: [],
    inversiones: [],
    decisionesUltima: [],
    topTres: [],
    filaPropia: null,
    participantes: 0,
    posicionPrevia: null,
    ...extra,
  };
}

const rondasProgramadas = [ronda(1, "PROGRAMADA"), ronda(2, "PROGRAMADA"), ronda(3, "PROGRAMADA")];

beforeEach(() => {
  sqlMock.mockReset();
});

describe("construirEstadoInversionista", () => {
  it("arma la fase programada con tope de 30 % del saldo y sin mercado ni veredicto", () => {
    const vm = construirEstadoInversionista(datos({ rondas: rondasProgramadas }));

    expect(vm).toEqual({
      phase: "scheduled",
      round: { number: 1, total: 3 },
      startup: { name: "AgroSense", ods: "ODS 2 · Hambre cero", description: "Descripción de prueba" },
      wallet: { balance: 10_000, investedInRound: 0, roundCap: 3_000 },
      market: null,
      countdownSeconds: null,
      verdict: null,
      standing: null,
    });
  });

  it("calcula el tope con el saldo al abrir la ronda y expone el mercado en fase abierta", () => {
    const vm = construirEstadoInversionista(
      datos({
        saldo: 9_500,
        rondas: [
          ronda(1, "ABIERTA", { monto_acumulado: "4000", precio_vivo: "120.00", inversores_unicos: 18 }),
          ronda(2, "PROGRAMADA"),
        ],
        inversiones: [{ id_ronda: "1", monto: "500", retorno: "0" }],
      }),
    );

    expect(vm.phase).toBe("open");
    expect(vm.wallet).toEqual({ balance: 9_500, investedInRound: 500, roundCap: 3_000 });
    expect(vm.market).toEqual({ price: 120, priceChange: 20, totalRaised: 4_000, investorCount: 18 });
    expect(vm.countdownSeconds).toBeNull();
    expect(vm.verdict).toBeNull();
    expect(vm.standing).toBeNull();
  });

  it("informa los segundos restantes de la última llamada sin bajar de cero", () => {
    const enLlamada = construirEstadoInversionista(
      datos({ rondas: [ronda(1, "ULTIMA_LLAMADA", { segundos_ultima_llamada: 20.7 })] }),
    );
    const vencida = construirEstadoInversionista(
      datos({ rondas: [ronda(1, "ULTIMA_LLAMADA", { segundos_ultima_llamada: 75 })] }),
    );

    expect(enLlamada.phase).toBe("lastCall");
    expect(enLlamada.countdownSeconds).toBe(40);
    expect(vencida.countdownSeconds).toBe(0);
  });

  it("oculta el mercado durante la votación", () => {
    const vm = construirEstadoInversionista(datos({ rondas: [ronda(1, "EN_VOTACION")] }));

    expect(vm.phase).toBe("voting");
    expect(vm.market).toBeNull();
    expect(vm.standing).toBeNull();
  });

  it("arma veredicto y clasificación tras liquidar, con la posición propia", () => {
    const vm = construirEstadoInversionista(
      datos({
        saldo: 10_200,
        rondas: [ronda(1, "LIQUIDADA", { multiplicador: "1.400" }), ronda(2, "PROGRAMADA")],
        inversiones: [{ id_ronda: "1", monto: "500", retorno: "700" }],
        decisionesUltima: ["RESPALDA", "RESPALDA", "RESPALDA", "RECHAZA"],
        topTres: [
          { id_usuario: "1", nombre: "Sofía", posicion: 1, saldo: "12000.00", aciertos: 2 },
          { id_usuario: "2", nombre: "Carlos", posicion: 2, saldo: "11000.00", aciertos: 1 },
          { id_usuario: "3", nombre: "Lucía", posicion: 3, saldo: "10900.00", aciertos: 1 },
        ],
        filaPropia: { id_usuario: "7", nombre: "Ana", posicion: 4, saldo: "10200.00", aciertos: 1 },
        participantes: 74,
        posicionPrevia: 6,
      }),
    );

    expect(vm.phase).toBe("result");
    expect(vm.round).toEqual({ number: 1, total: 2 });
    expect(vm.wallet).toEqual({ balance: 10_200, investedInRound: 500, roundCap: 3_000 });
    expect(vm.verdict).toEqual({
      decisions: ["RESPALDA", "RESPALDA", "RESPALDA", "RECHAZA"],
      backs: 3,
      voters: 4,
      multiplier: 1.4,
      invested: 500,
      payout: 700,
      gain: 200,
    });
    expect(vm.standing).toEqual({
      position: 4,
      previousPosition: 6,
      participants: 74,
      hits: 1,
      hitsTotal: 1,
      topThree: [
        { position: 1, name: "Sofía", balance: 12_000, isCurrent: false },
        { position: 2, name: "Carlos", balance: 11_000, isCurrent: false },
        { position: 3, name: "Lucía", balance: 10_900, isCurrent: false },
      ],
      me: { position: 4, name: "Tú", balance: 10_200, isCurrent: true },
    });
  });

  it("pasa a la fase final cuando no quedan rondas por abrir", () => {
    const vm = construirEstadoInversionista(
      datos({
        rondas: [ronda(1, "LIQUIDADA", { multiplicador: "0.200" })],
        inversiones: [{ id_ronda: "1", monto: "300", retorno: "60" }],
        decisionesUltima: ["RECHAZA", "RECHAZA", "RECHAZA", "RECHAZA"],
        filaPropia: { id_usuario: "7", nombre: "Ana", posicion: 1, saldo: "9760.00", aciertos: 0 },
        participantes: 1,
      }),
    );

    expect(vm.phase).toBe("final");
    expect(vm.round).toEqual({ number: 1, total: 1 });
    expect(vm.standing?.previousPosition).toBe(1);
    expect(vm.standing?.hitsTotal).toBe(1);
  });

  it("conserva la forma completa del view model en todas las fases", () => {
    const vm = construirEstadoInversionista(datos({ rondas: rondasProgramadas }));

    expect(Object.keys(vm).sort()).toEqual(
      [
        "countdownSeconds",
        "market",
        "phase",
        "round",
        "standing",
        "startup",
        "verdict",
        "wallet",
      ].sort(),
    );
  });
});

describe("registrarInversion", () => {
  it("devuelve RONDA_NO_ABIERTA sin invocar la función cuando no hay ronda abierta", async () => {
    sqlMock.mockResolvedValueOnce([]);

    const resultado = await registrarInversion(7, 300);

    expect(resultado).toEqual({ ok: false, error: "RONDA_NO_ABIERTA" });
    expect(sqlMock).toHaveBeenCalledTimes(1);
  });

  it("invoca fn_registrar_inversion con el usuario recibido y devuelve el resultado de la función", async () => {
    sqlMock
      .mockResolvedValueOnce([{ id_ronda: "3" }])
      .mockResolvedValueOnce([{ resultado: { ok: false, error: "TOPE_RONDA_SUPERADO", saldo: 9000 } }]);

    const resultado = await registrarInversion(7, 300);

    expect(resultado).toEqual({ ok: false, error: "TOPE_RONDA_SUPERADO", saldo: 9000 });
    const [textoFuncion, ...parametros] = sqlMock.mock.calls[1] as [TemplateStringsArray, ...unknown[]];
    expect(textoFuncion.join("?")).toContain("fn_registrar_inversion");
    expect(parametros).toEqual([7, "3", 300]);
  });
});
