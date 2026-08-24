import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, writeFile, mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import request from "supertest";
import { createApp } from "../src/index.js";
import { createStores } from "../src/store/appStores.js";
import { clearSessionsForTests } from "../src/auth/adminAuth.js";

describe("e2e-smoke", () => {
  let dataDir = "";
  let app: ReturnType<typeof createApp>;

  beforeEach(async () => {
    clearSessionsForTests();
    dataDir = await mkdtemp(path.join(os.tmpdir(), "lottery-e2e-"));
    await mkdir(path.join(dataDir, "uploads"), { recursive: true });
    await writeFile(
      path.join(dataDir, "config.json"),
      JSON.stringify({ adminPassphrase: "admin123" }),
    );
    process.env.LOTTERY_DATA_DIR = dataDir;
    app = createApp({ stores: createStores(dataDir) });
  });

  afterEach(() => {
    delete process.env.LOTTERY_DATA_DIR;
    clearSessionsForTests();
  });

  it("配奖→加用户→内定→开奖→winner 匹配内定", async () => {
    const login = await request(app).post("/api/admin/login").send({ passphrase: "admin123" });
    const token = login.body.token as string;
    await request(app)
      .put("/api/prizes")
      .set("Authorization", `Bearer ${token}`)
      .send([{ id: "p1", name: "特等奖", imagePath: "a.svg", order: 0 }]);
    const u1 = await request(app).post("/api/participants").send({ name: "甲" });
    const u2 = await request(app).post("/api/participants").send({ name: "乙" });
    expect(u1.status).toBe(201);
    expect(u2.status).toBe(201);
    await request(app).put("/api/session/current-prize").send({ prizeId: "p1" });
    await request(app)
      .put("/api/presets/p1")
      .set("Authorization", `Bearer ${token}`)
      .send({ participantId: u2.body.id });
    const draw = await request(app).post("/api/draw");
    expect(draw.status).toBe(200);
    expect(draw.body.participantId).toBe(u2.body.id);
    expect(draw.body.name).toBe("乙");
  });
});
