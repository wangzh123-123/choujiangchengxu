# 奖品种子入库与本地配奖命令 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 奖品清单以仓库 `catalog/` 为唯一正式来源；每次启动覆盖运行时奖品；现场 `/admin` 不再改奖；本地 `npm run setup:prizes` 打开配奖页，保存写入仓库文件且不自动提交。

**Architecture:** 新增 `catalog/prizes.json` 与 `catalog/uploads/`。启动时（未设 `LOTTERY_SKIP_PRIZE_SEED`）把种子拷到 `data/`。配奖走仅本机开关 `LOTTERY_PRIZE_SETUP=1` 的 `/api/setup/prizes` 与 `/setup/prizes` 页。图片用原始 body 上传，不引入 multipart 库。`PUT /api/prizes` 留给测试，后台 UI 不再调用。

**Tech Stack:** Vite + React（`client/`）、Express + TypeScript（`server/`）、Vitest、supertest、JSON 文件（`data/` + `catalog/`）

## Global Constraints

- 对照 `docs/superpowers/specs/2026-08-26-prize-catalog-seed-setup-design.md`；不扩大范围。
- 不改 `resolveWinner` / `listEligible`、姓名录入、四屏顺序、开始/停、内定规则。
- 不新加 npm 依赖。上传不用 multer/busboy；`express.raw` + `Content-Type: image/*`。
- 错误文案固定：「仅本地配奖可用」「请上传图片」；缺 name/imagePath 仍为「奖品缺少 name 或 imagePath」；quantity 非法与现有 `PUT /api/prizes` 一致。保存成功：「已写入仓库文件，未提交。大屏刷新即可看到」。端口占用：「请先关掉占用 5173/3001 的进程」。
- 不自动 git commit / push。不在 Render 上设置 `LOTTERY_PRIZE_SETUP`。
- 实现前用户规则：未经用户明确允许不要改代码；本计划获准执行后按任务改。接口用 `int32_t` 等 C++ 规则不适用于本 TS 仓库。

---

## File Map

| 文件 | 职责 |
|------|------|
| `server/src/store/paths.ts` | `resolveCatalogDir`、`getCatalogPaths` |
| `server/src/domain/prizeCatalog.ts` | `applyPrizeSeed`、`maybeApplyPrizeSeed`、`shouldApplyPrizeSeed`、`SETUP_UNAVAILABLE` |
| `server/src/domain/prizeValidate.ts` | `isValidPrize`（供奖品 PUT 与配奖 PUT 共用） |
| `server/src/routes/setupPrizes.ts` | `GET/PUT /api/setup/prizes`、图片 POST handler |
| `server/src/index.ts` | 启动时 `maybeApplyPrizeSeed`；先注册 raw 图片路由再 `express.json` |
| `server/vitest.config.ts` | 全局 `LOTTERY_SKIP_PRIZE_SEED=1` |
| `catalog/prizes.json` | Git 正式清单（由现有 `data/prizes.json` 拷入） |
| `catalog/uploads/` | Git 奖品图（至少 `prize-default.svg`） |
| `client/src/admin/SetupPrizesPage.tsx` | `/setup/prizes` 配奖页 |
| `client/src/App.tsx` | 增加配奖路由 |
| `client/src/admin/AdminPage.tsx` | 删除奖品配置块 |
| `scripts/setup-prizes.mjs` | 端口检查、带开关启动前后端、打开浏览器 |
| `package.json` | `setup:prizes` |
| `README.md` | 种子 + 命令说明 |

---

### Task 1: 种子拷贝纯函数

**Files:**
- Create: `server/src/domain/prizeCatalog.ts`
- Create: `server/tests/prizeCatalog.test.ts`
- Modify: `server/src/store/paths.ts`

**Interfaces:**
- Consumes: `JsonStore`、`createStores`、`normalizePrize`、`Prize`
- Produces:
  - `export function resolveCatalogDir(): string` — 相对 `paths.ts` 所在位置解析到仓库根下 `catalog/`，**不**读 `LOTTERY_DATA_DIR`
  - `export function getCatalogPaths(catalogDir?: string)` — `{ catalogDir, prizes, uploads }`
  - `export const SETUP_UNAVAILABLE = "仅本地配奖可用"`
  - `export function shouldApplyPrizeSeed(env?: NodeJS.ProcessEnv): boolean` — `env.LOTTERY_SKIP_PRIZE_SEED !== "1"`
  - `export async function applyPrizeSeed(catalogDir: string, dataDir: string): Promise<void>`
  - `export async function maybeApplyPrizeSeed(catalogDir: string, dataDir: string): Promise<void>`

- [ ] **Step 1: Write the failing test**

Create `server/tests/prizeCatalog.test.ts`:

```typescript
import { afterEach, describe, expect, it } from "vitest";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { mkdtemp } from "node:fs/promises";
import {
  applyPrizeSeed,
  maybeApplyPrizeSeed,
  shouldApplyPrizeSeed,
} from "../src/domain/prizeCatalog.js";

async function makeDirs() {
  const root = await mkdtemp(path.join(os.tmpdir(), "lottery-seed-"));
  const catalogDir = path.join(root, "catalog");
  const dataDir = path.join(root, "data");
  await mkdir(path.join(catalogDir, "uploads"), { recursive: true });
  await mkdir(path.join(dataDir, "uploads"), { recursive: true });
  return { catalogDir, dataDir };
}

describe("shouldApplyPrizeSeed", () => {
  it("is false only when LOTTERY_SKIP_PRIZE_SEED is 1", () => {
    expect(shouldApplyPrizeSeed({})).toBe(true);
    expect(shouldApplyPrizeSeed({ LOTTERY_SKIP_PRIZE_SEED: "0" })).toBe(true);
    expect(shouldApplyPrizeSeed({ LOTTERY_SKIP_PRIZE_SEED: "1" })).toBe(false);
  });
});
```

Continue the same file:

```typescript
describe("applyPrizeSeed", () => {
  it("overwrites data prizes and copies referenced images", async () => {
    const { catalogDir, dataDir } = await makeDirs();
    await writeFile(
      path.join(catalogDir, "prizes.json"),
      JSON.stringify([
        { id: "p2", name: "二", imagePath: "b.png", order: 2, quantity: 1 },
        { id: "p1", name: "一", imagePath: "a.png", order: 0, quantity: 3 },
      ]),
    );
    await writeFile(path.join(catalogDir, "uploads", "a.png"), "IMG-A");
    await writeFile(path.join(catalogDir, "uploads", "b.png"), "IMG-B");
    await writeFile(
      path.join(dataDir, "prizes.json"),
      JSON.stringify([{ id: "old", name: "旧", imagePath: "x", order: 0, quantity: 1 }]),
    );
    await writeFile(
      path.join(dataDir, "session.json"),
      JSON.stringify({
        currentPrizeId: "missing",
        publicScreen: "enroll",
        controlBarVisible: true,
        drawPhase: "idle",
        lastWinnerParticipantId: null,
        lastWinnerPrizeId: null,
      }),
    );
    const participants = [{ id: "u1", name: "甲" }];
    const presets = { p9: ["u1"] };
    const winners = [{ prizeId: "p9", participantId: "u1", at: "t" }];
    await writeFile(path.join(dataDir, "participants.json"), JSON.stringify(participants));
    await writeFile(path.join(dataDir, "presets.json"), JSON.stringify(presets));
    await writeFile(path.join(dataDir, "winners.json"), JSON.stringify(winners));

    await applyPrizeSeed(catalogDir, dataDir);

    const prizes = JSON.parse(await readFile(path.join(dataDir, "prizes.json"), "utf8")) as Array<{
      id: string;
    }>;
    expect(prizes.map((p) => p.id).sort()).toEqual(["p1", "p2"]);
    expect(await readFile(path.join(dataDir, "uploads", "a.png"), "utf8")).toBe("IMG-A");
    expect(JSON.parse(await readFile(path.join(dataDir, "session.json"), "utf8")).currentPrizeId).toBe(
      "p1",
    );
    expect(JSON.parse(await readFile(path.join(dataDir, "participants.json"), "utf8"))).toEqual(
      participants,
    );
    expect(JSON.parse(await readFile(path.join(dataDir, "presets.json"), "utf8"))).toEqual(presets);
    expect(JSON.parse(await readFile(path.join(dataDir, "winners.json"), "utf8"))).toEqual(winners);
  });

  it("keeps currentPrizeId when it still exists", async () => {
    const { catalogDir, dataDir } = await makeDirs();
    await writeFile(
      path.join(catalogDir, "prizes.json"),
      JSON.stringify([{ id: "p1", name: "一", imagePath: "a.png", order: 0, quantity: 1 }]),
    );
    await writeFile(
      path.join(dataDir, "session.json"),
      JSON.stringify({
        currentPrizeId: "p1",
        publicScreen: "prize",
        controlBarVisible: true,
        drawPhase: "idle",
        lastWinnerParticipantId: null,
        lastWinnerPrizeId: null,
      }),
    );
    await applyPrizeSeed(catalogDir, dataDir);
    expect(JSON.parse(await readFile(path.join(dataDir, "session.json"), "utf8")).currentPrizeId).toBe(
      "p1",
    );
  });

  it("sets currentPrizeId null when catalog is empty", async () => {
    const { catalogDir, dataDir } = await makeDirs();
    await writeFile(
      path.join(dataDir, "session.json"),
      JSON.stringify({
        currentPrizeId: "p1",
        publicScreen: "enroll",
        controlBarVisible: true,
        drawPhase: "idle",
        lastWinnerParticipantId: null,
        lastWinnerPrizeId: null,
      }),
    );
    await applyPrizeSeed(catalogDir, dataDir);
    const prizes = JSON.parse(await readFile(path.join(dataDir, "prizes.json"), "utf8"));
    expect(prizes).toEqual([]);
    expect(JSON.parse(await readFile(path.join(dataDir, "session.json"), "utf8")).currentPrizeId).toBe(
      null,
    );
  });
});

describe("maybeApplyPrizeSeed", () => {
  const prev = process.env.LOTTERY_SKIP_PRIZE_SEED;
  afterEach(() => {
    if (prev === undefined) delete process.env.LOTTERY_SKIP_PRIZE_SEED;
    else process.env.LOTTERY_SKIP_PRIZE_SEED = prev;
  });

  it("does not copy when skip is 1", async () => {
    const { catalogDir, dataDir } = await makeDirs();
    await writeFile(
      path.join(catalogDir, "prizes.json"),
      JSON.stringify([{ id: "p1", name: "一", imagePath: "a.png", order: 0, quantity: 1 }]),
    );
    await writeFile(
      path.join(dataDir, "prizes.json"),
      JSON.stringify([{ id: "keep", name: "留", imagePath: "x", order: 0, quantity: 1 }]),
    );
    process.env.LOTTERY_SKIP_PRIZE_SEED = "1";
    await maybeApplyPrizeSeed(catalogDir, dataDir);
    expect(JSON.parse(await readFile(path.join(dataDir, "prizes.json"), "utf8"))[0].id).toBe("keep");
  });
});
```

Remove unused `copyFile` import if you added it.

- [ ] **Step 2: Run test to verify it fails**

```bash
npm run test --prefix server -- tests/prizeCatalog.test.ts
```

Expected: FAIL — cannot find module `../src/domain/prizeCatalog.js`.

- [ ] **Step 3: Write minimal implementation**

Add to `server/src/store/paths.ts` (keep `resolveDataDir` / `getPaths` unchanged):

```typescript
/** Repo catalog directory (not LOTTERY_DATA_DIR). */
export function resolveCatalogDir(): string {
  return path.resolve(here, "../../../catalog");
}

export function getCatalogPaths(catalogDir = resolveCatalogDir()) {
  return {
    catalogDir,
    prizes: path.join(catalogDir, "prizes.json"),
    uploads: path.join(catalogDir, "uploads"),
  } as const;
}
```

Create `server/src/domain/prizeCatalog.ts`:

```typescript
import { copyFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { JsonStore } from "../store/jsonStore.js";
import { createStores } from "../store/appStores.js";
import { getCatalogPaths } from "../store/paths.js";
import { normalizePrize } from "./prizeQuantity.js";
import type { Prize } from "../types.js";

export const SETUP_UNAVAILABLE = "仅本地配奖可用";

export function shouldApplyPrizeSeed(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.LOTTERY_SKIP_PRIZE_SEED !== "1";
}

export async function applyPrizeSeed(catalogDir: string, dataDir: string): Promise<void> {
  const catalog = getCatalogPaths(catalogDir);
  const catalogStore = new JsonStore<Prize[]>(catalog.prizes, []);
  const prizes = (await catalogStore.read()).map((p) => normalizePrize(p));
  const stores = createStores(dataDir);
  await stores.prizes.write(prizes);
  await mkdir(stores.paths.uploads, { recursive: true });
  await mkdir(catalog.uploads, { recursive: true });
  for (const prize of prizes) {
    const name = path.basename(prize.imagePath);
    if (!name) continue;
    try {
      await copyFile(path.join(catalog.uploads, name), path.join(stores.paths.uploads, name));
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
    }
  }
  const session = await stores.session.read();
  const ids = new Set(prizes.map((p) => p.id));
  if (session.currentPrizeId && ids.has(session.currentPrizeId)) {
    return;
  }
  if (prizes.length === 0) {
    session.currentPrizeId = null;
  } else {
    const sorted = [...prizes].sort((a, b) => a.order - b.order);
    session.currentPrizeId = sorted[0]?.id ?? null;
  }
  await stores.session.write(session);
}

export async function maybeApplyPrizeSeed(catalogDir: string, dataDir: string): Promise<void> {
  if (!shouldApplyPrizeSeed()) return;
  await applyPrizeSeed(catalogDir, dataDir);
}
```

- [ ] **Step 4: Run tests and make sure they pass**

```bash
npm run test --prefix server -- tests/prizeCatalog.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/src/store/paths.ts server/src/domain/prizeCatalog.ts server/tests/prizeCatalog.test.ts
git commit -m "feat: copy prize catalog seed into runtime data dir"
```

---

### Task 2: 测试默认跳过种子；进程启动时拷贝

**Files:**
- Modify: `server/vitest.config.ts`
- Modify: `server/src/index.ts`
- Create: `catalog/prizes.json`
- Create: `catalog/uploads/prize-default.svg`（从 `data/uploads/prize-default.svg` 拷贝）
- Create: `catalog/uploads/.gitkeep`（若目录需要占位；有 svg 则可省略）

**Interfaces:**
- Consumes: `maybeApplyPrizeSeed`、`resolveCatalogDir`、`resolveDataDir`
- Produces: Vitest 全局 `LOTTERY_SKIP_PRIZE_SEED=1`；`tsx src/index.ts` 在 `listen` 前调用 `maybeApplyPrizeSeed(resolveCatalogDir(), resolveDataDir())`

- [ ] **Step 1: Write the failing test**

Existing tests already `PUT` into tmp dirs. After Task 1, they still pass only if skip is on **or** they never call `maybeApplyPrizeSeed`. This task adds global skip so a future mistake that applies seed against `LOTTERY_DATA_DIR` tmp dirs still will not read the real `catalog/`.

Add to `server/tests/prizeCatalog.test.ts` (or keep Task 1 skip test as the behavior test). No new assertion required beyond running the full server suite after config change.

- [ ] **Step 2: Set Vitest env (this is the “fail then fix” for accidental seed)**

`server/vitest.config.ts`:

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    env: {
      LOTTERY_SKIP_PRIZE_SEED: "1",
    },
  },
});
```

`prizeCatalog.test.ts` 里 `maybeApplyPrizeSeed` 的 skip 用例已经自己设 env；`applyPrizeSeed` 直调不受 skip 影响。

- [ ] **Step 3: Wire startup**

In `server/src/index.ts`, replace the `if (isDirectRun()) { ... listen ... }` block with:

```typescript
async function main(): Promise<void> {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const isProd = process.env.NODE_ENV === "production";
  const port = Number(process.env.PORT ?? 3001);
  const host = isProd ? (process.env.HOST ?? "0.0.0.0") : (process.env.HOST ?? "127.0.0.1");
  const clientDist = isProd ? path.resolve(here, "../../client/dist") : undefined;
  const { maybeApplyPrizeSeed } = await import("./domain/prizeCatalog.js");
  const { resolveCatalogDir, resolveDataDir } = await import("./store/paths.js");
  await maybeApplyPrizeSeed(resolveCatalogDir(), resolveDataDir());
  createApp({ clientDist }).listen(port, host, () => {
    console.log(`lottery-server listening on http://${host}:${port}`);
  });
}

if (isDirectRun()) {
  void main();
}
```

Prefer static imports at top of `index.ts` instead of dynamic import if that matches the file (add `import { maybeApplyPrizeSeed } from "./domain/prizeCatalog.js";` and `resolveCatalogDir` next to existing path imports).

Do **not** call seed inside `createApp`（测试里 `createApp` 保持同步、且靠 skip/不调用）。

- [ ] **Step 4: Create catalog seed files**

Copy current `data/prizes.json` to `catalog/prizes.json` (same JSON). Copy `data/uploads/prize-default.svg` to `catalog/uploads/prize-default.svg`. Do not copy unreferenced files such as `招财猫.png`.

- [ ] **Step 5: Run full server tests**

```bash
npm run test --prefix server
```

Expected: all existing tests PASS (85+ new prizeCatalog tests).

- [ ] **Step 6: Commit**

```bash
git add server/vitest.config.ts server/src/index.ts catalog/prizes.json catalog/uploads/prize-default.svg
git commit -m "feat: apply prize seed on server start; skip it in tests"
```

---

### Task 3: 抽出 isValidPrize；配奖 GET/PUT

**Files:**
- Create: `server/src/domain/prizeValidate.ts`
- Create: `server/src/routes/setupPrizes.ts`
- Create: `server/tests/setupPrizes.api.test.ts`
- Modify: `server/src/routes/prizes.ts`（改用 `isValidPrize`）
- Modify: `server/src/index.ts`（`CreateAppOptions.catalogDir`；挂载 setup 路由）

**Interfaces:**
- Consumes: `isValidPrize`、`applyPrizeSeed`、`SETUP_UNAVAILABLE`、`JsonStore`、`getCatalogPaths`
- Produces:
  - `export function isValidPrize(p: unknown): p is Prize`
  - `export function isPrizeSetupEnabled(env?: NodeJS.ProcessEnv): boolean` — `env.LOTTERY_PRIZE_SETUP === "1"`
  - `export function setupPrizesRouter(stores: AppStores, catalogDir: string): Router`
  - `createApp({ catalogDir?: string })`
  - `GET /api/setup/prizes`、`PUT /api/setup/prizes`

- [ ] **Step 1: Write the failing test**

Create `server/tests/setupPrizes.api.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm run test --prefix server -- tests/setupPrizes.api.test.ts
```

Expected: FAIL — 404/404 对未实现路由，或没有 `catalogDir`。

- [ ] **Step 3: Write minimal implementation**

Create `server/src/domain/prizeValidate.ts` with the same checks currently inline in `prizes.ts`:

```typescript
import type { Prize } from "../types.js";

export function isValidPrize(p: unknown): p is Prize {
  if (!p || typeof p !== "object") return false;
  const o = p as Prize;
  return (
    typeof o.id === "string" &&
    o.id.length > 0 &&
    typeof o.name === "string" &&
    o.name.trim().length > 0 &&
    typeof o.imagePath === "string" &&
    o.imagePath.length > 0 &&
    typeof o.order === "number" &&
    typeof o.quantity === "number" &&
    Number.isInteger(o.quantity) &&
    o.quantity >= 1
  );
}
```

Change `server/src/routes/prizes.ts` to `import { isValidPrize } from "../domain/prizeValidate.js";` and delete the local function.

Create `server/src/routes/setupPrizes.ts`:

```typescript
import { Router, type Request, type Response } from "express";
import { JsonStore } from "../store/jsonStore.js";
import { getCatalogPaths } from "../store/paths.js";
import { applyPrizeSeed, SETUP_UNAVAILABLE } from "../domain/prizeCatalog.js";
import { isValidPrize } from "../domain/prizeValidate.js";
import type { AppStores } from "../store/appStores.js";
import type { Prize } from "../types.js";

export function isPrizeSetupEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.LOTTERY_PRIZE_SETUP === "1";
}

function rejectIfDisabled(_req: Request, res: Response): boolean {
  if (isPrizeSetupEnabled()) return false;
  res.status(404).json({ message: SETUP_UNAVAILABLE });
  return true;
}

export function setupPrizesRouter(stores: AppStores, catalogDir: string): Router {
  const router = Router();
  const catalog = getCatalogPaths(catalogDir);
  const catalogStore = new JsonStore<Prize[]>(catalog.prizes, []);

  router.get("/api/setup/prizes", async (_req, res) => {
    if (rejectIfDisabled(_req, res)) return;
    res.json(await catalogStore.read());
  });

  router.put("/api/setup/prizes", async (req, res) => {
    if (rejectIfDisabled(req, res)) return;
    const body = req.body;
    if (!Array.isArray(body)) {
      res.status(400).json({ message: "奖品列表必须是数组" });
      return;
    }
    for (const item of body) {
      if (!isValidPrize(item)) {
        res.status(400).json({ message: "奖品缺少 name 或 imagePath" });
        return;
      }
    }
    await catalogStore.write(body);
    await applyPrizeSeed(catalogDir, stores.paths.dataDir);
    res.json(body);
  });

  return router;
}
```

`CreateAppOptions` 增加 `catalogDir?: string`。在 `createApp` 里 `const catalogDir = options.catalogDir ?? resolveCatalogDir();` 然后 `app.use(setupPrizesRouter(stores, catalogDir));`（图片路由在下一任务加）。

注意：`isPrizeSetupEnabled()` 在**请求时**读 `process.env`，不要在 `createApp` 时缓存。上面 404 用例先 `createApp` 再保持 flag 关闭即可。开启用例必须在 `createApp` **之前**设 env，或请求时再读 env（当前实现是请求时读，因此 beforeEach 里 create 之后再设 env 再请求也可以）。PUT 用例为清晰起见在 createApp 前设 env。

- [ ] **Step 4: Run tests**

```bash
npm run test --prefix server -- tests/setupPrizes.api.test.ts tests/prizeQuantity.api.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/src/domain/prizeValidate.ts server/src/routes/setupPrizes.ts server/src/routes/prizes.ts server/src/index.ts server/tests/setupPrizes.api.test.ts
git commit -m "feat: add local-only prize catalog GET and PUT"
```

---

### Task 4: 配奖图片上传

**Files:**
- Modify: `server/src/routes/setupPrizes.ts`
- Modify: `server/src/index.ts`
- Modify: `server/tests/setupPrizes.api.test.ts`

**Interfaces:**
- Consumes: `isPrizeSetupEnabled`、`SETUP_UNAVAILABLE`、`getCatalogPaths`
- Produces: `export function setupPrizeImageHandler(catalogDir: string): (req, res) => Promise<void>`
  - `POST /api/setup/prizes/image`
  - 成功 `{ imagePath: string }`
  - 空或非图片：400 `{ message: "请上传图片" }`
  - 未开开关：404 `{ message: "仅本地配奖可用" }`

最小 PNG（1×1）base64：`iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwADhAGftq4n1AAAAABJRU5ErkJggg==`

- [ ] **Step 1: Write the failing test**

Append to `server/tests/setupPrizes.api.test.ts`:

```typescript
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwADhAGftq4n1AAAAABJRU5ErkJggg==",
  "base64",
);

describe("setup prize image", () => {
  // same beforeEach pattern as above — either nest in the existing describe
  // using the same dataDir/catalogDir/app, or duplicate the tmp setup.

  it("returns 404 when flag is off", async () => {
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
```

Put these `it`s inside the existing `describe("setup prizes API")` so they share `app` / `catalogDir`.

- [ ] **Step 2: Run test to verify it fails**

```bash
npm run test --prefix server -- tests/setupPrizes.api.test.ts
```

Expected: FAIL — 404 或无法解析 body。

- [ ] **Step 3: Write minimal implementation**

In `setupPrizes.ts` add:

```typescript
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { RequestHandler } from "express";

function isImageUpload(contentType: string | undefined, filename: string, body: Buffer): boolean {
  if (!body || body.length === 0) return false;
  const type = (contentType ?? "").toLowerCase();
  if (type.startsWith("image/")) return true;
  return /\.(png|jpe?g|gif|webp|svg)$/i.test(filename);
}

function safeFilename(raw: string): string {
  const base = path.basename(raw).replace(/[^a-zA-Z0-9._-]/g, "_");
  return base.length > 0 ? base : "upload.bin";
}

export function setupPrizeImageHandler(catalogDir: string): RequestHandler {
  const catalog = getCatalogPaths(catalogDir);
  return async (req, res) => {
    if (!isPrizeSetupEnabled()) {
      res.status(404).json({ message: SETUP_UNAVAILABLE });
      return;
    }
    const body = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body ?? []);
    const filenameHeader = req.header("x-filename") ?? "upload.png";
    const filename = safeFilename(filenameHeader);
    if (!isImageUpload(req.header("content-type"), filename, body)) {
      res.status(400).json({ message: "请上传图片" });
      return;
    }
    await mkdir(catalog.uploads, { recursive: true });
    const stored = `${Date.now()}-${filename}`;
    await writeFile(path.join(catalog.uploads, stored), body);
    res.json({ imagePath: stored });
  };
}
```

In `createApp`, **before** `app.use(express.json(...))`:

```typescript
const catalogDir = options.catalogDir ?? resolveCatalogDir();
app.post(
  "/api/setup/prizes/image",
  express.raw({ type: () => true, limit: "8mb" }),
  setupPrizeImageHandler(catalogDir),
);
app.use(express.json({ limit: "2mb" }));
```

Import `setupPrizeImageHandler` from `./routes/setupPrizes.js`.

- [ ] **Step 4: Run tests**

```bash
npm run test --prefix server -- tests/setupPrizes.api.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/src/routes/setupPrizes.ts server/src/index.ts server/tests/setupPrizes.api.test.ts
git commit -m "feat: upload prize images into the catalog directory"
```

---

### Task 5: 配奖页

**Files:**
- Create: `client/src/admin/SetupPrizesPage.tsx`
- Create: `client/src/admin/SetupPrizesPage.test.tsx`
- Modify: `client/src/App.tsx`

**Interfaces:**
- Consumes: `GET/PUT /api/setup/prizes`、`POST /api/setup/prizes/image`（`X-Filename` + raw body）
- Produces: 路由 `/setup/prizes`；未开开关展示「仅本地配奖可用」；成功文案「已写入仓库文件，未提交。大屏刷新即可看到」

- [ ] **Step 1: Write the failing test**

Create `client/src/admin/SetupPrizesPage.test.tsx`:

```tsx
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SetupPrizesPage } from "./SetupPrizesPage";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("SetupPrizesPage", () => {
  it("shows unavailable copy when setup API is 404", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        status: 404,
        json: async () => ({ message: "仅本地配奖可用" }),
      })),
    );
    render(<SetupPrizesPage />);
    expect(await screen.findByText("仅本地配奖可用")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "保存" })).toBeNull();
  });

  it("loads prizes and saves", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo, init?: RequestInit) => {
      const url = String(input);
      if (url === "/api/setup/prizes" && (!init || init.method === undefined || init.method === "GET")) {
        return {
          ok: true,
          status: 200,
          json: async () => [{ id: "p1", name: "一等奖", imagePath: "a.png", order: 0, quantity: 1 }],
        };
      }
      if (url === "/api/setup/prizes" && init?.method === "PUT") {
        return { ok: true, status: 200, json: async () => [] };
      }
      return { ok: false, status: 500, json: async () => ({}) };
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<SetupPrizesPage />);
    expect(await screen.findByDisplayValue("一等奖")).toBeInTheDocument();
    screen.getByRole("button", { name: "保存" }).click();
    await waitFor(() => {
      expect(screen.getByText("已写入仓库文件，未提交。大屏刷新即可看到")).toBeInTheDocument();
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/setup/prizes",
      expect.objectContaining({ method: "PUT" }),
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm run test --prefix client -- src/admin/SetupPrizesPage.test.tsx
```

Expected: FAIL — cannot find `SetupPrizesPage`.

- [ ] **Step 3: Write minimal implementation**

Create `client/src/admin/SetupPrizesPage.tsx`：

- `useEffect` 里 `GET /api/setup/prizes`。`status === 404` 则 `available=false`，渲染 `<p>仅本地配奖可用</p>`，不渲染表单。
- 可用时：每项名称、数量（`min={1}`）、排序、文件 input（`accept="image/*"`）。上传：`POST /api/setup/prizes/image`，`headers: { "Content-Type": file.type || "application/octet-stream", "X-Filename": file.name }`，`body: file`。成功后把返回的 `imagePath` 写入该项。预览用 `URL.createObjectURL(file)`，不要依赖 `/uploads`（文件此时只在 catalog）。
- 「添加奖品」：`id: \`prize-${Date.now()}\``，`imagePath: "prize-default.svg"`，`quantity: 1`，`order: list.length`。已有 `id` 只读展示，不要做成可编辑 input。
- 「删除」去掉该项。允许空列表。
- 「保存」：`PUT /api/setup/prizes` JSON 数组。成功消息必须一字不差：`已写入仓库文件，未提交。大屏刷新即可看到`。
- 样式复用 `admin-page` / `admin-card` / `admin-row`。

`App.tsx`：

```tsx
import { SetupPrizesPage } from "./admin/SetupPrizesPage";

// inside Routes, before path="*":
<Route path="/setup/prizes" element={<SetupPrizesPage />} />
```

- [ ] **Step 4: Run tests**

```bash
npm run test --prefix client -- src/admin/SetupPrizesPage.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add client/src/admin/SetupPrizesPage.tsx client/src/admin/SetupPrizesPage.test.tsx client/src/App.tsx
git commit -m "feat: add local prize catalog setup page"
```

---

### Task 6: 去掉后台改奖

**Files:**
- Modify: `client/src/admin/AdminPage.tsx`
- Create: `client/src/admin/AdminPage.test.tsx`

**Interfaces:**
- Consumes: 现有 `GET /api/prizes`（只读，给内定区名称）
- Produces: 页面无「奖品配置」「保存奖品」「添加奖品」；仍有「内定中奖人」

- [ ] **Step 1: Write the failing test**

Create `client/src/admin/AdminPage.test.tsx`:

```tsx
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AdminPage } from "./AdminPage";

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe("AdminPage", () => {
  it("does not offer prize editing when logged in", async () => {
    localStorage.setItem("lottery_admin_token", "t");
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo) => {
        const url = String(input);
        if (url === "/api/prizes") {
          return {
            ok: true,
            json: async () => [{ id: "p1", name: "一等奖", imagePath: "x", order: 0, quantity: 1 }],
          };
        }
        if (url === "/api/participants") {
          return { ok: true, json: async () => [] };
        }
        if (url === "/api/presets") {
          return { ok: true, json: async () => ({}) };
        }
        if (url === "/api/public/view") {
          return { ok: true, json: async () => ({ winners: [] }) };
        }
        return { ok: false, status: 404, json: async () => ({}) };
      }),
    );
    render(<AdminPage />);
    await waitFor(() => {
      expect(screen.getByText("内定中奖人")).toBeInTheDocument();
    });
    expect(screen.queryByText("奖品配置")).toBeNull();
    expect(screen.queryByText("保存奖品")).toBeNull();
    expect(screen.queryByRole("button", { name: "添加奖品" })).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm run test --prefix client -- src/admin/AdminPage.test.tsx
```

Expected: FAIL — 仍能找到「奖品配置」。

- [ ] **Step 3: Write minimal implementation**

In `AdminPage.tsx`:

- 删除 `savePrizes`、`addPrize`、`updatePrize`。
- 删除 `<section>` 中标题为「奖品配置」的整块（含图片文件名说明、添加/保存按钮）。
- 保留 `prizes` state 与 `load()` 里的 `GET /api/prizes`，内定区继续用 `prizes.map`。
- 不要加指向 `/setup/prizes` 的链接。

- [ ] **Step 4: Run tests**

```bash
npm run test --prefix client -- src/admin/AdminPage.test.tsx src/admin/AdminLogin.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add client/src/admin/AdminPage.tsx client/src/admin/AdminPage.test.tsx
git commit -m "feat: remove prize editing from the admin page"
```

---

### Task 7: 本地命令与 README

**Files:**
- Create: `scripts/setup-prizes.mjs`
- Create: `server/src/setup/ports.ts`
- Create: `server/tests/ports.test.ts`
- Modify: `package.json`（根目录）
- Modify: `README.md`

**Interfaces:**
- Consumes: 无新依赖；`node:net`、`node:child_process`
- Produces:
  - `export function isPortFree(port: number, host?: string): Promise<boolean>`
  - 根脚本 `"setup:prizes": "node scripts/setup-prizes.mjs"`
  - 占用时 stderr 打印「请先关掉占用 5173/3001 的进程」，`process.exit(1)`
  - `LOTTERY_PRIZE_SETUP=1` 启动 `server` 与 `client` 的 `npm run dev`，打开 `http://127.0.0.1:5173/setup/prizes`
  - 不调用 git

- [ ] **Step 1: Write the failing test**

Create `server/tests/ports.test.ts`:

```typescript
import { createServer } from "node:net";
import { describe, expect, it } from "vitest";
import { isPortFree } from "../src/setup/ports.js";

describe("isPortFree", () => {
  it("is false when the port is already listening", async () => {
    const server = createServer();
    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", () => resolve());
    });
    const addr = server.address();
    if (!addr || typeof addr === "string") {
      server.close();
      throw new Error("expected tcp address");
    }
    expect(await isPortFree(addr.port)).toBe(false);
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
    expect(await isPortFree(addr.port)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm run test --prefix server -- tests/ports.test.ts
```

Expected: FAIL — cannot find module。

- [ ] **Step 3: Implement ports helper, script, README**

`server/src/setup/ports.ts`:

```typescript
import net from "node:net";

export function isPortFree(port: number, host = "127.0.0.1"): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    server.listen(port, host);
  });
}
```

`scripts/setup-prizes.mjs`（完整文件）：

```javascript
import { spawn } from "node:child_process";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const BUSY = "请先关掉占用 5173/3001 的进程";
const SETUP_URL = "http://127.0.0.1:5173/setup/prizes";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function isPortFree(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    server.listen(port, "127.0.0.1");
  });
}

function openBrowser(url) {
  if (process.platform === "win32") {
    spawn("cmd", ["/c", "start", "", url], { detached: true, stdio: "ignore" }).unref();
    return;
  }
  const cmd = process.platform === "darwin" ? "open" : "xdg-open";
  spawn(cmd, [url], { detached: true, stdio: "ignore" }).unref();
}

const serverFree = await isPortFree(3001);
const clientFree = await isPortFree(5173);
if (!serverFree || !clientFree) {
  console.error(BUSY);
  process.exit(1);
}

const env = { ...process.env, LOTTERY_PRIZE_SETUP: "1" };
const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";
const childOpts = { env, stdio: "inherit", shell: true };
const server = spawn(npmCmd, ["run", "dev"], { ...childOpts, cwd: path.join(root, "server") });
const client = spawn(npmCmd, ["run", "dev"], { ...childOpts, cwd: path.join(root, "client") });
openBrowser(SETUP_URL);

function shutdown() {
  server.kill();
  client.kill();
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
```

Root `package.json` scripts 增加：`"setup:prizes": "node scripts/setup-prizes.mjs"`。

`README.md` 替换「默认奖品」与现场流程第 4 步：

```markdown
## 默认奖品

正式奖品清单在 `catalog/prizes.json`，图片在 `catalog/uploads/`。服务器启动时会覆盖写入 `data/prizes.json`，并把用到的图片拷到 `data/uploads/`。未写数量的旧数据按 1 份处理。

本地配置奖品（写入仓库文件，不会自动提交）：

```bash
npm run setup:prizes
```

浏览器会打开配奖页。保存后请自行 `git add` / `commit` / `push`。若提示端口占用，先关掉 5173 和 3001 上的进程。现场 `/admin` 不能改奖品。
```

现场流程第 4 步改为：`4. 内定仍在 `/admin` 按次设置（可选）。奖品名称、数量、图片用上面的本地命令改。`

- [ ] **Step 4: Run tests**

```bash
npm run test --prefix server -- tests/ports.test.ts
npm run test --prefix server
npm run test --prefix client
```

Expected: 全部 PASS。

- [ ] **Step 5: Commit**

```bash
git add scripts/setup-prizes.mjs server/src/setup/ports.ts server/tests/ports.test.ts package.json README.md
git commit -m "feat: add npm run setup:prizes and document catalog seed"
```

---

## 手动验收（计划外自动化）

实现全部任务后，在仓库根目录：

1. 确认没有其它占用 5173/3001 的进程。
2. `npm run setup:prizes`，浏览器打开配奖页（不是「仅本地配奖可用」）。
3. 改一个名称、上传一张图、保存；看到固定成功文案。
4. 打开 `http://127.0.0.1:5173/` 奖品屏，刷新后能看到新名称/图。
5. 打开 `/admin`：无「奖品配置」；内定区仍列出奖品名。
6. `git status`：`catalog/` 有改动，没有自动 commit。

---

## Self-review vs spec

| 规格 | 任务 |
|------|------|
| `catalog/` 种子 + 启动覆盖 | 1–2 |
| skip 测试 / 不改 winners 等 | 1–2 |
| 当前奖保留或改第一项 | 1 |
| 配奖 GET/PUT、空清单、低于已抽人数仍写 | 3 |
| 上传图、「请上传图片」、404 | 4 |
| `/setup/prizes` 页与成功文案 | 5 |
| `/admin` 去掉改奖 | 6 |
| `npm run setup:prizes`、端口文案、README、不 git | 7 |
| 不新加依赖、不改抽奖算法 | Global |
| `PUT /api/prizes` 保留 | 未删除该路由 |
