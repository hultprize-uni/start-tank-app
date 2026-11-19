// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SegmentedChoice } from "./SegmentedChoice";

afterEach(cleanup);

const options = [
  { value: "low", label: "Baja" },
  { value: "mid", label: "Media" },
  { value: "high", label: "Alta", disabled: true },
];

function Harness({ onChange }: { onChange: (value: string) => void }) {
  const [value, setValue] = useState("low");
  return (
    <SegmentedChoice
      label="Nivel de riesgo"
      options={options}
      value={value}
      onChange={(next) => {
        onChange(next);
        setValue(next);
      }}
    />
  );
}

describe("SegmentedChoice", () => {
  it("expone un radiogroup con el nombre accesible recibido", () => {
    render(<Harness onChange={() => {}} />);
    expect(
      screen.getByRole("radiogroup", { name: "Nivel de riesgo" }),
    ).toBeInTheDocument();
  });

  it("marca como seleccionada la opción indicada por value", () => {
    render(<Harness onChange={() => {}} />);
    expect(screen.getByRole("radio", { name: "Baja" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Media" })).not.toBeChecked();
  });

  it("cambia la selección al hacer clic y notifica el valor", async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    await userEvent.click(screen.getByRole("radio", { name: "Media" }));
    expect(onChange).toHaveBeenCalledWith("mid");
    expect(screen.getByRole("radio", { name: "Media" })).toBeChecked();
  });

  it("permite navegar con las flechas del teclado", async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    await userEvent.tab();
    expect(screen.getByRole("radio", { name: "Baja" })).toHaveFocus();
    await userEvent.keyboard("{ArrowRight}");
    expect(onChange).toHaveBeenLastCalledWith("mid");
    expect(screen.getByRole("radio", { name: "Media" })).toHaveFocus();
  });

  it("no permite seleccionar una opción deshabilitada", async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    const disabled = screen.getByRole("radio", { name: "Alta" });
    expect(disabled).toBeDisabled();
    await userEvent.click(disabled);
    expect(onChange).not.toHaveBeenCalled();
  });
});
