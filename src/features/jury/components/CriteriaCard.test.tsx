// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DEFAULT_JURY_CRITERIA } from "../criteria";
import { CriteriaCard } from "./CriteriaCard";

afterEach(cleanup);

describe("CriteriaCard", () => {
  it("muestra el nombre del criterio, su peso y las frases de referencia", () => {
    render(
      <CriteriaCard
        index={0}
        criterion={DEFAULT_JURY_CRITERIA[0]}
        value={null}
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByRole("heading", { name: "Problema y mercado" })).toBeInTheDocument();
    expect(screen.getByText("25%")).toBeInTheDocument();
    expect(screen.getByText("Elige una nota del 1 al 5")).toBeInTheDocument();
    expect(screen.getByText("Problema difuso, sin mercado claro")).toBeInTheDocument();
  });

  it("muestra la nota elegida y notifica al seleccionar una nueva", async () => {
    const onChange = vi.fn();
    render(
      <CriteriaCard
        index={1}
        criterion={DEFAULT_JURY_CRITERIA[1]}
        value={4}
        onChange={onChange}
      />,
    );

    expect(screen.getByText("4 / 5")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("radio", { name: /5 Invertiría hoy/ }));
    expect(onChange).toHaveBeenCalledWith(5);
  });
});
