import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { sql } from "./client";

describe("sql", () => {
  const urlOriginal = process.env.DATABASE_URL;

  beforeEach(() => {
    delete process.env.DATABASE_URL;
  });

  afterEach(() => {
    if (urlOriginal === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = urlOriginal;
    }
  });

  it("se importa sin DATABASE_URL y falla solo al ejecutar una consulta", async () => {
    await expect(sql`select 1`).rejects.toThrow(/DATABASE_URL/);
  });
});
