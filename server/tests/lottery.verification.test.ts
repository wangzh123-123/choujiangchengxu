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
});
