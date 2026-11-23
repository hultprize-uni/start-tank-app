// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ScoreScale } from "./ScoreScale";

afterEach(cleanup);

describe("ScoreScale", () => {
  it("muestra cinco opciones del 1 al 5 y las frases de referencia", () => {
    render(
      <ScoreScale
        criterionId="1"
        criterionName="Problema y mercado"
        anchorMin="Problema difuso, sin mercado claro"
        anchorMax="Problema real y mercado grande bien definido"
        value={null}
        onChange={vi.fn()}
      />,
    );

    const group = screen.getByRole("radiogroup", { name: "Puntaje para Problema y mercado" });
    expect(within(group).getAllByRole("radio")).toHaveLength(5);
    expect(screen.getByRole("radio", { name: /1 No invertiría/ })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /5 Invertiría hoy/ })).toBeInTheDocument();
    expect(screen.getByText("Problema difuso, sin mercado claro")).toBeInTheDocument();
    expect(screen.getByText("Problema real y mercado grande bien definido")).toBeInTheDocument();
  });

  it("marca la nota seleccionada y notifica los cambios al elegir otra", async () => {
    const onChange = vi.fn();
    render(
      <ScoreScale
        criterionId="2"
        criterionName="Modelo de negocio"
        anchorMin="Sin ingresos"
        anchorMax="Ingresos claros"
        value={3}
        onChange={onChange}
      />,
    );

    expect(screen.getByRole("radio", { name: /3 Neutro/ })).toBeChecked();

    await userEvent.click(screen.getByRole("radio", { name: /4 Sólido/ }));

    expect(onChange).toHaveBeenCalledWith(4);
  });

  it("deshabilita las opciones cuando está bloqueado", () => {
    render(
      <ScoreScale
        criterionId="3"
        criterionName="Impacto ODS"
        anchorMin="Marginal"
        anchorMax="Medible"
        value={2}
        disabled
        onChange={vi.fn()}
      />,
    );

    for (const radio of screen.getAllByRole("radio")) {
      expect(radio).toBeDisabled();
    }
  });
});
