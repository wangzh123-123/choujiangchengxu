import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import request from "supertest";
import { createApp } from "../src/index.js";
import { createStores } from "../src/store/appStores.js";
import { clearSessionsForTests } from "../src/auth/adminAuth.js";
import { hundredNames } from "./helpers/hundredNames.js";

type App = ReturnType<typeof createApp>;
type Person = { id: string; name: string };
type PrizeBody = { id: string; name: string; imagePath: string; order: number };

const PRIZE_1: PrizeBody = { id: "p1", name: "一等奖", imagePath: "a.png", order: 0 };
const PRIZE_2: PrizeBody = { id: "p2", name: "二等奖", imagePath: "b.png", order: 1 };

async function makeDataDir(): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "lottery-verify-"));
  await mkdir(path.join(dir, "uploads"), { recursive: true });
  await writeFile(
    path.join(dir, "config.json"),
    JSON.stringify({ adminPassphrase: "admin123" }, null, 2),
  );
  return dir;
}

async function login(app: App): Promise<string> {
  const res = await request(app).post("/api/admin/login").send({ passphrase: "admin123" });
  expect(res.status).toBe(200);
  return res.body.token as string;
}

async function seed100(app: App): Promise<Person[]> {
  const people: Person[] = [];
  for (const name of hundredNames()) {
    const res = await request(app).post("/api/participants").send({ name });
    expect(res.status).toBe(201);
    people.push(res.body as Person);
  }
  return people;
}

function byName(people: Person[], name: string): Person {
  const found = people.find((p) => p.name === name);
  expect(found).toBeDefined();
  return found as Person;
}

async function putPrizes(app: App, token: string, prizes: PrizeBody[]): Promise<void> {
  const res = await request(app)
    .put("/api/prizes")
    .set("Authorization", `Bearer ${token}`)
    .send(prizes);
  expect(res.status).toBe(200);
}

async function setCurrentPrize(app: App, prizeId: string): Promise<void> {
  const res = await request(app).put("/api/session/current-prize").send({ prizeId });
  expect(res.status).toBe(200);
}

describe("lottery verification", () => {
  let app: App;

  beforeEach(async () => {
    clearSessionsForTests();
    const dataDir = await makeDataDir();
    process.env.LOTTERY_DATA_DIR = dataDir;
    app = createApp({ stores: createStores(dataDir) });
  });

  afterEach(() => {
    delete process.env.LOTTERY_DATA_DIR;
    clearSessionsForTests();
  });

  describe("seed 100 participants", () => {
    it("creates 100 unique named participants", async () => {
      const people = await seed100(app);
      expect(people).toHaveLength(100);
      expect(people[0]?.name).toBe("用户001");
      expect(people[99]?.name).toBe("用户100");
      expect(new Set(people.map((p) => p.name)).size).toBe(100);
      expect(new Set(people.map((p) => p.id)).size).toBe(100);

      const listed = await request(app).get("/api/participants");
      expect(listed.status).toBe(200);
      expect(listed.body).toHaveLength(100);
    });
  });

  describe("draw without preset", () => {
    it("picks an eligible person from the 100 and excludes them afterward", async () => {
      const token = await login(app);
      const people = await seed100(app);
      const eligibleBefore = await request(app).get("/api/eligible");
      expect(eligibleBefore.status).toBe(200);
      expect(eligibleBefore.body).toHaveLength(100);
      const eligibleIds = (eligibleBefore.body as Person[]).map((p) => p.id);

      await putPrizes(app, token, [PRIZE_1]);
      await setCurrentPrize(app, "p1");

      const draw = await request(app).post("/api/draw");
      expect(draw.status).toBe(200);
      expect(eligibleIds).toContain(draw.body.participantId);
      expect(people.map((p) => p.name)).toContain(draw.body.name);
      expect(draw.body.prizeId).toBe("p1");

      const winners = await request(app).get("/api/winners");
      expect(winners.status).toBe(200);
      expect(winners.body).toHaveLength(1);
      expect(winners.body[0].prizeId).toBe("p1");
      expect(winners.body[0].participantId).toBe(draw.body.participantId);

      const eligibleAfter = await request(app).get("/api/eligible");
      expect(eligibleAfter.body).toHaveLength(99);
      expect((eligibleAfter.body as Person[]).map((p) => p.id)).not.toContain(
        draw.body.participantId,
      );

      const again = await request(app).post("/api/draw");
      expect(again.status).toBe(400);
      expect(String(again.body.message)).toBe("该奖品已开奖");
    });
  });

  describe("draw with preset", () => {
    it("always selects the preset person among 100", async () => {
      const token = await login(app);
      const people = await seed100(app);
      const target = byName(people, "用户050");
      await putPrizes(app, token, [PRIZE_1]);
      await setCurrentPrize(app, "p1");
      const preset = await request(app)
        .put("/api/presets/p1")
        .set("Authorization", `Bearer ${token}`)
        .send({ participantId: target.id });
      expect(preset.status).toBe(200);

      const draw = await request(app).post("/api/draw");
      expect(draw.status).toBe(200);
      expect(draw.body.participantId).toBe(target.id);
      expect(draw.body.name).toBe("用户050");
    });

    it("allows a prior winner to be preset and win again", async () => {
      const token = await login(app);
      const people = await seed100(app);
      const target = byName(people, "用户050");
      await putPrizes(app, token, [PRIZE_1, PRIZE_2]);
      await setCurrentPrize(app, "p1");
      await request(app)
        .put("/api/presets/p1")
        .set("Authorization", `Bearer ${token}`)
        .send({ participantId: target.id });
      const first = await request(app).post("/api/draw");
      expect(first.status).toBe(200);
      expect(first.body.participantId).toBe(target.id);

      const presetAgain = await request(app)
        .put("/api/presets/p2")
        .set("Authorization", `Bearer ${token}`)
        .send({ participantId: target.id });
      expect(presetAgain.status).toBe(200);
      await setCurrentPrize(app, "p2");
      const second = await request(app).post("/api/draw");
      expect(second.status).toBe(200);
      expect(second.body.participantId).toBe(target.id);
      expect(second.body.prizeId).toBe("p2");
    });
  });

  describe("draw and preset edge cases", () => {
    it("rejects draw when no current prize is selected", async () => {
      const token = await login(app);
      await seed100(app);
      await putPrizes(app, token, [PRIZE_1]);
      const res = await request(app).post("/api/draw");
      expect(res.status).toBe(400);
      expect(String(res.body.message)).toBe("未选择当前奖品，无法开奖");
    });

    it("rejects draw when current prize was removed from the catalog", async () => {
      const token = await login(app);
      await seed100(app);
      await putPrizes(app, token, [PRIZE_1]);
      await setCurrentPrize(app, "p1");
      await putPrizes(app, token, []);
      const res = await request(app).post("/api/draw");
      expect(res.status).toBe(400);
      expect(String(res.body.message)).toBe("当前奖品不存在");
    });

    it("rejects draw when eligible pool is empty and there is no preset", async () => {
      const token = await login(app);
      await putPrizes(app, token, [PRIZE_1]);
      await setCurrentPrize(app, "p1");
      const res = await request(app).post("/api/draw");
      expect(res.status).toBe(400);
      expect(String(res.body.message)).toBe("没有可抽奖用户");
    });

    it("rejects preset when prize does not exist", async () => {
      const token = await login(app);
      const people = await seed100(app);
      const res = await request(app)
        .put("/api/presets/missing-prize")
        .set("Authorization", `Bearer ${token}`)
        .send({ participantId: people[0]!.id });
      expect(res.status).toBe(404);
      expect(String(res.body.message)).toBe("奖品不存在");
    });

    it("rejects preset when participant does not exist", async () => {
      const token = await login(app);
      await putPrizes(app, token, [PRIZE_1]);
      const res = await request(app)
        .put("/api/presets/p1")
        .set("Authorization", `Bearer ${token}`)
        .send({ participantId: "missing-user" });
      expect(res.status).toBe(404);
      expect(String(res.body.message)).toBe("用户不存在");
    });

    it("draws from remaining pool after preset is cleared", async () => {
      const token = await login(app);
      const people = await seed100(app);
      const target = byName(people, "用户050");
      await putPrizes(app, token, [PRIZE_1]);
      await setCurrentPrize(app, "p1");
      await request(app)
        .put("/api/presets/p1")
        .set("Authorization", `Bearer ${token}`)
        .send({ participantId: target.id });
      const cleared = await request(app)
        .delete("/api/presets/p1")
        .set("Authorization", `Bearer ${token}`);
      expect(cleared.status).toBe(204);

      const draw = await request(app).post("/api/draw");
      expect(draw.status).toBe(200);
      expect(people.map((p) => p.id)).toContain(draw.body.participantId);
    });
  });
});
