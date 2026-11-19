// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AmountField } from "./AmountField";

afterEach(cleanup);

function Harness({ initial = "", onChange }: { initial?: string; onChange?: (value: string) => void }) {
  const [value, setValue] = useState(initial);
  return (
    <AmountField
      label="Monto a invertir"
      value={value}
      suffix="coins"
      onChange={(next) => {
        onChange?.(next);
        setValue(next);
      }}
      shortcuts={[
        { label: "Mínimo", value: "250" },
        { label: "Todo", value: "1000" },
      ]}
      shortcutsLabel="Montos sugeridos"
    />
  );
}

describe("AmountField", () => {
  it("asocia la etiqueta con un campo numérico", () => {
    render(<Harness />);
    expect(screen.getByRole("spinbutton", { name: "Monto a invertir" })).toBeInTheDocument();
  });

  it("actualiza el valor al escribir", async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    await userEvent.type(screen.getByRole("spinbutton"), "300");
    expect(onChange).toHaveBeenLastCalledWith("300");
    expect(screen.getByRole("spinbutton")).toHaveValue(300);
  });

  it("asigna el valor del atajo al pulsarlo", async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole("button", { name: "Mínimo" }));
    expect(screen.getByRole("spinbutton")).toHaveValue(250);
  });

  it("marca el campo como inválido y enlaza el error con aria-describedby", () => {
    render(
      <AmountField
        label="Monto"
        value="100"
        onChange={() => {}}
        error="El monto mínimo es 250 coins."
      />,
    );
    const input = screen.getByRole("spinbutton", { name: "Monto" });
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription("El monto mínimo es 250 coins.");
  });

  it("combina la ayuda y el error en la descripción accesible", () => {
    render(
      <AmountField
        label="Monto"
        value="100"
        onChange={() => {}}
        hint="Compra mínima 250."
        error="Supera el tope."
      />,
    );
    expect(screen.getByRole("spinbutton")).toHaveAccessibleDescription(
      "Compra mínima 250. Supera el tope.",
    );
  });

  it("no marca aria-invalid ni descripción cuando no hay error ni ayuda", () => {
    render(<AmountField label="Monto" value="" onChange={() => {}} />);
    const input = screen.getByRole("spinbutton");
    expect(input).not.toHaveAttribute("aria-invalid");
    expect(input).not.toHaveAttribute("aria-describedby");
  });

  it("muestra el sufijo y agrupa los atajos con su etiqueta accesible", () => {
    render(<Harness />);
    expect(screen.getByText("coins")).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Montos sugeridos" })).toBeInTheDocument();
  });

  it("deshabilita el campo y los atajos cuando disabled es verdadero", () => {
    render(
      <AmountField
        label="Monto"
        value=""
        onChange={() => {}}
        disabled
        shortcuts={[{ label: "Mínimo", value: "250" }]}
        shortcutsLabel="Atajos"
      />,
    );
    expect(screen.getByRole("spinbutton")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Mínimo" })).toBeDisabled();
  });
});
