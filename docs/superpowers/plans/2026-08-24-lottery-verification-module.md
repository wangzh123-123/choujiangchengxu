# 抽奖验证测试模块 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新增服务端 Vitest 验证模块：造 100 个不重名参与者，覆盖开奖、硬内定、改名与删除等边界，且不改产品逻辑。

**Architecture:** 只加测试。`hundredNames()` 生成 `用户001`…`用户100`；`lottery.verification.test.ts` 用临时数据目录 + supertest 打现有 HTTP API。每个 `it` 独立搭环境。现有测试文件不动。

**Tech Stack:** Express、Vitest、supertest、Node `fs/promises`（均已在 `server/`）

## Global Constraints

- 禁止修改 `server/src/**`、`client/**`、仓库 `data/*.json`。
- 不新增 npm 依赖。
- 内定按当前实现：已中奖者仍可被内定并再中。
- 无内定开奖不断言具体是哪一个人，只断言结果合法（避免随机抖动）。
- 错误文案与当前 API 对齐，不改产品文案。
- 临时目录隔离；`afterEach` 删除 `LOTTERY_DATA_DIR` 并 `clearSessionsForTests()`。
- 验证用例应对现有实现为绿。若红：先改测试断言。未经用户批准不得改产品代码。
- 实现前对照 `docs/superpowers/specs/2026-08-24-lottery-verification-module-design.md`。

---

## File Map

| 文件 | 职责 |
|------|------|
| `server/tests/helpers/hundredNames.ts` | 返回正好 100 个互不重复姓名 |
| `server/tests/helpers/hundredNames.test.ts` | 辅助函数单测 |
| `server/tests/lottery.verification.test.ts` | 验证模块：造人、开奖、内定、名单边界 |

不修改其它文件。不改 README。

---

### Task 1: 100 人姓名辅助函数

**Files:**
- Create: `server/tests/helpers/hundredNames.test.ts`
- Create: `server/tests/helpers/hundredNames.ts`

**Interfaces:**
- Consumes: 无
- Produces: `export function hundredNames(): string[]` — 长度 100，值为 `用户001` … `用户100`（三位补零），互不重复

- [ ] **Step 1: Write the failing test**

Create `server/tests/helpers/hundredNames.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { hundredNames } from "./hundredNames.js";

describe("hundredNames", () => {
  it("returns 100 unique padded names", () => {
    const names = hundredNames();
    expect(names).toHaveLength(100);
    expect(names[0]).toBe("用户001");
    expect(names[9]).toBe("用户010");
    expect(names[99]).toBe("用户100");
    expect(new Set(names).size).toBe(100);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run from repo root:

```bash
npm run test --prefix server -- tests/helpers/hundredNames.test.ts
```

Expected: FAIL — cannot find module `./hundredNames.js`（或 `hundredNames` is not exported）。

- [ ] **Step 3: Write minimal implementation**

Create `server/tests/helpers/hundredNames.ts`:

```typescript
export function hundredNames(): string[] {
  return Array.from({ length: 100 }, (_, i) => `用户${String(i + 1).padStart(3, "0")}`);
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm run test --prefix server -- tests/helpers/hundredNames.test.ts
```

Expected: PASS，1 test。

- [ ] **Step 5: Commit**

```bash
git add server/tests/helpers/hundredNames.ts server/tests/helpers/hundredNames.test.ts
git commit -m "test: add hundredNames helper for verification suite"
```

---

### Task 2: 验证夹具与造 100 人

**Files:**
- Create: `server/tests/lottery.verification.test.ts`

**Interfaces:**
- Consumes: `hundredNames(): string[]`；`createApp`；`createStores`；`clearSessionsForTests`
- Produces: 本文件内辅助（后续 Task 原样调用，不要改名）：
  - `type App = ReturnType<typeof createApp>`
  - `type Person = { id: string; name: string }`
  - `type PrizeBody = { id: string; name: string; imagePath: string; order: number }`
  - `async function makeDataDir(): Promise<string>`
  - `async function login(app: App): Promise<string>`
  - `async function seed100(app: App): Promise<Person[]>`
  - `function byName(people: Person[], name: string): Person`
  - `async function putPrizes(app: App, token: string, prizes: PrizeBody[]): Promise<void>`
  - `async function setCurrentPrize(app: App, prizeId: string): Promise<void>`
  - 默认奖品：`{ id: "p1", name: "一等奖", imagePath: "a.png", order: 0 }` 与 `{ id: "p2", name: "二等奖", imagePath: "b.png", order: 1 }`

- [ ] **Step 1: Write the harness and seed test**

Create `server/tests/lottery.verification.test.ts` with exactly this content (later tasks only append `describe` blocks inside the outer `describe`):

```typescript
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
```

- [ ] **Step 2: Run test to verify it passes**

```bash
npm run test --prefix server -- tests/lottery.verification.test.ts
```

Expected: PASS。产品已支持按姓名添加。若 FAIL，检查是否误改了 `server/src`，或 `POST /api/participants` 是否仍返回 `201` 与 `{ id, name }`。

- [ ] **Step 3: Commit**

```bash
git add server/tests/lottery.verification.test.ts
git commit -m "test: seed 100 unique participants in verification suite"
```

---

### Task 3: 无内定开奖与有内定必中

**Files:**
- Modify: `server/tests/lottery.verification.test.ts`（在 `describe("seed 100 participants")` 之后、最外层 `describe` 结束之前插入下面两个 `describe`）

**Interfaces:**
- Consumes: Task 2 的 `app`、`login`、`seed100`、`byName`、`putPrizes`、`setCurrentPrize`、`PRIZE_1`、`PRIZE_2`
- Produces: 无新导出

- [ ] **Step 1: Append draw tests**

Insert:

```typescript
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
```

- [ ] **Step 2: Run tests to verify they pass**

```bash
npm run test --prefix server -- tests/lottery.verification.test.ts
```

Expected: PASS（含 Task 2 的造人用例）。若「已中奖再内定」失败，不要改 `draw.ts` / `presets.ts`；规格要求锁当前「内定优先」行为。

- [ ] **Step 3: Commit**

```bash
git add server/tests/lottery.verification.test.ts
git commit -m "test: verify random draw and hard preset among 100 people"
```

---

### Task 4: 开奖与内定边界

**Files:**
- Modify: `server/tests/lottery.verification.test.ts`（在 `describe("draw with preset")` 之后插入）

**Interfaces:**
- Consumes: Task 2 辅助函数与 `PRIZE_1`
- Produces: 无新导出

- [ ] **Step 1: Append edge-case draw tests**

Insert:

```typescript
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
```

- [ ] **Step 2: Run tests to verify they pass**

```bash
npm run test --prefix server -- tests/lottery.verification.test.ts
```

Expected: PASS。

- [ ] **Step 3: Commit**

```bash
git add server/tests/lottery.verification.test.ts
git commit -m "test: cover draw and preset rejection paths"
```

---

### Task 5: 100 人池上的添加、改名、删除

**Files:**
- Modify: `server/tests/lottery.verification.test.ts`（在 `describe("draw and preset edge cases")` 之后、最外层 `describe` 的 `});` 之前插入）

**Interfaces:**
- Consumes: Task 2 辅助函数与 `PRIZE_1`
- Produces: 无新导出

- [ ] **Step 1: Append roster tests**

Insert:

```typescript
  describe("roster add rename delete", () => {
    it("rejects empty or whitespace add without changing the 100", async () => {
      await seed100(app);
      const empty = await request(app).post("/api/participants").send({ name: "" });
      expect(empty.status).toBe(400);
      const spaces = await request(app).post("/api/participants").send({ name: "  " });
      expect(spaces.status).toBe(400);
      const listed = await request(app).get("/api/participants");
      expect(listed.body).toHaveLength(100);
    });

    it("rejects duplicate name among the 100", async () => {
      await seed100(app);
      const res = await request(app).post("/api/participants").send({ name: "用户001" });
      expect(res.status).toBe(409);
      expect(String(res.body.message)).toBe("名称重复，请重新输入");
    });

    it("appends a new unique name as the 101st", async () => {
      await seed100(app);
      const res = await request(app).post("/api/participants").send({ name: "用户101" });
      expect(res.status).toBe(201);
      expect(res.body.name).toBe("用户101");
      const listed = await request(app).get("/api/participants");
      expect(listed.body).toHaveLength(101);
    });

    it("renames a participant and keeps the same id", async () => {
      const people = await seed100(app);
      const first = byName(people, "用户001");
      const res = await request(app)
        .patch(`/api/participants/${first.id}`)
        .send({ name: "用户001改" });
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(first.id);
      expect(res.body.name).toBe("用户001改");
      const listed = await request(app).get("/api/participants");
      const names = (listed.body as Person[]).map((p) => p.name);
      expect(names).toContain("用户001改");
      expect(names).not.toContain("用户001");
    });

    it("allows rename to the current name", async () => {
      const people = await seed100(app);
      const first = byName(people, "用户001");
      const res = await request(app)
        .patch(`/api/participants/${first.id}`)
        .send({ name: "用户001" });
      expect(res.status).toBe(200);
      expect(res.body.name).toBe("用户001");
    });

    it("rejects rename to another existing name", async () => {
      const people = await seed100(app);
      const first = byName(people, "用户001");
      const res = await request(app)
        .patch(`/api/participants/${first.id}`)
        .send({ name: "用户002" });
      expect(res.status).toBe(409);
      expect(String(res.body.message)).toBe("名称重复，请重新输入");
      const listed = await request(app).get("/api/participants");
      const names = (listed.body as Person[]).map((p) => p.name);
      expect(names).toContain("用户001");
    });

    it("returns 404 when renaming a missing id", async () => {
      await seed100(app);
      const res = await request(app).patch("/api/participants/missing").send({ name: "甲" });
      expect(res.status).toBe(404);
    });

    it("rejects empty rename", async () => {
      const people = await seed100(app);
      const first = byName(people, "用户001");
      const res = await request(app).patch(`/api/participants/${first.id}`).send({ name: "  " });
      expect(res.status).toBe(400);
    });

    it("allows renaming a winner and shows the new name on public view", async () => {
      const token = await login(app);
      const people = await seed100(app);
      const target = byName(people, "用户050");
      await putPrizes(app, token, [PRIZE_1]);
      await setCurrentPrize(app, "p1");
      await request(app)
        .put("/api/presets/p1")
        .set("Authorization", `Bearer ${token}`)
        .send({ participantId: target.id });
      const draw = await request(app).post("/api/draw");
      expect(draw.status).toBe(200);

      const renamed = await request(app)
        .patch(`/api/participants/${target.id}`)
        .send({ name: "用户050改" });
      expect(renamed.status).toBe(200);

      const view = await request(app).get("/api/public/view");
      expect(view.status).toBe(200);
      expect(view.body.lastWinner.id).toBe(target.id);
      expect(view.body.lastWinner.name).toBe("用户050改");
      const winners = await request(app).get("/api/winners");
      expect(winners.body[0].participantId).toBe(target.id);
    });

    it("draws the preset id after that person was renamed", async () => {
      const token = await login(app);
      const people = await seed100(app);
      const target = byName(people, "用户050");
      await putPrizes(app, token, [PRIZE_1]);
      await setCurrentPrize(app, "p1");
      await request(app)
        .put("/api/presets/p1")
        .set("Authorization", `Bearer ${token}`)
        .send({ participantId: target.id });
      const renamed = await request(app)
        .patch(`/api/participants/${target.id}`)
        .send({ name: "用户050新" });
      expect(renamed.status).toBe(200);

      const draw = await request(app).post("/api/draw");
      expect(draw.status).toBe(200);
      expect(draw.body.participantId).toBe(target.id);
      expect(draw.body.name).toBe("用户050新");
    });

    it("deletes a non-winner and drops them from the eligible pool", async () => {
      const people = await seed100(app);
      const first = byName(people, "用户001");
      const res = await request(app).delete(`/api/participants/${first.id}`);
      expect(res.status).toBe(204);
      const listed = await request(app).get("/api/participants");
      expect(listed.body).toHaveLength(99);
      const eligible = await request(app).get("/api/eligible");
      expect((eligible.body as Person[]).map((p) => p.id)).not.toContain(first.id);
    });

    it("clears preset when the preset person is deleted then draws someone else", async () => {
      const token = await login(app);
      const people = await seed100(app);
      const target = byName(people, "用户050");
      await putPrizes(app, token, [PRIZE_1]);
      await setCurrentPrize(app, "p1");
      await request(app)
        .put("/api/presets/p1")
        .set("Authorization", `Bearer ${token}`)
        .send({ participantId: target.id });
      const deleted = await request(app).delete(`/api/participants/${target.id}`);
      expect(deleted.status).toBe(204);
      const presets = await request(app)
        .get("/api/presets")
        .set("Authorization", `Bearer ${token}`);
      expect(presets.body).toEqual({});

      const draw = await request(app).post("/api/draw");
      expect(draw.status).toBe(200);
      expect(draw.body.participantId).not.toBe(target.id);
    });

    it("refuses to delete a winner", async () => {
      const token = await login(app);
      const people = await seed100(app);
      const target = byName(people, "用户050");
      await putPrizes(app, token, [PRIZE_1]);
      await setCurrentPrize(app, "p1");
      await request(app)
        .put("/api/presets/p1")
        .set("Authorization", `Bearer ${token}`)
        .send({ participantId: target.id });
      const draw = await request(app).post("/api/draw");
      expect(draw.status).toBe(200);

      const res = await request(app).delete(`/api/participants/${target.id}`);
      expect(res.status).toBe(409);
      expect(String(res.body.message)).toBe("已中奖用户不能删除");
      const listed = await request(app).get("/api/participants");
      expect(listed.body).toHaveLength(100);
    });

    it("returns 404 when deleting a missing id", async () => {
      await seed100(app);
      const res = await request(app).delete("/api/participants/missing");
      expect(res.status).toBe(404);
    });

    it("clears all participants and presets with admin auth", async () => {
      const token = await login(app);
      const people = await seed100(app);
      await putPrizes(app, token, [PRIZE_1]);
      await request(app)
        .put("/api/presets/p1")
        .set("Authorization", `Bearer ${token}`)
        .send({ participantId: people[0]!.id });
      const res = await request(app)
        .delete("/api/participants")
        .set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(204);
      expect((await request(app).get("/api/participants")).body).toEqual([]);
      expect(
        (await request(app).get("/api/presets").set("Authorization", `Bearer ${token}`)).body,
      ).toEqual({});
    });
  });
```

- [ ] **Step 2: Run the verification file**

```bash
npm run test --prefix server -- tests/lottery.verification.test.ts
```

Expected: PASS。

- [ ] **Step 3: Run the full server suite**

```bash
npm run test --prefix server
```

Expected: 全部 PASS，包括原有测试与本模块。`git diff -- server/src` 应为空。

- [ ] **Step 4: Commit**

```bash
git add server/tests/lottery.verification.test.ts
git commit -m "test: verify rename and delete edges on a 100-person pool"
```

---

## Self-Review (plan vs spec)

| 规格 | 任务 |
|------|------|
| `hundredNames.ts` + 100 个补零名 | Task 1 |
| 临时目录、不碰 `data/`、夹具函数 | Task 2 |
| 造齐 100 人、无重名 | Task 2 |
| 无内定：合法中奖、移出可抽池、奖品不可再抽 | Task 3 |
| 有内定：用户050 必中；已中奖可再内定再中 | Task 3 |
| 未选奖 / 奖被删 / 空池 / 内定 404 / 取消内定后再抽 | Task 4 |
| 添加空名、重名、用户101；改名/原名/冲突/404/空名；中奖改名公示；先内定再改名；删未中奖；删内定人；删已中奖；删缺失；清空全部 | Task 5 |
| 不改 `server/src`、不加依赖、不测前端/统计/动画 | Global Constraints |
| 全量 `npm run test --prefix server` | Task 5 Step 3 |
