// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LoginScreen } from "./LoginScreen";

const signInSocial = vi.hoisted(() => vi.fn());

vi.mock("../api/auth-client", () => ({
  authClient: { signIn: { social: signInSocial } },
}));

afterEach(cleanup);

beforeEach(() => {
  signInSocial.mockReset();
});

describe("LoginScreen", () => {
  it("presenta el título, el saldo inicial y el botón de ingreso", () => {
    render(<LoginScreen isDesktop={false} />);

    expect(screen.getByRole("heading", { level: 1, name: "El público invierte. El jurado decide." })).toBeInTheDocument();
    expect(screen.getByText(/Recibes 10,000 Impact Coins/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ingresar con mi cuenta" })).toBeEnabled();
  });

  it("inicia el ingreso con Google y no solicita contraseñas", async () => {
    const user = userEvent.setup();
    signInSocial.mockResolvedValue({ error: null });
    render(<LoginScreen isDesktop />);

    await user.click(screen.getByRole("button", { name: "Ingresar con mi cuenta" }));

    expect(signInSocial).toHaveBeenCalledWith(expect.objectContaining({ provider: "google" }));
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/contraseña/i)).not.toBeInTheDocument();
  });

  it("muestra el error y vuelve a habilitar el botón cuando el ingreso falla", async () => {
    const user = userEvent.setup();
    signInSocial.mockResolvedValue({ error: { message: "rechazado" } });
    render(<LoginScreen isDesktop={false} />);

    await user.click(screen.getByRole("button", { name: "Ingresar con mi cuenta" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("No fue posible iniciar sesión. Intenta de nuevo.");
    expect(screen.getByRole("button", { name: "Ingresar con mi cuenta" })).toBeEnabled();
  });

  it("trata una excepción del cliente de autenticación como fallo de ingreso", async () => {
    const user = userEvent.setup();
    signInSocial.mockRejectedValue(new Error("sin red"));
    render(<LoginScreen isDesktop={false} />);

    await user.click(screen.getByRole("button", { name: "Ingresar con mi cuenta" }));

    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Ingresar con mi cuenta" })).toBeEnabled();
  });
});
