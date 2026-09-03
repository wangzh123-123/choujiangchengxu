import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import request from "supertest";
import { createApp } from "../src/index.js";
import { createStores } from "../src/store/appStores.js";
import { clearSessionsForTests } from "../src/auth/adminAuth.js";

describe("draw advances current prize when complete", () => {
  let dataDir = "";
  let app: ReturnType<typeof createApp>;

  beforeEach(async () => {
    clearSessionsForTests();
    dataDir = await mkdtemp(path.join(os.tmpdir(), "lottery-draw-next-"));
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

  async function seedThreePrizes(token: string) {
    await request(app)
      .put("/api/prizes")
      .set("Authorization", `Bearer ${token}`)
      .send([
        { id: "p1", name: "一", imagePath: "a.png", order: 0, quantity: 1 },
        { id: "p2", name: "二", imagePath: "b.png", order: 1, quantity: 1 },
        { id: "p3", name: "三", imagePath: "c.png", order: 2, quantity: 1 },
      ]);
  }

  it("moves currentPrizeId to the next prize when this prize completes", async () => {
    const token = await login();
    await seedThreePrizes(token);
    const jia = await addNamed("甲");
    const yi = await addNamed("乙");
    const bing = await addNamed("丙");
    expect(yi.id).toBeTruthy();
    expect(bing.id).toBeTruthy();
    await request(app).put("/api/session/current-prize").send({ prizeId: "p1" });

    const drawn = await request(app).post("/api/draw").send({ participantId: jia.id });
    expect(drawn.status).toBe(200);
    expect(drawn.body.prizeComplete).toBe(true);
    expect(drawn.body.prizeId).toBe("p1");
    expect(drawn.body.currentPrizeId).toBe("p2");

    const session = await request(app).get("/api/session");
    expect(session.body.currentPrizeId).toBe("p2");
    expect(session.body.lastWinnerPrizeId).toBe("p1");
  });

  it("skips an already complete next prize", async () => {
    const token = await login();
    await seedThreePrizes(token);
    const jia = await addNamed("甲");
    const yi = await addNamed("乙");
    const bing = await addNamed("丙");
    expect(bing.id).toBeTruthy();
    await request(app).put("/api/session/current-prize").send({ prizeId: "p2" });
    const first = await request(app).post("/api/draw").send({ participantId: jia.id });
    expect(first.status).toBe(200);
    expect(first.body.prizeId).toBe("p2");

    await request(app).put("/api/session/current-prize").send({ prizeId: "p1" });
    const second = await request(app).post("/api/draw").send({ participantId: yi.id });
    expect(second.status).toBe(200);
    expect(second.body.prizeId).toBe("p1");
    expect(second.body.currentPrizeId).toBe("p3");
    const session = await request(app).get("/api/session");
    expect(session.body.currentPrizeId).toBe("p3");
    expect(session.body.lastWinnerPrizeId).toBe("p1");
  });

  it("keeps currentPrizeId when the last prize completes", async () => {
    const token = await login();
    await seedThreePrizes(token);
    const jia = await addNamed("甲");
    const yi = await addNamed("乙");
    const bing = await addNamed("丙");
    expect(yi.id).toBeTruthy();
    expect(bing.id).toBeTruthy();
    await request(app).put("/api/session/current-prize").send({ prizeId: "p3" });
    const drawn = await request(app).post("/api/draw").send({ participantId: jia.id });
    expect(drawn.status).toBe(200);
    expect(drawn.body.prizeComplete).toBe(true);
    expect(drawn.body.currentPrizeId).toBe("p3");
    const session = await request(app).get("/api/session");
    expect(session.body.currentPrizeId).toBe("p3");
  });

  it("does not change currentPrizeId when the prize is not yet complete", async () => {
    const token = await login();
    await request(app)
      .put("/api/prizes")
      .set("Authorization", `Bearer ${token}`)
      .send([
        { id: "p1", name: "一", imagePath: "a.png", order: 0, quantity: 3 },
        { id: "p2", name: "二", imagePath: "b.png", order: 1, quantity: 1 },
      ]);
    const jia = await addNamed("甲");
    const yi = await addNamed("乙");
    const bing = await addNamed("丙");
    expect(yi.id).toBeTruthy();
    expect(bing.id).toBeTruthy();
    await request(app).put("/api/session/current-prize").send({ prizeId: "p1" });
    const drawn = await request(app).post("/api/draw").send({ participantId: jia.id });
    expect(drawn.status).toBe(200);
    expect(drawn.body.prizeComplete).toBe(false);
    expect(drawn.body.currentPrizeId).toBe("p1");
    const session = await request(app).get("/api/session");
    expect(session.body.currentPrizeId).toBe("p1");
  });

  it("does not auto-advance when selecting a completed prize", async () => {
    const token = await login();
    await seedThreePrizes(token);
    const jia = await addNamed("甲");
    const yi = await addNamed("乙");
    expect(yi.id).toBeTruthy();
    await request(app).put("/api/session/current-prize").send({ prizeId: "p1" });
    const drawn = await request(app).post("/api/draw").send({ participantId: jia.id });
    expect(drawn.body.currentPrizeId).toBe("p2");
    await request(app).put("/api/session/current-prize").send({ prizeId: "p1" });
    const session = await request(app).get("/api/session");
    expect(session.body.currentPrizeId).toBe("p1");
  });
});
