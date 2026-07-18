import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, writeFile, mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import request from "supertest";
import { createApp } from "../src/index.js";
import { createStores } from "../src/store/appStores.js";
import { clearSessionsForTests } from "../src/auth/adminAuth.js";

async function makeDataDir(): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "lottery-api-"));
  await mkdir(path.join(dir, "uploads"), { recursive: true });
  await writeFile(
    path.join(dir, "config.json"),
    JSON.stringify({ adminPassphrase: "admin123" }, null, 2),
  );
  return dir;
}

describe("Wave2 APIs", () => {
  let dataDir = "";
  let app: ReturnType<typeof createApp>;

  beforeEach(async () => {
    clearSessionsForTests();
    dataDir = await makeDataDir();
    process.env.LOTTERY_DATA_DIR = dataDir;
    const stores = createStores(dataDir);
    app = createApp({ stores });
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

  it("rejects prize write without auth", async () => {
    const res = await request(app).put("/api/prizes").send([]);
    expect(res.status).toBe(401);
  });

  it("rejects prize without name", async () => {
    const token = await login();
    const res = await request(app)
      .put("/api/prizes")
      .set("Authorization", `Bearer ${token}`)
      .send([{ id: "1", name: "", imagePath: "a.png", order: 0 }]);
    expect(res.status).toBe(400);
  });

  it("sets current prize", async () => {
    const token = await login();
    await request(app)
      .put("/api/prizes")
      .set("Authorization", `Bearer ${token}`)
      .send([{ id: "p1", name: "特等奖", imagePath: "a.png", order: 0 }]);
    const res = await request(app).put("/api/session/current-prize").send({ prizeId: "p1" });
    expect(res.status).toBe(200);
    expect(res.body.currentPrizeId).toBe("p1");
  });

  it("rejects duplicate name", async () => {
    await request(app).post("/api/participants").send({ id: "1", name: "张三" });
    const res = await request(app).post("/api/participants").send({ id: "2", name: "张三" });
    expect(res.status).toBe(409);
    expect(String(res.body.message)).toMatch(/重新|重复|名称/);
  });

  it("rejects preset of prior winner", async () => {
    const token = await login();
    await request(app)
      .put("/api/prizes")
      .set("Authorization", `Bearer ${token}`)
      .send([
        { id: "p0", name: "三等奖", imagePath: "a.png", order: 0 },
        { id: "p1", name: "二等奖", imagePath: "b.png", order: 1 },
      ]);
    await request(app).post("/api/participants").send({ id: "u1", name: "甲" });
    await request(app).post("/api/participants").send({ id: "u2", name: "乙" });
    await request(app).put("/api/session/current-prize").send({ prizeId: "p0" });
    await request(app)
      .put("/api/presets/p0")
      .set("Authorization", `Bearer ${token}`)
      .send({ participantId: "u1" });
    const draw = await request(app).post("/api/draw");
    expect(draw.status).toBe(200);
    expect(draw.body.participantId).toBe("u1");
    const preset = await request(app)
      .put("/api/presets/p1")
      .set("Authorization", `Bearer ${token}`)
      .send({ participantId: "u1" });
    expect(preset.status).toBe(400);
  });

  it("rejects draw with empty eligible", async () => {
    const token = await login();
    await request(app)
      .put("/api/prizes")
      .set("Authorization", `Bearer ${token}`)
      .send([{ id: "p1", name: "特等奖", imagePath: "a.png", order: 0 }]);
    await request(app).put("/api/session/current-prize").send({ prizeId: "p1" });
    const res = await request(app).post("/api/draw");
    expect(res.status).toBe(400);
  });

  it("public view does not require admin", async () => {
    const res = await request(app).get("/api/public/view");
    expect(res.status).toBe(200);
    expect(res.body.session).toBeDefined();
  });

  it("patches publicScreen", async () => {
    const res = await request(app).patch("/api/session").send({ publicScreen: "draw" });
    expect(res.body.publicScreen).toBe("draw");
  });

  it("hard preset wins draw", async () => {
    const token = await login();
    await request(app)
      .put("/api/prizes")
      .set("Authorization", `Bearer ${token}`)
      .send([{ id: "p1", name: "特等奖", imagePath: "a.png", order: 0 }]);
    await request(app).post("/api/participants").send({ id: "u1", name: "甲" });
    await request(app).post("/api/participants").send({ id: "u2", name: "乙" });
    await request(app).put("/api/session/current-prize").send({ prizeId: "p1" });
    await request(app)
      .put("/api/presets/p1")
      .set("Authorization", `Bearer ${token}`)
      .send({ participantId: "u2" });
    const draw = await request(app).post("/api/draw");
    expect(draw.status).toBe(200);
    expect(draw.body.participantId).toBe("u2");
    expect(draw.body.name).toBe("乙");
  });
});
