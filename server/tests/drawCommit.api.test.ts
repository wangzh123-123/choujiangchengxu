import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import request from "supertest";
import { createApp } from "../src/index.js";
import { createStores } from "../src/store/appStores.js";
import { clearSessionsForTests } from "../src/auth/adminAuth.js";

describe("POST /api/draw commits participantId", () => {
  let dataDir = "";
  let app: ReturnType<typeof createApp>;

  beforeEach(async () => {
    clearSessionsForTests();
    dataDir = await mkdtemp(path.join(os.tmpdir(), "lottery-draw-commit-"));
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

  async function login() {
    const res = await request(app).post("/api/admin/login").send({ passphrase: "admin123" });
    expect(res.status).toBe(200);
    return res.body.token as string;
  }

  async function addNamed(name: string) {
    const res = await request(app).post("/api/participants").send({ name });
    expect(res.status).toBe(201);
    return res.body as { id: string; name: string };
  }

  it("rejects missing participantId", async () => {
    const token = await login();
    await request(app)
      .put("/api/prizes")
      .set("Authorization", `Bearer ${token}`)
      .send([{ id: "p1", name: "A", imagePath: "a.png", order: 0, quantity: 1 }]);
    const u1 = await addNamed("甲");
    await request(app).put("/api/session/current-prize").send({ prizeId: "p1" });
    const res = await request(app).post("/api/draw").send({});
    expect(res.status).toBe(400);
    expect(String(res.body.message)).toBe("未指定中奖人");
    expect((await request(app).get("/api/winners")).body).toEqual([]);
    expect(u1.id).toBeTruthy();
  });

  it("writes the requested eligible person even when another is preset", async () => {
    const token = await login();
    await request(app)
      .put("/api/prizes")
      .set("Authorization", `Bearer ${token}`)
      .send([{ id: "p1", name: "A", imagePath: "a.png", order: 0, quantity: 1 }]);
    const u1 = await addNamed("甲");
    const u2 = await addNamed("乙");
    await request(app)
      .put("/api/presets/p1")
      .set("Authorization", `Bearer ${token}`)
      .send({ slots: [u2.id] });
    await request(app).put("/api/session/current-prize").send({ prizeId: "p1" });
    const res = await request(app).post("/api/draw").send({ participantId: u1.id });
    expect(res.status).toBe(200);
    expect(res.body.participantId).toBe(u1.id);
    expect(res.body.name).toBe("甲");
  });

  it("rejects an already-drawn participant", async () => {
    const token = await login();
    await request(app)
      .put("/api/prizes")
      .set("Authorization", `Bearer ${token}`)
      .send([{ id: "p1", name: "A", imagePath: "a.png", order: 0, quantity: 2 }]);
    const u1 = await addNamed("甲");
    const u2 = await addNamed("乙");
    await request(app).put("/api/session/current-prize").send({ prizeId: "p1" });
    expect((await request(app).post("/api/draw").send({ participantId: u1.id })).status).toBe(200);
    const res = await request(app).post("/api/draw").send({ participantId: u1.id });
    expect(res.status).toBe(400);
    expect(String(res.body.message)).toBe("该用户不可抽奖");
    expect(u2.id).toBeTruthy();
  });

  it("rejects unknown participantId", async () => {
    const token = await login();
    await request(app)
      .put("/api/prizes")
      .set("Authorization", `Bearer ${token}`)
      .send([{ id: "p1", name: "A", imagePath: "a.png", order: 0, quantity: 1 }]);
    await addNamed("甲");
    await request(app).put("/api/session/current-prize").send({ prizeId: "p1" });
    const res = await request(app).post("/api/draw").send({ participantId: "missing-id" });
    expect(res.status).toBe(400);
    expect(String(res.body.message)).toBe("开奖失败");
    expect((await request(app).get("/api/winners")).body).toEqual([]);
  });

  it("rejects draw when no current prize even with participantId", async () => {
    const token = await login();
    await request(app)
      .put("/api/prizes")
      .set("Authorization", `Bearer ${token}`)
      .send([{ id: "p1", name: "A", imagePath: "a.png", order: 0, quantity: 1 }]);
    const u1 = await addNamed("甲");
    const res = await request(app).post("/api/draw").send({ participantId: u1.id });
    expect(res.status).toBe(400);
    expect(String(res.body.message)).toBe("未选择当前奖品，无法开奖");
    expect((await request(app).get("/api/winners")).body).toEqual([]);
  });
});
