import { afterEach, describe, expect, it } from "vitest";
import { verifyPassphrase } from "../src/auth/adminAuth.js";

describe("verifyPassphrase", () => {
  afterEach(() => {
    delete process.env.ADMIN_PASSPHRASE;
  });

  it("uses ADMIN_PASSPHRASE env when set", async () => {
    process.env.ADMIN_PASSPHRASE = "from-env";
    expect(await verifyPassphrase("from-env")).toBe(true);
    expect(await verifyPassphrase("admin123")).toBe(false);
  });
});
