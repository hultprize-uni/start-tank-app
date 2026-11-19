// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { StatBlock } from "./StatBlock";

afterEach(cleanup);

describe("StatBlock", () => {
  it("asocia la etiqueta y el valor mediante una lista de descripción", () => {
    render(<StatBlock label="Acumulado" value="1,250" />);
    expect(screen.getByText("Acumulado").tagName).toBe("DT");
    expect(screen.getByText("1,250").tagName).toBe("DD");
  });

  it("acepta nodos como etiqueta y valor", () => {
    render(
      <StatBlock
        label={<span>Inversores</span>}
        value={<strong>42</strong>}
      />,
    );
    expect(screen.getByText("Inversores")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
  });
});
