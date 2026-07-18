# 实现任务

## 文件结构

- `Create: package.json` — 根脚本：同时启动 client/server、安装依赖
- `Create: server/package.json` — Express 服务依赖与脚本
- `Create: server/tsconfig.json` — server TypeScript 配置
- `Create: server/src/index.ts` — HTTP 入口与中间件挂载
- `Create: server/src/types.ts` — Prize/Participant/Preset/WinnerRecord/Session 类型
- `Create: server/src/store/jsonStore.ts` — 读写 `data/*.json` 的原子保存
- `Create: server/src/store/paths.ts` — data 目录路径常量
- `Create: server/src/auth/adminAuth.ts` — 口令校验与会话 token
- `Create: server/src/domain/eligibility.ts` — 未中奖 eligible 池计算
- `Create: server/src/domain/draw.ts` — 硬内定/随机开奖纯函数
- `Create: server/src/routes/prizes.ts` — 奖品 CRUD 与当前奖品
- `Create: server/src/routes/participants.ts` — 用户添加与重名校验
- `Create: server/src/routes/admin.ts` — 登录与管理写接口
- `Create: server/src/routes/presets.ts` — 按奖品内定
- `Create: server/src/routes/draw.ts` — 开奖 API
- `Create: server/src/routes/session.ts` — 公共会话（当前屏/控制条/抽奖阶段）
- `Create: server/src/routes/public.ts` — 无需口令的公共读模型
- `Create: server/tests/eligibility.test.ts` — eligible 池单测
- `Create: server/tests/draw.test.ts` — 开奖规则单测
- `Create: server/tests/participants.test.ts` — 重名单测
- `Create: data/prizes.json` — 奖品初始空列表
- `Create: data/participants.json` — 用户初始空列表
- `Create: data/presets.json` — 内定初始空对象
- `Create: data/winners.json` — 中奖记录初始空列表
- `Create: data/session.json` — 默认会话状态
- `Create: data/config.json` — admin 口令配置
- `Create: data/uploads/.gitkeep` — 奖品图片上传目录占位
- `Create: client/package.json` — Vite React 依赖与脚本
- `Create: client/vite.config.ts` — 开发代理到 server
- `Create: client/tsconfig.json` — client TypeScript 配置
- `Create: client/index.html` — SPA 入口 HTML
- `Create: client/src/main.tsx` — React 挂载
- `Create: client/src/App.tsx` — 路由：`/` 与 `/admin`
- `Create: client/src/api/client.ts` — fetch 封装
- `Create: client/src/api/types.ts` — 与 server 对齐的 DTO
- `Create: client/src/state/useSession.ts` — 轮询/刷新会话
- `Create: client/src/screens/PrizeScreen.tsx` — 奖品展示屏
- `Create: client/src/screens/EnrollScreen.tsx` — 假二维码 + 添加用户
- `Create: client/src/screens/DrawScreen.tsx` — 滚动抽奖屏
- `Create: client/src/screens/WinnerScreen.tsx` — 中奖展示屏
- `Create: client/src/screens/PublicStage.tsx` — 四屏容器与淡入淡出
- `Create: client/src/components/HostControlBar.tsx` — 主持人控制条
- `Create: client/src/components/NameTicker.tsx` — 用户名滚动条
- `Create: client/src/admin/AdminLogin.tsx` — 口令登录
- `Create: client/src/admin/AdminPage.tsx` — 奖品/内定管理
- `Create: client/src/styles/stage.css` — 大屏与动效样式
- `Create: client/public/fake-qr.svg` — 假二维码资源
- `Create: README.md` — 启动、口令、投屏说明

## 接口

### Batch 1 → Batch 2+
- **Produces**: `npm run dev` workspace scripts — 后续批次可启动服务跑测

### Batch 2 → Batch 3–7
- **Produces**: `JsonStore<T>`、`Prize`/`Participant`/`Preset`/`WinnerRecord`/`Session` types — API 与 domain 消费

### Batch 3 → Batch 6–8
- **Produces**: `GET/PUT /api/prizes`, `PUT /api/session/current-prize` — 开奖与公共屏消费当前奖品

### Batch 4 → Batch 6–8
- **Produces**: `POST /api/participants`（重名 409）— 报名屏与 eligible 池消费

### Batch 5 → Batch 6–7, 11
- **Produces**: `requireAdmin` middleware、`POST /api/admin/login` — 保护管理写

### Batch 6 → Batch 8–10
- **Produces**: `POST /api/draw` → `{ prizeId, participantId, name }`；`eligibleParticipants(prizeId)` — 抽奖屏消费

### Batch 7 → Batch 8–10
- **Produces**: `GET/PATCH /api/session`、`GET /api/public/view` — 前端舞台消费

### Batch 8 → Batch 9–11
- **Produces**: React Router shell、`api/client.ts` — 各屏与 Admin 消费

## 1. Batch 1: 脚手架与健康检查

- [x] **1.1 编写失败的测试**

```ts
// server/tests/health.test.ts
import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "../src/index";

describe("GET /api/health", () => {
  it("returns ok", async () => {
    const res = await request(createApp()).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });
});
```

**Files**: `Create: server/tests/health.test.ts`

- [x] **1.2 运行测试并确认失败**

Run: `cd server && npx vitest run tests/health.test.ts`
Expected: FAIL module not found or createApp missing

- [x] **1.3 实现最小化代码**

**Files**: `Create: package.json`, `Create: server/package.json`, `Create: server/tsconfig.json`, `Create: server/src/index.ts`（导出 `createApp`，注册 `GET /api/health`）
**Interfaces**: Produces `createApp(): Express` — 被后续集成测试消费

- [x] **1.4 运行测试并确认通过**

Run: `cd server && npx vitest run tests/health.test.ts`
Expected: PASS

- [x] **1.5 提交**

Skipped: `git` unavailable on PATH.

## 2. Batch 2: JSON Store 与领域类型

Depends on: Batch 1

- [x] **2.1 编写失败的测试**

```ts
// server/tests/jsonStore.test.ts
it("roundtrips JSON", async () => {
  const store = new JsonStore<{ n: number }>(tmpFile, { n: 0 });
  await store.write({ n: 3 });
  expect(await store.read()).toEqual({ n: 3 });
});
```

**Files**: `Create: server/tests/jsonStore.test.ts`

- [x] **2.2 运行测试并确认失败**

Run: `cd server && npx vitest run tests/jsonStore.test.ts`
Expected: FAIL JsonStore not found

- [x] **2.3 实现最小化代码**

**Files**: `Create: server/src/types.ts`, `Create: server/src/store/paths.ts`, `Create: server/src/store/jsonStore.ts`, `Create: data/*.json` 初始文件
**Interfaces**: Produces `JsonStore<T>.read()/write()` — 被 routes 消费

- [x] **2.4 运行测试并确认通过**

Run: `cd server && npx vitest run tests/jsonStore.test.ts`
Expected: PASS

- [x] **2.5 提交**

Skipped: `git` unavailable on PATH.

## 3. Batch 3: 奖品 API

Depends on: Batch 2

- [ ] **3.1 编写失败的测试**

```ts
it("rejects prize without name", async () => {
  const res = await adminPut("/api/prizes", [{ id: "1", name: "", imagePath: "a.png" }]);
  expect(res.status).toBe(400);
});
it("sets current prize", async () => {
  await seedPrize("p1");
  const res = await request(app).put("/api/session/current-prize").send({ prizeId: "p1" });
  expect(res.status).toBe(200);
});
```

**Files**: `Create: server/tests/prizes.test.ts`

- [ ] **3.2 运行测试并确认失败**

Run: `cd server && npx vitest run tests/prizes.test.ts`
Expected: FAIL route missing

- [ ] **3.3 实现最小化代码**

**Files**: `Create: server/src/routes/prizes.ts`, `Modify: server/src/index.ts`, `Modify: server/src/routes/session.ts`（若尚未建则本批创建 current-prize 部分）
**Interfaces**: Produces prize list + currentPrizeId persistence

- [ ] **3.4 运行测试并确认通过**

Run: `cd server && npx vitest run tests/prizes.test.ts`
Expected: PASS

- [ ] **3.5 提交**

Skip if no git.

## 4. Batch 4: 用户报名与重名

Depends on: Batch 2

- [ ] **4.1 编写失败的测试**

```ts
it("rejects duplicate name", async () => {
  await postParticipant({ id: "1", name: "张三" });
  const res = await postParticipant({ id: "2", name: "张三" });
  expect(res.status).toBe(409);
  expect(res.body.message).toMatch(/重新|重复|名称/);
});
```

**Files**: `Create: server/tests/participants.test.ts`

- [ ] **4.2 运行测试并确认失败**

Run: `cd server && npx vitest run tests/participants.test.ts`
Expected: FAIL

- [ ] **4.3 实现最小化代码**

**Files**: `Create: server/src/routes/participants.ts`, `Modify: server/src/index.ts`
**Interfaces**: Produces `POST /api/participants` with 409 on duplicate name

- [ ] **4.4 运行测试并确认通过**

Run: `cd server && npx vitest run tests/participants.test.ts`
Expected: PASS

- [ ] **4.5 提交**

Skip if no git.

## 5. Batch 5: Admin 口令

Depends on: Batch 1–2

- [ ] **5.1 编写失败的测试**

```ts
it("blocks prize write without auth", async () => {
  const res = await request(app).put("/api/prizes").send([]);
  expect(res.status).toBe(401);
});
it("allows after login", async () => {
  await login("correct-pass");
  const res = await request(app).put("/api/prizes").send([]);
  expect(res.status).toBe(200);
});
```

**Files**: `Create: server/tests/adminAuth.test.ts`, `Modify: data/config.json`

- [ ] **5.2 运行测试并确认失败**

Run: `cd server && npx vitest run tests/adminAuth.test.ts`
Expected: FAIL

- [ ] **5.3 实现最小化代码**

**Files**: `Create: server/src/auth/adminAuth.ts`, `Create: server/src/routes/admin.ts`, `Modify: server/src/routes/prizes.ts`（挂 requireAdmin）
**Interfaces**: Produces `requireAdmin`、`POST /api/admin/login`

- [ ] **5.4 运行测试并确认通过**

Run: `cd server && npx vitest run tests/adminAuth.test.ts`
Expected: PASS

- [ ] **5.5 提交**

Skip if no git.

## 6. Batch 6: 内定、eligible、开奖

Depends on: Batch 3–5

- [ ] **6.1 编写失败的测试**

```ts
// server/tests/draw.test.ts
it("uses preset when present", () => {
  expect(resolveWinner({ presetId: "u1", eligibleIds: ["u1", "u2"], random: () => 0 })).toBe("u1");
});
it("rejects preset of prior winner", async () => {
  await markWinner("u1", "p0");
  const res = await adminPutPreset("p1", "u1");
  expect(res.status).toBe(400);
});
it("rejects draw with empty eligible", async () => {
  const res = await postDraw();
  expect(res.status).toBe(400);
});
```

**Files**: `Create: server/tests/draw.test.ts`, `Create: server/tests/eligibility.test.ts`

- [ ] **6.2 运行测试并确认失败**

Run: `cd server && npx vitest run tests/draw.test.ts tests/eligibility.test.ts`
Expected: FAIL

- [ ] **6.3 实现最小化代码**

**Files**: `Create: server/src/domain/eligibility.ts`, `Create: server/src/domain/draw.ts`, `Create: server/src/routes/presets.ts`, `Create: server/src/routes/draw.ts`, `Modify: server/src/index.ts`
**Interfaces**: Produces `POST /api/draw`, preset APIs, `listEligible(participants, winners)`

- [ ] **6.4 运行测试并确认通过**

Run: `cd server && npx vitest run tests/draw.test.ts tests/eligibility.test.ts`
Expected: PASS

- [ ] **6.5 提交**

Skip if no git.

## 7. Batch 7: Session 与公共读模型

Depends on: Batch 3–6

- [ ] **7.1 编写失败的测试**

```ts
it("public view does not require admin", async () => {
  const res = await request(app).get("/api/public/view");
  expect(res.status).toBe(200);
  expect(res.body.currentPrize).toBeDefined();
});
it("patches publicScreen", async () => {
  const res = await request(app).patch("/api/session").send({ publicScreen: "draw" });
  expect(res.body.publicScreen).toBe("draw");
});
```

**Files**: `Create: server/tests/session.test.ts`

- [ ] **7.2 运行测试并确认失败**

Run: `cd server && npx vitest run tests/session.test.ts`
Expected: FAIL

- [ ] **7.3 实现最小化代码**

**Files**: `Create: server/src/routes/session.ts`, `Create: server/src/routes/public.ts`, `Modify: server/src/index.ts`, static `/uploads`
**Interfaces**: Produces `GET /api/public/view`, `GET|PATCH /api/session`

- [ ] **7.4 运行测试并确认通过**

Run: `cd server && npx vitest run tests/session.test.ts`
Expected: PASS

- [ ] **7.5 提交**

Skip if no git.

## 8. Batch 8: Client 脚手架与 API 客户端

Depends on: Batch 7

- [ ] **8.1 编写失败的测试**

```ts
// client/src/api/client.test.ts
it("builds public view url", () => {
  expect(publicViewPath()).toBe("/api/public/view");
});
```

**Files**: `Create: client/src/api/client.test.ts`

- [ ] **8.2 运行测试并确认失败**

Run: `cd client && npx vitest run src/api/client.test.ts`
Expected: FAIL

- [ ] **8.3 实现最小化代码**

**Files**: `Create: client/package.json`, `Create: client/vite.config.ts`（proxy `/api`→`3001`）, `Create: client/index.html`, `Create: client/src/main.tsx`, `Create: client/src/App.tsx`, `Create: client/src/api/client.ts`, `Create: client/src/api/types.ts`, `Modify: package.json`（root `dev`）
**Interfaces**: Produces browser app on `:5173` proxying API

- [ ] **8.4 运行测试并确认通过**

Run: `cd client && npx vitest run src/api/client.test.ts`
Expected: PASS

- [ ] **8.5 提交**

Skip if no git.

## 9. Batch 9: 对外四屏 UI

Depends on: Batch 8

- [ ] **9.1 编写失败的测试**

```tsx
// client/src/screens/PublicStage.test.tsx
it("renders prize name from view model", () => {
  render(<PrizeScreen prize={{ name: "特等奖", imageUrl: "/x.png" }} />);
  expect(screen.getByText("特等奖")).toBeInTheDocument();
});
```

**Files**: `Create: client/src/screens/PrizeScreen.test.tsx`

- [ ] **9.2 运行测试并确认失败**

Run: `cd client && npx vitest run src/screens/PrizeScreen.test.tsx`
Expected: FAIL

- [ ] **9.3 实现最小化代码**

**Files**: `Create: client/src/screens/PrizeScreen.tsx`, `Create: client/src/screens/EnrollScreen.tsx`（假 QR + 添加用户表单，409 展示重名提示）, `Create: client/src/screens/DrawScreen.tsx`, `Create: client/src/screens/WinnerScreen.tsx`, `Create: client/src/screens/PublicStage.tsx`, `Create: client/public/fake-qr.svg`, `Create: client/src/styles/stage.css`, `Create: client/src/state/useSession.ts`
**Interfaces**: Consumes `/api/public/view` + session; Produces four screens

- [ ] **9.4 运行测试并确认通过**

Run: `cd client && npx vitest run src/screens/PrizeScreen.test.tsx`
Expected: PASS

- [ ] **9.5 提交**

Skip if no git.

## 10. Batch 10: 控制条、滚动停靠、淡入淡出

Depends on: Batch 9

- [ ] **10.1 编写失败的测试**

```ts
// client/src/components/NameTicker.test.ts
it("includes all names in cycle list", () => {
  expect(buildCycle(["a", "b"])).toEqual(["a", "b"]);
});
```

**Files**: `Create: client/src/components/NameTicker.test.ts`

- [ ] **10.2 运行测试并确认失败**

Run: `cd client && npx vitest run src/components/NameTicker.test.ts`
Expected: FAIL

- [ ] **10.3 实现最小化代码**

**Files**: `Create: client/src/components/HostControlBar.tsx`（切屏、选奖、开抽、隐藏）, `Create: client/src/components/NameTicker.tsx`（加速减速停靠到服务端 winner）, `Modify: client/src/screens/PublicStage.tsx`（fade）, `Modify: client/src/screens/DrawScreen.tsx`, `Modify: client/src/screens/WinnerScreen.tsx`（高亮）
**Interfaces**: Consumes `POST /api/draw` then animates to winner; patches session screens

- [ ] **10.4 运行测试并确认通过**

Run: `cd client && npx vitest run src/components/NameTicker.test.ts`
Expected: PASS

- [ ] **10.5 提交**

Skip if no git.

## 11. Batch 11: Admin 页

Depends on: Batch 5–8

- [ ] **11.1 编写失败的测试**

```tsx
it("shows login form when locked", () => {
  render(<AdminPage />);
  expect(screen.getByLabelText(/口令/)).toBeInTheDocument();
});
```

**Files**: `Create: client/src/admin/AdminLogin.test.tsx`

- [ ] **11.2 运行测试并确认失败**

Run: `cd client && npx vitest run src/admin/AdminLogin.test.tsx`
Expected: FAIL

- [ ] **11.3 实现最小化代码**

**Files**: `Create: client/src/admin/AdminLogin.tsx`, `Create: client/src/admin/AdminPage.tsx`（奖品编辑/上传、按奖内定、已中奖拦截提示）, `Modify: client/src/App.tsx` 挂载 `/admin`
**Interfaces**: Consumes admin login + prizes/presets APIs

- [ ] **11.4 运行测试并确认通过**

Run: `cd client && npx vitest run src/admin/AdminLogin.test.tsx`
Expected: PASS

- [ ] **11.5 提交**

Skip if no git.

## 12. Batch 12: README 与端到端手工验收清单

Depends on: Batch 1–11

- [ ] **12.1 编写失败的测试**

```ts
// server/tests/e2e-smoke.test.ts — API 级冒烟：加奖→加用户→内定→开奖→winner 匹配内定
```

**Files**: `Create: server/tests/e2e-smoke.test.ts`

- [ ] **12.2 运行测试并确认失败**

Run: `cd server && npx vitest run tests/e2e-smoke.test.ts`
Expected: FAIL until wired

- [ ] **12.3 实现最小化代码**

**Files**: `Create: README.md`（启动命令、默认口令、`127.0.0.1`、四屏操作步骤）, 修齐根 `package.json` scripts：`dev`/`test`
**Interfaces**: Produces documented run path

- [ ] **12.4 运行测试并确认通过**

Run: `cd server && npx vitest run tests/e2e-smoke.test.ts` 与 `cd client && npx vitest run`
Expected: PASS

- [ ] **12.5 提交**

Skip if no git. Else final commit `feat: lottery display app mvp`

## 需求映射

| Spec 能力 | Batches |
|---|---|
| prize-catalog | 3, 11 |
| participant-enrollment | 4, 9 |
| public-lottery-screens | 7, 9, 10 |
| hard-preset-draw | 6, 10, 11 |
| local-lottery-api | 1–7, 12 |
