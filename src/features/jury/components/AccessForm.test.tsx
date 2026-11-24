// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  ACCESS_CODE_MAX_LENGTH,
  AccessForm,
  normalizeAccessCode,
  sanitizeAccessCode,
} from "./AccessForm";

describe("sanitizeAccessCode", () => {
  it("conserva letras, dígitos, guiones y espacios sin cambiar mayúsculas", () => {
    expect(sanitizeAccessCode("JUR-EJ-001")).toBe("JUR-EJ-001");
    expect(sanitizeAccessCode("ab 12")).toBe("ab 12");
  });

  it("descarta los caracteres no admitidos", () => {
    expect(sanitizeAccessCode("JUR_1!#")).toBe("JUR1");
  });

  it("limita el código a la longitud máxima", () => {
    expect(sanitizeAccessCode("A".repeat(40))).toHaveLength(ACCESS_CODE_MAX_LENGTH);
  });
});

describe("normalizeAccessCode", () => {
  it("recorta los extremos y colapsa los espacios internos", () => {
    expect(normalizeAccessCode("  JUR-EJ   001 ")).toBe("JUR-EJ 001");
  });
});

afterEach(cleanup);

const IDLE = { status: "idle" as const, errorMessage: null };

describe("AccessForm", () => {
  it("expone el campo de código con nombre accesible y el botón de entrada", () => {
    render(<AccessForm access={IDLE} onSubmit={vi.fn()} />);

    expect(screen.getByRole("heading", { level: 1, name: "Tu calificación define el retorno." })).toBeInTheDocument();
    expect(screen.getByLabelText("Código de acceso")).toHaveAttribute("autocomplete", "off");
    expect(screen.getByRole("button", { name: "Entrar" })).toBeInTheDocument();
  });

  it("envía una cadena vacía cuando se intenta entrar sin código", async () => {
    const onSubmit = vi.fn();
    render(<AccessForm access={IDLE} onSubmit={onSubmit} />);

    await userEvent.click(screen.getByRole("button", { name: "Entrar" }));

    expect(onSubmit).toHaveBeenCalledWith("");
  });

  it("envía el código sin espacios laterales", async () => {
    const onSubmit = vi.fn();
    render(<AccessForm access={IDLE} onSubmit={onSubmit} />);

    await userEvent.type(screen.getByLabelText("Código de acceso"), "  JUR-EJ-001 ");
    await userEvent.click(screen.getByRole("button", { name: "Entrar" }));

    expect(onSubmit).toHaveBeenCalledWith("JUR-EJ-001");
  });

  it("acepta códigos alfanuméricos completos en el campo", async () => {
    render(<AccessForm access={IDLE} onSubmit={vi.fn()} />);

    const input = screen.getByLabelText("Código de acceso");
    await userEvent.type(input, "JUR-EJ-001");

    expect(input).toHaveValue("JUR-EJ-001");
  });

  it("anuncia el error y lo asocia al campo", () => {
    render(
      <AccessForm
        access={{ status: "error", errorMessage: "El código no es válido." }}
        onSubmit={vi.fn()}
      />,
    );

    const input = screen.getByLabelText("Código de acceso");
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("El código no es válido.");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription("El código no es válido.");
  });

  it("bloquea el campo mientras el código se valida", () => {
    render(<AccessForm access={{ status: "validating", errorMessage: null }} onSubmit={vi.fn()} />);

    expect(screen.getByLabelText("Código de acceso")).toBeDisabled();
  });

  it("no envía de nuevo mientras la validación está en curso", async () => {
    const onSubmit = vi.fn();
    render(<AccessForm access={{ status: "validating", errorMessage: null }} onSubmit={onSubmit} />);

    await userEvent.click(screen.getByRole("button", { name: /Validando código/ }));

    expect(onSubmit).not.toHaveBeenCalled();
  });
});
