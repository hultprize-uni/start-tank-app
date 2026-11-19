// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Badge } from "./Badge";

afterEach(cleanup);

describe("Badge", () => {
  it("muestra el contenido recibido como texto", () => {
    render(<Badge>Mercado abierto</Badge>);
    expect(screen.getByText("Mercado abierto")).toBeInTheDocument();
  });

  it("no incluye punto en vivo por defecto", () => {
    const { container } = render(<Badge>Programada</Badge>);
    expect(container.querySelector("[aria-hidden='true']")).toBeNull();
  });

  it("incluye un punto pulsante decorativo cuando live es verdadero", () => {
    const { container } = render(<Badge live>Mercado abierto</Badge>);
    expect(container.querySelector("[aria-hidden='true']")).not.toBeNull();
    expect(screen.getByText("Mercado abierto")).toBeInTheDocument();
  });
});
