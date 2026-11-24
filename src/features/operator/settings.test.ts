import { describe, expect, it } from "vitest";

import { buildSettings, validateCriteria, validateSetting } from "./settings";

const CURRENT = { capital_inicial: 10000, precio_min: 50, precio_max: 200 };

describe("validateSetting (RF-28)", () => {
  it("acepta el tope de 25%", () => {
    expect(validateSetting("tope_ronda", 0.25, CURRENT)).toBeNull();
  });

  it("rechaza claves desconocidas y valores fuera de rango", () => {
    expect(validateSetting("evento_iniciado", 1, CURRENT)).toBe("INVALID_CONFIG_KEY");
    expect(validateSetting("tope_ronda", 1.5, CURRENT)).toBe("INVALID_CONFIG_VALUE");
    expect(validateSetting("duracion_pitch_s", 90.5, CURRENT)).toBe("INVALID_CONFIG_VALUE");
  });

  it("mantiene el precio mínimo por debajo del máximo", () => {
    expect(validateSetting("precio_min", 200, CURRENT)).toBe("PRICE_RANGE_INVALID");
    expect(validateSetting("precio_max", 40, CURRENT)).toBe("PRICE_RANGE_INVALID");
  });

  it("no deja la compra mínima por encima del capital", () => {
    expect(validateSetting("compra_minima", 20000, CURRENT)).toBe("MIN_ABOVE_CAPITAL");
  });
});

describe("validateCriteria", () => {
  const criteria = ["a", "b", "c", "d"].map((id) => ({
    id,
    name: `Criterio ${id}`,
    weight: 0.25,
    anchorMin: "Bajo",
    anchorMax: "Alto",
  }));

  it("exige pesos que sumen 100%", () => {
    expect(validateCriteria(criteria)).toBeNull();
    expect(validateCriteria(criteria.map((item) => ({ ...item, weight: 0.3 })))).toBe(
      "WEIGHTS_NOT_ONE",
    );
  });

  it("exige nombre y frases de referencia", () => {
    expect(validateCriteria([{ ...criteria[0], name: " " }, ...criteria.slice(1)])).toBe(
      "INVALID_CRITERIA",
    );
  });
});

describe("buildSettings", () => {
  it("lista solo las claves editables que existen, en orden", () => {
    const settings = buildSettings({ tope_ronda: 0.3, capital_inicial: 10000, otra: 1 });
    expect(settings.map((setting) => setting.key)).toEqual(["capital_inicial", "tope_ronda"]);
  });
});
