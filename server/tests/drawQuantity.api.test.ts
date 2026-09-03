import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import request from "supertest";
import { createApp } from "../src/index.js";
import { createStores } from "../src/store/appStores.js";
import { clearSessionsForTests } from "../src/auth/adminAuth.js";

describe("draw quantity API", () => {
  let dataDir = "";
  let app: ReturnType<typeof createApp>;

  beforeEach(async () => {
    clearSessionsForTests();
    dataDir = await mkdtemp(path.join(os.tmpdir(), "lottery-draw-qty-"));
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

  it("allows three draws for quantity 3 then rejects the fourth", async () => {
    const token = await login();
    await request(app)
      .put("/api/prizes")
      .set("Authorization", `Bearer ${token}`)
      .send([{ id: "p1", name: "A", imagePath: "a.png", order: 0, quantity: 3 }]);
    const jia = await addNamed("甲");
    const yi = await addNamed("乙");
    const bing = await addNamed("丙");
    await request(app).put("/api/session/current-prize").send({ prizeId: "p1" });

    const first = await request(app).post("/api/draw").send({ participantId: jia.id });
    expect(first.status).toBe(200);
    expect(first.body.drawnCount).toBe(1);
    expect(first.body.quantity).toBe(3);
    expect(first.body.prizeComplete).toBe(false);

    const second = await request(app).post("/api/draw").send({ participantId: yi.id });
    expect(second.status).toBe(200);
    expect(second.body.drawnCount).toBe(2);
    expect(second.body.quantity).toBe(3);
    expect(second.body.prizeComplete).toBe(false);

    const third = await request(app).post("/api/draw").send({ participantId: bing.id });
    expect(third.status).toBe(200);
    expect(third.body.prizeComplete).toBe(true);
    expect(third.body.drawnCount).toBe(3);
    expect(third.body.quantity).toBe(3);

    const fourth = await request(app).post("/api/draw").send({ participantId: jia.id });
    expect(fourth.status).toBe(400);
    expect(String(fourth.body.message)).toBe("该奖品已抽完");
    expect(String(fourth.body.message)).not.toBe("该奖品已开奖");
  });

  it("uses slot 0 and slot 2 presets with random in between", async () => {
    const token = await login();
    await request(app)
      .put("/api/prizes")
      .set("Authorization", `Bearer ${token}`)
      .send([{ id: "p1", name: "A", imagePath: "a.png", order: 0, quantity: 3 }]);
    const jia = await addNamed("甲");
    const yi = await addNamed("乙");
    const bing = await addNamed("丙");
    const ding = await addNamed("丁");
    await request(app)
      .put("/api/presets/p1")
      .set("Authorization", `Bearer ${token}`)
      .send({ slots: [jia.id, null, bing.id] });
    await request(app).put("/api/session/current-prize").send({ prizeId: "p1" });

    const first = await request(app).post("/api/draw").send({ participantId: jia.id });
    expect(first.status).toBe(200);
    expect(first.body.participantId).toBe(jia.id);
    expect(first.body.name).toBe("甲");

    expect(ding.id).toBeTruthy();
    const second = await request(app).post("/api/draw").send({ participantId: yi.id });
    expect(second.status).toBe(200);
    expect(second.body.participantId).toBe(yi.id);
    expect(second.body.name).toBe("乙");

    const third = await request(app).post("/api/draw").send({ participantId: bing.id });
    expect(third.status).toBe(200);
    expect(third.body.participantId).toBe(bing.id);
    expect(third.body.name).toBe("丙");
  });
});
