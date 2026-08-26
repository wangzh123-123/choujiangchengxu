import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import request from "supertest";
import { createApp } from "../src/index.js";
import { createStores } from "../src/store/appStores.js";

describe("setup prizes API", () => {
  let dataDir = "";
  let catalogDir = "";
  let app: ReturnType<typeof createApp>;

  beforeEach(async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "lottery-setup-"));
    dataDir = path.join(root, "data");
    catalogDir = path.join(root, "catalog");
    await mkdir(path.join(dataDir, "uploads"), { recursive: true });
    await mkdir(path.join(catalogDir, "uploads"), { recursive: true });
    await writeFile(
      path.join(dataDir, "config.json"),
      JSON.stringify({ adminPassphrase: "admin123" }, null, 2),
    );
    delete process.env.LOTTERY_PRIZE_SETUP;
    app = createApp({ stores: createStores(dataDir), catalogDir });
  });

  afterEach(() => {
    delete process.env.LOTTERY_PRIZE_SETUP;
  });

  it("returns 404 when setup flag is off", async () => {
    const get = await request(app).get("/api/setup/prizes");
    expect(get.status).toBe(404);
    expect(get.body.message).toBe("仅本地配奖可用");
    const put = await request(app).put("/api/setup/prizes").send([]);
    expect(put.status).toBe(404);
    expect(put.body.message).toBe("仅本地配奖可用");
  });

  it("GET reads catalog and PUT writes catalog then runtime", async () => {
    process.env.LOTTERY_PRIZE_SETUP = "1";
    app = createApp({ stores: createStores(dataDir), catalogDir });
    const empty = await request(app).get("/api/setup/prizes");
    expect(empty.status).toBe(200);
    expect(empty.body).toEqual([]);

    const body = [{ id: "p1", name: "一等奖", imagePath: "a.png", order: 0, quantity: 2 }];
    const put = await request(app).put("/api/setup/prizes").send(body);
    expect(put.status).toBe(200);
    const catalog = JSON.parse(await readFile(path.join(catalogDir, "prizes.json"), "utf8"));
    expect(catalog[0].name).toBe("一等奖");
    const runtime = JSON.parse(await readFile(path.join(dataDir, "prizes.json"), "utf8"));
    expect(runtime[0].id).toBe("p1");
  });

  it("PUT allows quantity below already-drawn count", async () => {
    process.env.LOTTERY_PRIZE_SETUP = "1";
    const stores = createStores(dataDir);
    await stores.winners.write([
      { prizeId: "p1", participantId: "u1", at: "t" },
      { prizeId: "p1", participantId: "u2", at: "t" },
    ]);
    app = createApp({ stores, catalogDir });
    const put = await request(app)
      .put("/api/setup/prizes")
      .send([{ id: "p1", name: "一", imagePath: "a.png", order: 0, quantity: 1 }]);
    expect(put.status).toBe(200);
  });

  it("PUT rejects invalid prize", async () => {
    process.env.LOTTERY_PRIZE_SETUP = "1";
    app = createApp({ stores: createStores(dataDir), catalogDir });
    const res = await request(app)
      .put("/api/setup/prizes")
      .send([{ id: "p1", name: "", imagePath: "a.png", order: 0, quantity: 1 }]);
    expect(res.status).toBe(400);
    expect(res.body.message).toBe("奖品缺少 name 或 imagePath");
  });
});
