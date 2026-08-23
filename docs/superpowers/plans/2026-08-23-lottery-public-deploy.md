# 抽奖大屏 Render 免费公网部署 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan step-by-step. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将抽奖大屏以单进程生产模式部署到 Render 免费档，提供公网 URL，数据在容器磁盘 JSON 中短期持久化。

**Architecture:** `client` 构建为静态资源；`server` Express 在生产模式托管 `client/dist`、现有 `/api/*` 与 `/uploads`；Render 运行 `npm run build` + `npm start`，环境变量 `HOST=0.0.0.0`、`LOTTERY_DATA_DIR=./data`。

**Tech Stack:** Express, Vite/React (existing), Render Web Service, Vitest/supertest

## Global Constraints

- 不引入云数据库；沿用 `data/*.json` 与 `LOTTERY_DATA_DIR`。
- 最小业务改动；不重构抽奖逻辑。
- 生产单源：API 与前端同域，客户端继续用相对路径 `/api/...`。
- 活动期避免 Redeploy（文档说明，非代码强制）。
- 管理口令不得使用默认 `admin123` 上公网（文档 + 可选 `ADMIN_PASSPHRASE` 环境变量）。

---

## File Map

| 文件 | 职责 |
|------|------|
| `server/src/index.ts` | 生产静态托管、SPA 回退、`HOST`/`clientDist` |
| `server/tests/production.test.ts` | 生产静态与 SPA 路由测试 |
| `server/src/auth/adminAuth.ts` | 可选 `ADMIN_PASSPHRASE` 覆盖 |
| `server/tests/adminAuth.test.ts` | 环境变量口令测试 |
| `package.json` | 根级 `build`、`start` 脚本 |
| `server/package.json` | `start` 脚本 `NODE_ENV=production` |
| `render.yaml` | Render 构建/启动/环境变量 |
| `README.md` | 部署步骤、数据持久说明、十月使用建议 |

---

### Task 1: 生产静态托管与 SPA 回退

**Files:**
- Modify: `server/src/index.ts`
- Create: `server/tests/production.test.ts`

**Interfaces:**
- Consumes: `createApp(options)` 现有 API 路由
- Produces: `createApp({ clientDist?: string })` — 当 `clientDist` 设置时挂载静态资源并在非 API/uploads 的 GET 返回 `index.html`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, expect, it } from "vitest";
import request from "supertest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createApp } from "../src/index.js";

describe("production static hosting", () => {
  it("serves built index.html at root", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "lottery-dist-"));
    const index = path.join(tmp, "index.html");
    fs.writeFileSync(index, "<html><body>LOTTERY_APP</body></html>");
    const app = createApp({ clientDist: tmp });
    const res = await request(app).get("/");
    expect(res.status).toBe(200);
    expect(res.text).toContain("LOTTERY_APP");
  });

  it("SPA fallback returns index.html for /admin", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "lottery-dist-"));
    fs.writeFileSync(path.join(tmp, "index.html"), "<html><body>SPA</body></html>");
    const app = createApp({ clientDist: tmp });
    const res = await request(app).get("/admin");
    expect(res.status).toBe(200);
    expect(res.text).toContain("SPA");
  });

  it("still serves /api/health when clientDist set", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "lottery-dist-"));
    fs.writeFileSync(path.join(tmp, "index.html"), "ok");
    const app = createApp({ clientDist: tmp });
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test --prefix server -- production.test.ts`
Expected: FAIL — `/` 不是 `LOTTERY_APP` 或 404

- [ ] **Step 3: Implement minimal code**

在 `CreateAppOptions` 增加 `clientDist?: string`。在 `createApp` 内所有 `app.use(...Router)` 之后：

```typescript
if (options.clientDist) {
  const dist = path.resolve(options.clientDist);
  app.use(express.static(dist));
  app.get("*", (req, res, next) => {
    if (req.method !== "GET" && req.method !== "HEAD") {
      return next();
    }
    if (req.path.startsWith("/api") || req.path.startsWith("/uploads")) {
      return next();
    }
    res.sendFile(path.join(dist, "index.html"));
  });
}
```

在 `isDirectRun()` 块中：

```typescript
const isProd = process.env.NODE_ENV === "production";
const clientDist = isProd
  ? path.resolve(here, "../../client/dist")
  : undefined;
createApp({ clientDist }).listen(port, host, () => { ... });
```

默认 `host` 在生产改为 `process.env.HOST ?? "0.0.0.0"`，开发仍为 `127.0.0.1`。

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test --prefix server -- production.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/src/index.ts server/tests/production.test.ts
git commit -m "feat: serve client dist in production with SPA fallback"
```

---

### Task 2: 根构建与启动脚本

**Files:**
- Modify: `package.json`
- Modify: `server/package.json`

**Interfaces:**
- Produces: 根 `npm run build`（client build）、`npm run start`（server production）

- [ ] **Step 1: 添加脚本**

`package.json`:

```json
"build": "npm run build --prefix client",
"start": "npm run start --prefix server"
```

`server/package.json`:

```json
"start": "cross-env NODE_ENV=production tsx src/index.ts"
```

若不想加 `cross-env` 依赖，Windows 可用文档说明分别设置环境变量；或加 `cross-env` 为 server devDependency。

- [ ] **Step 2: 本地验证**

```bash
npm run build
npm run start
```

打开 `http://127.0.0.1:3001/` 应看到大屏；`/api/health` 返回 ok。

- [ ] **Step 3: Commit**

```bash
git add package.json server/package.json
git commit -m "chore: add production build and start scripts"
```

---

### Task 3: ADMIN_PASSPHRASE 环境变量（可选但推荐）

**Files:**
- Modify: `server/src/auth/adminAuth.ts`
- Create: `server/tests/adminAuth.test.ts`

**Interfaces:**
- Produces: `verifyPassphrase` 优先使用 `process.env.ADMIN_PASSPHRASE`，否则读 `config.json`

- [ ] **Step 1: Write failing test**

```typescript
import { afterEach, describe, expect, it } from "vitest";
import { verifyPassphrase } from "../src/auth/adminAuth.js";

describe("verifyPassphrase", () => {
  afterEach(() => {
    delete process.env.ADMIN_PASSPHRASE;
  });

  it("uses ADMIN_PASSPHRASE env when set", async () => {
    process.env.ADMIN_PASSPHRASE = "from-env";
    expect(await verifyPassphrase("from-env")).toBe(true);
    expect(await verifyPassphrase("admin123")).toBe(false);
  });
});
```

- [ ] **Step 2: Run — expect FAIL**（若 env 未实现）

- [ ] **Step 3: Implement**

```typescript
export async function verifyPassphrase(passphrase: string): Promise<boolean> {
  const fromEnv = process.env.ADMIN_PASSPHRASE;
  if (fromEnv) {
    return passphrase === fromEnv;
  }
  const store = new JsonStore<AppConfig>(getPaths().config, { adminPassphrase: "admin123" });
  const cfg = await store.read();
  return passphrase === cfg.adminPassphrase;
}
```

- [ ] **Step 4: Run tests — PASS**

- [ ] **Step 5: Commit**

---

### Task 4: Render 部署配置

**Files:**
- Create: `render.yaml`

```yaml
services:
  - type: web
    name: lottery-display
    runtime: node
    buildCommand: npm install && npm run build --prefix client && npm install --prefix server
    startCommand: npm run start --prefix server
    envVars:
      - key: NODE_ENV
        value: production
      - key: HOST
        value: 0.0.0.0
      - key: LOTTERY_DATA_DIR
        value: ./data
      - key: ADMIN_PASSPHRASE
        sync: false
```

`ADMIN_PASSPHRASE` 在 Render Dashboard 手动设置，不写入仓库。

- [ ] **Commit**

```bash
git add render.yaml
git commit -m "chore: add Render deployment blueprint"
```

---

### Task 5: README 部署文档

**Files:**
- Modify: `README.md`

新增章节：

1. **生产模式本地**：`npm run build && npm run start`
2. **Render 部署**：连接 GitHub 仓库或 Blueprint；设置 `ADMIN_PASSPHRASE`
3. **数据持久**：关浏览器不影响；Redeploy 清空；十月活动避免 Redeploy
4. **冷启动**：免费档休眠，活动前访问预热
5. **十月后**：删除 Render 服务

- [ ] **Commit**

```bash
git add README.md
git commit -m "docs: Render free deployment and data persistence notes"
```

---

### Task 6: 端到端冒烟（本地生产模式）

- [ ] 执行 `npm run build && npm run start`
- [ ] 验证 `/`、`/admin`、加用户、设内定、抽奖全流程
- [ ] 执行 `npm run test`（server + client）全部 PASS

---

## Self-Review Checklist

| 设计需求 | 任务 |
|----------|------|
| 单进程 Express 托管 | Task 1, 2 |
| 公网 Render 免费 | Task 4, 5 |
| LOTTERY_DATA_DIR | Task 4 env |
| 数据短期持久说明 | Task 5 |
| 强口令 | Task 3, 4, 5 |
| 验收标准本地可复现 | Task 6 |

无 TBD；类型与路径与现有代码一致。

## Execution Handoff

Plan saved to `docs/superpowers/plans/2026-08-23-lottery-public-deploy.md`.

**1. Subagent-Driven (recommended)** — 每任务独立子代理 + 审查  
**2. Inline Execution** — 本对话内按检查点执行

请选择执行方式，或先审阅设计 spec：`docs/superpowers/specs/2026-08-23-lottery-public-deploy-design.md`。
