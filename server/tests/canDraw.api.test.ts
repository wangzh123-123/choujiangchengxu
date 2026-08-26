import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import request from "supertest";
import { createApp } from "../src/index.js";
import { createStores } from "../src/store/appStores.js";
import { clearSessionsForTests } from "../src/auth/adminAuth.js";

const PRESET_LEAK_KEYS = ["presets", "presetSlots", "presetIds", "presetParticipantIds", "slots"];

describe("public view canDraw", () => {
  let dataDir = "";
  let app: ReturnType<typeof createApp>;

  beforeEach(async () => {
    clearSessionsForTests();
    dataDir = await mkdtemp(path.join(os.tmpdir(), "lottery-candraw-"));
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

  function expectNoPresetLeak(body: Record<string, unknown>) {
    for (const key of PRESET_LEAK_KEYS) {
      expect(body).not.toHaveProperty(key);
    }
    expect(Object.keys(body).some((k) => k.toLowerCase().includes("preset"))).toBe(false);
    const currentPrize = body.currentPrize as Record<string, unknown> | null;
    if (currentPrize) {
      expect(currentPrize).not.toHaveProperty("slots");
      expect(currentPrize).not.toHaveProperty("presets");
      expect(currentPrize).not.toHaveProperty("preset");
    }
  }

  it("canDraw is true when eligible is empty but the current slot is preset", async () => {
    const token = await login();
    const jia = await addNamed("甲");
    const yi = await addNamed("乙");
    await request(app)
      .put("/api/prizes")
      .set("Authorization", `Bearer ${token}`)
      .send([
        { id: "prize-other", name: "其他奖", imagePath: "o.png", order: 0, quantity: 1 },
        { id: "prize-current", name: "当前奖", imagePath: "c.png", order: 1, quantity: 1 },
      ]);
    await request(app)
      .put("/api/presets/prize-other")
      .set("Authorization", `Bearer ${token}`)
      .send({ slots: [jia.id] });
    await request(app).put("/api/session/current-prize").send({ prizeId: "prize-other" });
    const drawn = await request(app).post("/api/draw");
    expect(drawn.status).toBe(200);
    expect(drawn.body.participantId).toBe(jia.id);

    const removed = await request(app).delete(`/api/participants/${yi.id}`);
    expect(removed.status).toBe(204);

    await request(app)
      .put("/api/presets/prize-current")
      .set("Authorization", `Bearer ${token}`)
      .send({ slots: [jia.id] });
    await request(app).put("/api/session/current-prize").send({ prizeId: "prize-current" });

    const view = await request(app).get("/api/public/view");
    expect(view.status).toBe(200);
    expect(view.body.eligible).toEqual([]);
    expect(view.body.canDraw).toBe(true);
    expectNoPresetLeak(view.body as Record<string, unknown>);
  });

  it("canDraw is false when the current prize is complete", async () => {
    const token = await login();
    await addNamed("甲");
    await request(app)
      .put("/api/prizes")
      .set("Authorization", `Bearer ${token}`)
      .send([{ id: "p1", name: "A", imagePath: "a.png", order: 0, quantity: 1 }]);
    await request(app).put("/api/session/current-prize").send({ prizeId: "p1" });
    const drawn = await request(app).post("/api/draw");
    expect(drawn.status).toBe(200);

    const view = await request(app).get("/api/public/view");
    expect(view.status).toBe(200);
    expect(view.body.canDraw).toBe(false);
    expectNoPresetLeak(view.body as Record<string, unknown>);
  });

  it("canDraw is false when there is no current prize", async () => {
    const view = await request(app).get("/api/public/view");
    expect(view.status).toBe(200);
    expect(view.body.currentPrize).toBeNull();
    expect(view.body.canDraw).toBe(false);
    expectNoPresetLeak(view.body as Record<string, unknown>);
  });
});
