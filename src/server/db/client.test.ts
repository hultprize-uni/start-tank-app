import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { sql } from "./client";

describe("sql", () => {
  const originalUrl = process.env.DATABASE_URL;

  beforeEach(() => {
    delete process.env.DATABASE_URL;
  });

  afterEach(() => {
    if (originalUrl === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = originalUrl;
    }
  });

  it("se importa sin DATABASE_URL y falla solo al ejecutar una consulta", async () => {
    await expect(sql`select 1`).rejects.toThrow(/DATABASE_URL/);
  });
});
