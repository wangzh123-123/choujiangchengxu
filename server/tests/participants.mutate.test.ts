import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, writeFile, mkdir, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import request from "supertest";
import { createApp } from "../src/index.js";
import { createStores } from "../src/store/appStores.js";
import { clearSessionsForTests } from "../src/auth/adminAuth.js";
import { parseParticipantsXml } from "../src/domain/participantXml.js";

async function makeDataDir(): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "lottery-part-"));
  await mkdir(path.join(dir, "uploads"), { recursive: true });
  await writeFile(
    path.join(dir, "config.json"),
    JSON.stringify({ adminPassphrase: "admin123" }, null, 2),
  );
  return dir;
}

async function xmlNames(dir: string): Promise<string[]> {
  const raw = await readFile(path.join(dir, "participants.xml"), "utf8");
  return parseParticipantsXml(raw);
}

describe("participant mutate APIs", () => {
  let app: ReturnType<typeof createApp>;
  let dataDir: string;

  beforeEach(async () => {
    clearSessionsForTests();
    dataDir = await makeDataDir();
    process.env.LOTTERY_DATA_DIR = dataDir;
    app = createApp({ stores: createStores(dataDir) });
  });

  afterEach(() => {
    delete process.env.LOTTERY_DATA_DIR;
    clearSessionsForTests();
  });

  async function login() {
    const res = await request(app).post("/api/admin/login").send({ passphrase: "admin123" });
    return res.body.token as string;
  }

  it("creates participant from name only and assigns uuid", async () => {
    const res = await request(app).post("/api/participants").send({ name: "张三", id: "custom" });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe("张三");
    expect(res.body.id).not.toBe("custom");
    expect(res.body.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
  });

  it("rejects empty name", async () => {
    const res = await request(app).post("/api/participants").send({ name: "  " });
    expect(res.status).toBe(400);
  });

  it("rejects duplicate name", async () => {
    await request(app).post("/api/participants").send({ name: "张三" });
    const res = await request(app).post("/api/participants").send({ name: "张三" });
    expect(res.status).toBe(409);
    expect(String(res.body.message)).toMatch(/名称重复，请重新输入/);
  });

  it("renames participant", async () => {
    const created = await request(app).post("/api/participants").send({ name: "甲" });
    const id = created.body.id as string;
    const res = await request(app).patch(`/api/participants/${id}`).send({ name: "甲改" });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe("甲改");
  });

  it("rename to same name succeeds", async () => {
    const created = await request(app).post("/api/participants").send({ name: "甲" });
    const res = await request(app)
      .patch(`/api/participants/${created.body.id}`)
      .send({ name: "甲" });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe("甲");
  });

  it("rename to another existing name fails", async () => {
    const a = await request(app).post("/api/participants").send({ name: "甲" });
    await request(app).post("/api/participants").send({ name: "乙" });
    const res = await request(app).patch(`/api/participants/${a.body.id}`).send({ name: "乙" });
    expect(res.status).toBe(409);
  });

  it("rename missing id is 404", async () => {
    const res = await request(app).patch("/api/participants/missing").send({ name: "甲" });
    expect(res.status).toBe(404);
  });

  it("allows renaming a winner", async () => {
    const token = await login();
    await request(app)
      .put("/api/prizes")
      .set("Authorization", `Bearer ${token}`)
      .send([{ id: "p1", name: "特等奖", imagePath: "a.png", order: 0, quantity: 1 }]);
    const a = await request(app).post("/api/participants").send({ name: "甲" });
    await request(app).post("/api/participants").send({ name: "乙" });
    await request(app).put("/api/session/current-prize").send({ prizeId: "p1" });
    await request(app).post("/api/draw").send({ participantId: a.body.id });
    const res = await request(app).patch(`/api/participants/${a.body.id}`).send({ name: "甲新" });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe("甲新");
  });

  it("deletes non-winner and clears their preset", async () => {
    const token = await login();
    await request(app)
      .put("/api/prizes")
      .set("Authorization", `Bearer ${token}`)
      .send([{ id: "p1", name: "特等奖", imagePath: "a.png", order: 0, quantity: 1 }]);
    const a = await request(app).post("/api/participants").send({ name: "甲" });
    await request(app)
      .put(`/api/presets/p1`)
      .set("Authorization", `Bearer ${token}`)
      .send({ slots: [a.body.id] });
    const res = await request(app).delete(`/api/participants/${a.body.id}`);
    expect(res.status).toBe(204);
    expect((await request(app).get("/api/participants")).body).toEqual([]);
    expect(
      (await request(app).get("/api/presets").set("Authorization", `Bearer ${token}`)).body,
    ).toEqual({});
  });

  it("refuses to delete a winner", async () => {
    const token = await login();
    await request(app)
      .put("/api/prizes")
      .set("Authorization", `Bearer ${token}`)
      .send([{ id: "p1", name: "特等奖", imagePath: "a.png", order: 0, quantity: 1 }]);
    const a = await request(app).post("/api/participants").send({ name: "甲" });
    await request(app).post("/api/participants").send({ name: "乙" });
    await request(app).put("/api/session/current-prize").send({ prizeId: "p1" });
    await request(app).post("/api/draw").send({ participantId: a.body.id });
    const winnerId = (await request(app).get("/api/public/view")).body.lastWinner.id as string;
    const res = await request(app).delete(`/api/participants/${winnerId}`);
    expect(res.status).toBe(409);
    expect(String(res.body.message)).toMatch(/已中奖用户不能删除/);
    expect(a.status).toBe(201);
  });

  it("delete missing id is 404", async () => {
    const res = await request(app).delete("/api/participants/missing");
    expect(res.status).toBe(404);
  });

  it("defaults publicScreen to enroll", async () => {
    const res = await request(app).get("/api/session");
    expect(res.body.publicScreen).toBe("enroll");
  });

  it("writes xml roster on add rename and delete", async () => {
    const a = await request(app).post("/api/participants").send({ name: "甲" });
    await request(app).post("/api/participants").send({ name: "乙" });
    expect(await xmlNames(dataDir)).toEqual(["甲", "乙"]);
    await request(app).patch(`/api/participants/${a.body.id}`).send({ name: "甲改" });
    expect(await xmlNames(dataDir)).toEqual(["甲改", "乙"]);
    await request(app).delete(`/api/participants/${a.body.id}`);
    expect(await xmlNames(dataDir)).toEqual(["乙"]);
  });

  it("does not write xml when add is rejected", async () => {
    const res = await request(app).post("/api/participants").send({ name: "  " });
    expect(res.status).toBe(400);
    await expect(readFile(path.join(dataDir, "participants.xml"), "utf8")).rejects.toMatchObject({
      code: "ENOENT",
    });
  });

  it("clears xml when admin deletes all participants", async () => {
    const token = await login();
    await request(app).post("/api/participants").send({ name: "甲" });
    expect(await xmlNames(dataDir)).toEqual(["甲"]);
    const res = await request(app)
      .delete("/api/participants")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(204);
    expect(await xmlNames(dataDir)).toEqual([]);
  });
});
