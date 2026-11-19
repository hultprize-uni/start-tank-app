// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { MarketCard } from "./MarketCard";

afterEach(cleanup);

const baseProps = {
  name: "Aqua Ruta",
  ods: "ODS 6 · Agua limpia",
  price: "104",
  delta: "+4 %",
  total: "1,250",
  totalLabel: "Acumulado",
  investors: "18",
  investorsLabel: "Inversores",
};

describe("MarketCard", () => {
  it("expone el nombre como encabezado de nivel 3 por defecto", () => {
    render(<MarketCard {...baseProps} />);
    expect(
      screen.getByRole("heading", { level: 3, name: "Aqua Ruta" }),
    ).toBeInTheDocument();
  });

  it("permite cambiar el nivel del encabezado", () => {
    render(<MarketCard {...baseProps} headingLevel={2} />);
    expect(
      screen.getByRole("heading", { level: 2, name: "Aqua Ruta" }),
    ).toBeInTheDocument();
  });

  it("muestra precio, variación, acumulado e inversores con sus etiquetas", () => {
    render(<MarketCard {...baseProps} />);
    expect(screen.getByText("104")).toBeInTheDocument();
    expect(screen.getByText("+4 %")).toBeInTheDocument();
    expect(screen.getByText("Acumulado")).toBeInTheDocument();
    expect(screen.getByText("1,250")).toBeInTheDocument();
    expect(screen.getByText("Inversores")).toBeInTheDocument();
    expect(screen.getByText("18")).toBeInTheDocument();
  });

  it("muestra el estado y la ronda cuando se reciben", () => {
    render(
      <MarketCard
        {...baseProps}
        status={<span>Mercado en vivo</span>}
        roundLabel="Ronda 3 de 5"
      />,
    );
    expect(screen.getByText("Mercado en vivo")).toBeInTheDocument();
    expect(screen.getByText("Ronda 3 de 5")).toBeInTheDocument();
  });

  it("omite el encabezado de estado cuando no recibe estado ni ronda", () => {
    render(<MarketCard {...baseProps} />);
    expect(screen.queryByText("Ronda 3 de 5")).not.toBeInTheDocument();
    expect(screen.queryByText("Mercado en vivo")).not.toBeInTheDocument();
  });
});
