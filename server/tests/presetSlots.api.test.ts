import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import request from "supertest";
import { createApp } from "../src/index.js";
import { createStores } from "../src/store/appStores.js";
import { clearSessionsForTests } from "../src/auth/adminAuth.js";

describe("preset slots API", () => {
  let dataDir = "";
  let app: ReturnType<typeof createApp>;

  beforeEach(async () => {
    clearSessionsForTests();
    dataDir = await mkdtemp(path.join(os.tmpdir(), "lottery-slots-"));
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

  it("PUT rejects slots length that does not match prize quantity", async () => {
    const token = await login();
    await request(app)
      .put("/api/prizes")
      .set("Authorization", `Bearer ${token}`)
      .send([{ id: "p1", name: "A", imagePath: "a.png", order: 0, quantity: 1 }]);
    const u1 = await addNamed("甲");
    const u2 = await addNamed("乙");
    const res = await request(app)
      .put("/api/presets/p1")
      .set("Authorization", `Bearer ${token}`)
      .send({ slots: [u1.id, u2.id] });
    expect(res.status).toBe(400);
    expect(String(res.body.message)).toBe("内定槽数量必须与奖品数量一致");
  });

  it("PUT rejects duplicate non-empty ids on the same prize", async () => {
    const token = await login();
    await request(app)
      .put("/api/prizes")
      .set("Authorization", `Bearer ${token}`)
      .send([{ id: "p1", name: "A", imagePath: "a.png", order: 0, quantity: 2 }]);
    const u1 = await addNamed("甲");
    const res = await request(app)
      .put("/api/presets/p1")
      .set("Authorization", `Bearer ${token}`)
      .send({ slots: [u1.id, u1.id] });
    expect(res.status).toBe(400);
    expect(String(res.body.message)).toBe("同一奖品不能重复内定同一人");
  });

  it("PUT treats empty string as null and returns slots", async () => {
    const token = await login();
    await request(app)
      .put("/api/prizes")
      .set("Authorization", `Bearer ${token}`)
      .send([{ id: "p1", name: "A", imagePath: "a.png", order: 0, quantity: 2 }]);
    const u1 = await addNamed("甲");
    const res = await request(app)
      .put("/api/presets/p1")
      .set("Authorization", `Bearer ${token}`)
      .send({ slots: [u1.id, ""] });
    expect(res.status).toBe(200);
    expect(res.body.slots).toEqual([u1.id, null]);
  });

  it("GET normalizes a legacy string preset to an array of prize quantity", async () => {
    const token = await login();
    await request(app)
      .put("/api/prizes")
      .set("Authorization", `Bearer ${token}`)
      .send([{ id: "p1", name: "A", imagePath: "a.png", order: 0, quantity: 3 }]);
    const u1 = await addNamed("甲");
    const stores = createStores(dataDir);
    await stores.presets.write({ p1: u1.id as never });
    const res = await request(app).get("/api/presets").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ p1: [u1.id, null, null] });
  });

  it("DELETE participant clears that person from slots and drops all-null prizes", async () => {
    const token = await login();
    await request(app)
      .put("/api/prizes")
      .set("Authorization", `Bearer ${token}`)
      .send([{ id: "p1", name: "A", imagePath: "a.png", order: 0, quantity: 2 }]);
    const u1 = await addNamed("甲");
    const u2 = await addNamed("乙");
    const put = await request(app)
      .put("/api/presets/p1")
      .set("Authorization", `Bearer ${token}`)
      .send({ slots: [u1.id, u2.id] });
    expect(put.status).toBe(200);

    const del1 = await request(app).delete(`/api/participants/${u1.id}`);
    expect(del1.status).toBe(204);
    const afterFirst = await request(app)
      .get("/api/presets")
      .set("Authorization", `Bearer ${token}`);
    expect(afterFirst.body).toEqual({ p1: [null, u2.id] });

    const del2 = await request(app).delete(`/api/participants/${u2.id}`);
    expect(del2.status).toBe(204);
    const afterSecond = await request(app)
      .get("/api/presets")
      .set("Authorization", `Bearer ${token}`);
    expect(afterSecond.body).toEqual({});
  });
});
