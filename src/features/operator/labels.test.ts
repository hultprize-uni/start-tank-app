import { describe, expect, it } from "vitest";

import { formatMultiplier } from "./labels";

describe("formatMultiplier", () => {
  it("quita los ceros finales y conserva hasta dos decimales", () => {
    expect(formatMultiplier(1.4)).toBe("1.4x");
    expect(formatMultiplier(1.4)).not.toBe("1.40 x");
    expect(formatMultiplier(1.27)).toBe("1.27x");
    expect(formatMultiplier(1)).toBe("1x");
    expect(formatMultiplier(1.8)).toBe("1.8x");
  });
});
