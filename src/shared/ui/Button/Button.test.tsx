// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Button } from "./Button";

afterEach(cleanup);

describe("Button", () => {
  it("renderiza un button nativo de tipo button por defecto", () => {
    render(<Button>Invertir</Button>);
    const button = screen.getByRole("button", { name: "Invertir" });
    expect(button.tagName).toBe("BUTTON");
    expect(button).toHaveAttribute("type", "button");
  });

  it("ejecuta onClick al pulsar", async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Confirmar</Button>);
    await userEvent.click(screen.getByRole("button", { name: "Confirmar" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("se activa con el teclado", async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Confirmar</Button>);
    await userEvent.tab();
    expect(screen.getByRole("button", { name: "Confirmar" })).toHaveFocus();
    await userEvent.keyboard("{Enter}");
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("no responde cuando está deshabilitado", async () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Confirmar
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Confirmar" });
    expect(button).toBeDisabled();
    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("muestra el estado de carga, se deshabilita y añade la etiqueta accesible", () => {
    render(<Button loading>Enviar</Button>);
    const button = screen.getByRole("button", { name: /Enviar.*Cargando/ });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
  });

  it("acepta una etiqueta de carga configurable", () => {
    render(
      <Button loading loadingLabel="Procesando">
        Enviar
      </Button>,
    );
    expect(
      screen.getByRole("button", { name: /Enviar.*Procesando/ }),
    ).toBeInTheDocument();
  });

  it("no marca aria-busy fuera del estado de carga", () => {
    render(<Button>Enviar</Button>);
    expect(screen.getByRole("button", { name: "Enviar" })).not.toHaveAttribute(
      "aria-busy",
    );
  });
});
