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

  const PNG = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwADhAGftq4n1AAAAABJRU5ErkJggg==",
    "base64",
  );

  it("returns 404 when image upload flag is off", async () => {
    const res = await request(app).post("/api/setup/prizes/image").set("Content-Type", "image/png").send(PNG);
    expect(res.status).toBe(404);
    expect(res.body.message).toBe("仅本地配奖可用");
  });

  it("rejects empty or non-image", async () => {
    process.env.LOTTERY_PRIZE_SETUP = "1";
    app = createApp({ stores: createStores(dataDir), catalogDir });
    const empty = await request(app)
      .post("/api/setup/prizes/image")
      .set("Content-Type", "image/png")
      .send(Buffer.alloc(0));
    expect(empty.status).toBe(400);
    expect(empty.body.message).toBe("请上传图片");
    const text = await request(app)
      .post("/api/setup/prizes/image")
      .set("Content-Type", "text/plain")
      .set("X-Filename", "a.txt")
      .send(Buffer.from("hello"));
    expect(text.status).toBe(400);
    expect(text.body.message).toBe("请上传图片");
  });

  it("writes file and returns imagePath", async () => {
    process.env.LOTTERY_PRIZE_SETUP = "1";
    app = createApp({ stores: createStores(dataDir), catalogDir });
    const res = await request(app)
      .post("/api/setup/prizes/image")
      .set("Content-Type", "image/png")
      .set("X-Filename", "cat.png")
      .send(PNG);
    expect(res.status).toBe(200);
    expect(res.body.imagePath).toMatch(/\.png$/);
    const saved = path.join(catalogDir, "uploads", res.body.imagePath as string);
    expect((await readFile(saved)).equals(PNG)).toBe(true);
  });
});
