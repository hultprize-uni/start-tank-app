// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Toast } from "./Toast";

afterEach(cleanup);

describe("Toast", () => {
  it("se anuncia como estado por defecto", () => {
    render(<Toast>Inversión registrada</Toast>);
    expect(screen.getByRole("status")).toHaveTextContent("Inversión registrada");
  });

  it("se anuncia como alerta cuando role es alert", () => {
    render(<Toast role="alert">Tope superado</Toast>);
    expect(screen.getByRole("alert")).toHaveTextContent("Tope superado");
  });

  it("muestra la acción recibida junto al mensaje", () => {
    render(<Toast action={<button type="button">Deshacer</button>}>Voto emitido</Toast>);
    expect(screen.getByRole("button", { name: "Deshacer" })).toBeInTheDocument();
  });
});
