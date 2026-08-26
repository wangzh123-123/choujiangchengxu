import { createServer } from "node:net";
import { describe, expect, it } from "vitest";
import { isPortFree } from "../src/setup/ports.js";

describe("isPortFree", () => {
  it("is false when the port is already listening", async () => {
    const server = createServer();
    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", () => resolve());
    });
    const addr = server.address();
    if (!addr || typeof addr === "string") {
      server.close();
      throw new Error("expected tcp address");
    }
    expect(await isPortFree(addr.port)).toBe(false);
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
    expect(await isPortFree(addr.port)).toBe(true);
  });
});
