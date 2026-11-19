import { describe, expect, it } from "vitest";

import { POST } from "./route";

describe("POST /api/operator/logout", () => {
  it("responde 200 con ok true", async () => {
    const response = await POST();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
  });

  it("envía Set-Cookie que expira la cookie st_operator con los mismos atributos", async () => {
    const response = await POST();
    const cookie = response.headers
      .getSetCookie()
      .find((value) => value.startsWith("st_operator="));

    expect(cookie).toBeDefined();
    expect(cookie).toMatch(/^st_operator=;/);
    expect(cookie).toMatch(/Max-Age=0/i);
    expect(cookie).toMatch(/Path=\//);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=lax/i);
  });
});
