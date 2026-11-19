import { describe, expect, it } from "vitest";

import { POST } from "./route";

describe("POST /api/jury/logout", () => {
  it("responde 200 con ok true", async () => {
    const response = await POST();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
  });

  it("envía Set-Cookie que expira la cookie st_jury con los mismos atributos", async () => {
    const response = await POST();
    const cookie = response.headers.getSetCookie().find((value) => value.startsWith("st_jury="));

    expect(cookie).toBeDefined();
    expect(cookie).toMatch(/^st_jury=;/);
    expect(cookie).toMatch(/Max-Age=0/i);
    expect(cookie).toMatch(/Path=\//);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=lax/i);
  });
});
