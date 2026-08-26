import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import request from "supertest";
import { createApp } from "../src/index.js";
import { createStores } from "../src/store/appStores.js";
import { clearSessionsForTests } from "../src/auth/adminAuth.js";

describe("prize quantity API", () => {
  let dataDir = "";
  let app: ReturnType<typeof createApp>;

  beforeEach(async () => {
    clearSessionsForTests();
    dataDir = await mkdtemp(path.join(os.tmpdir(), "lottery-qty-"));
    await mkdir(path.join(dataDir, "uploads"), { recursive: true });
    await writeFile(
      path.join(dataDir, "config.json"),
      JSON.stringify({ adminPassphrase: "admin123" }, null, 2),
    );
    process.env.LOTTERY_DATA_DIR = dataDir;
    app = createApp({ stores: createStores(dataDir) });
  });

  afterEach(() => {
    delete process.env.LOTTERY_DATA_DIR;
    clearSessionsForTests();
  });

  it("GET fills quantity 1 for prizes stored without it", async () => {
    const stores = createStores(dataDir);
    await stores.prizes.write([
      { id: "p1", name: "旧奖", imagePath: "a.png", order: 0 } as never,
    ]);
    const res = await request(app).get("/api/prizes");
    expect(res.status).toBe(200);
    expect(res.body[0].quantity).toBe(1);
  });

  it("PUT rejects missing or non-integer quantity", async () => {
    const login = await request(app).post("/api/admin/login").send({ passphrase: "admin123" });
    const token = login.body.token as string;
    const missing = await request(app)
      .put("/api/prizes")
      .set("Authorization", `Bearer ${token}`)
      .send([{ id: "p1", name: "A", imagePath: "a.png", order: 0 }]);
    expect(missing.status).toBe(400);
    const zero = await request(app)
      .put("/api/prizes")
      .set("Authorization", `Bearer ${token}`)
      .send([{ id: "p1", name: "A", imagePath: "a.png", order: 0, quantity: 0 }]);
    expect(zero.status).toBe(400);
  });

  it("PUT persists quantity", async () => {
    const login = await request(app).post("/api/admin/login").send({ passphrase: "admin123" });
    const token = login.body.token as string;
    const res = await request(app)
      .put("/api/prizes")
      .set("Authorization", `Bearer ${token}`)
      .send([{ id: "p1", name: "A", imagePath: "a.png", order: 0, quantity: 3 }]);
    expect(res.status).toBe(200);
    expect(res.body[0].quantity).toBe(3);
  });
});
