# 奖品数量与手动停止抽奖 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 奖品可设数量 N，连抽 N 人且抽满才进中奖屏；点「开始」只滚动，点「停」才开奖；内定改为按抽次槽位。

**Architecture:** 在现有 JSON 与四屏上做最小改动。`quantity` 与 winners 条数比较得出是否抽完，不新增 session 字段。`POST /api/draw` 改到点停才调用。内定存为与数量等长的 `Array<string | null>`；旧的字符串内定读成第 1 槽。大屏用 `canDraw` 判断能否开始，不把内定名单暴露给 `public/view`。

**Tech Stack:** Vite + React（`client/`）、Express + TypeScript（`server/`）、Vitest、supertest、JSON 文件（`data/`）

## Global Constraints

- 对照 `docs/superpowers/specs/2026-08-26-prize-quantity-manual-stop-design.md`；不扩大范围。
- 不新增 session 字段，不新增 JSON 文件种类，不改 `resolveWinner` / `listEligible` 核心算法。
- 不把内定是谁放进 `GET /api/public/view`。
- 错误文案固定：「该奖品已抽完」「没有可抽奖用户」「同一奖品不能重复内定同一人」「该奖品已抽出 X 人，数量不能小于 X」「内定槽数量必须与奖品数量一致」。不再返回「该奖品已开奖」。
- 内定优先级最高，可覆盖不可重复中奖。
- 不新加 npm 依赖。不改姓名录入、四屏顺序、控制条隐藏。
- 实现前用户规则：未经用户明确允许不要改代码；本计划获准执行后按任务改。接口用 `int32_t` 等 C++ 规则不适用于本 TS 仓库。

---

## File Map

| 文件 | 职责 |
|------|------|
| `server/src/types.ts` | `Prize.quantity`；`PresetMap` 改为槽数组 |
| `server/src/domain/prizeQuantity.ts` | 缺省数量、已抽条数、是否抽完 |
| `server/src/domain/presetSlots.ts` | 旧字符串兼容、对齐数量、清掉某参与者 |
| `server/src/domain/canDraw.ts` | 计算 `canDraw` |
| `server/src/routes/prizes.ts` | 校验 quantity；写回时同步内定长度 |
| `server/src/routes/presets.ts` | `{ slots }` 读写 |
| `server/src/routes/draw.ts` | 按槽开奖；允许多条；返回进度 |
| `server/src/routes/session.ts` | `public/view` 增加 `canDraw`；奖品带 quantity |
| `server/src/routes/participants.ts` | 删除用户时清槽 |
| `client/src/api/types.ts` | `quantity`、`canDraw`、`DrawResult` 进度字段 |
| `client/src/screens/prizeOptionLabel.ts` | 控制条下拉文案 |
| `client/src/screens/drawFlow.ts` | 开始校验、停留后是否进第四屏 |
| `client/src/screens/winnerHistory.ts` | `winnersForPrize` |
| `client/src/components/HostControlBar.tsx` | 开始 / 停 |
| `client/src/screens/PublicStage.tsx` | 开始不调开奖；点停才调；抽满才自动进第四屏 |
| `client/src/screens/PrizeScreen.tsx` | 进度行 |
| `client/src/screens/WinnerScreen.tsx` | 本奖多人 |
| `client/src/admin/AdminPage.tsx` | 数量 + N 个内定下拉 |
| `README.md` | 现场流程 |
| `data/prizes.json` | 种子补 `quantity: 1` |

---

### Task 1: 奖品数量纯函数

**Files:**
- Create: `server/src/domain/prizeQuantity.ts`
- Create: `server/tests/prizeQuantity.test.ts`
- Modify: `server/src/types.ts`（`Prize` 增加 `quantity: number`）

**Interfaces:**
- Consumes: `Prize`、`WinnerRecord`（`server/src/types.ts`）
- Produces:
  - `export function prizeQuantity(prize: { quantity?: unknown }): number` — 合法整数 ≥1 原样返回，否则 `1`
  - `export function normalizePrize<T extends { quantity?: unknown }>(prize: T): T & { quantity: number }`
  - `export function drawnCountForPrize(winners: Array<{ prizeId: string }>, prizeId: string): number`
  - `export function isPrizeComplete(winners: Array<{ prizeId: string }>, prizeId: string, quantity: number): boolean`

- [ ] **Step 1: Write the failing test**

Create `server/tests/prizeQuantity.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import {
  drawnCountForPrize,
  isPrizeComplete,
  normalizePrize,
  prizeQuantity,
} from "../src/domain/prizeQuantity.js";

describe("prizeQuantity", () => {
  it("defaults missing or invalid to 1", () => {
    expect(prizeQuantity({})).toBe(1);
    expect(prizeQuantity({ quantity: 0 })).toBe(1);
    expect(prizeQuantity({ quantity: 1.5 })).toBe(1);
    expect(prizeQuantity({ quantity: 3 })).toBe(3);
  });
});

describe("normalizePrize", () => {
  it("writes quantity 1 when absent", () => {
    const p = normalizePrize({ id: "p1", name: "A", imagePath: "x", order: 0 });
    expect(p.quantity).toBe(1);
  });
});

describe("drawnCountForPrize / isPrizeComplete", () => {
  const winners = [
    { prizeId: "p1" },
    { prizeId: "p1" },
    { prizeId: "p2" },
  ];
  it("counts per prize and compares to quantity", () => {
    expect(drawnCountForPrize(winners, "p1")).toBe(2);
    expect(isPrizeComplete(winners, "p1", 3)).toBe(false);
    expect(isPrizeComplete(winners, "p1", 2)).toBe(true);
    expect(isPrizeComplete(winners, "p3", 1)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run from repo root:

```bash
npm run test --prefix server -- tests/prizeQuantity.test.ts
```

Expected: FAIL — cannot find module `../src/domain/prizeQuantity.js`。

- [ ] **Step 3: Write minimal implementation**

In `server/src/types.ts`, change `Prize` to:

```typescript
export type Prize = {
  id: string;
  name: string;
  imagePath: string;
  order: number;
  quantity: number;
};
```

Create `server/src/domain/prizeQuantity.ts`:

```typescript
export function prizeQuantity(prize: { quantity?: unknown }): number {
  const q = prize.quantity;
  if (typeof q === "number" && Number.isInteger(q) && q >= 1) {
    return q;
  }
  return 1;
}

export function normalizePrize<T extends { quantity?: unknown }>(prize: T): T & { quantity: number } {
  return { ...prize, quantity: prizeQuantity(prize) };
}

export function drawnCountForPrize(winners: Array<{ prizeId: string }>, prizeId: string): number {
  return winners.filter((w) => w.prizeId === prizeId).length;
}

export function isPrizeComplete(
  winners: Array<{ prizeId: string }>,
  prizeId: string,
  quantity: number,
): boolean {
  return drawnCountForPrize(winners, prizeId) >= quantity;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm run test --prefix server -- tests/prizeQuantity.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/src/types.ts server/src/domain/prizeQuantity.ts server/tests/prizeQuantity.test.ts
git commit -m "feat: add prize quantity helpers"
```

---

### Task 2: 内定槽纯函数

**Files:**
- Create: `server/src/domain/presetSlots.ts`
- Create: `server/tests/presetSlots.test.ts`
- Modify: `server/src/types.ts`（`PresetMap`）

**Interfaces:**
- Consumes: Task 1 的 `prizeQuantity` 不直接调用；本任务只吃 `quantity: number`
- Produces:
  - `export type PresetSlots = Array<string | null>`
  - `export type PresetMap = Record<string, PresetSlots>`
  - `export function normalizePresetSlots(raw: unknown, quantity: number): PresetSlots`
  - `export function resizePresetSlots(slots: PresetSlots, quantity: number): PresetSlots`
  - `export function presetSlotAt(slots: PresetSlots, drawIndex: number): string | null`
  - `export function uniqueNonEmptyIds(slots: PresetSlots): boolean`
  - `export function clearParticipantFromPresets(presets: PresetMap, participantId: string): PresetMap`

- [ ] **Step 1: Write the failing test**

Create `server/tests/presetSlots.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import {
  clearParticipantFromPresets,
  normalizePresetSlots,
  presetSlotAt,
  resizePresetSlots,
  uniqueNonEmptyIds,
} from "../src/domain/presetSlots.js";

describe("normalizePresetSlots", () => {
  it("pads a legacy string into slot 0", () => {
    expect(normalizePresetSlots("u1", 3)).toEqual(["u1", null, null]);
  });

  it("pads and trims arrays; treats empty string as null", () => {
    expect(normalizePresetSlots(["a", ""], 3)).toEqual(["a", null, null]);
    expect(normalizePresetSlots(["a", "b", "c", "d"], 2)).toEqual(["a", "b"]);
    expect(normalizePresetSlots(undefined, 2)).toEqual([null, null]);
  });
});

describe("resizePresetSlots", () => {
  it("grows with nulls and shrinks from the end", () => {
    expect(resizePresetSlots(["a"], 3)).toEqual(["a", null, null]);
    expect(resizePresetSlots(["a", "b", "c"], 1)).toEqual(["a"]);
  });
});

describe("presetSlotAt / uniqueNonEmptyIds", () => {
  it("reads a slot and rejects duplicate ids", () => {
    expect(presetSlotAt(["a", null], 0)).toBe("a");
    expect(presetSlotAt(["a", null], 1)).toBeNull();
    expect(uniqueNonEmptyIds(["a", "b", null])).toBe(true);
    expect(uniqueNonEmptyIds(["a", "a"])).toBe(false);
  });
});

describe("clearParticipantFromPresets", () => {
  it("nulls matching slots and drops all-null prizes", () => {
    const next = clearParticipantFromPresets(
      { p1: ["u1", null], p2: ["u2", "u1"] },
      "u1",
    );
    expect(next).toEqual({ p2: ["u2", null] });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm run test --prefix server -- tests/presetSlots.test.ts
```

Expected: FAIL — cannot find module。

- [ ] **Step 3: Write minimal implementation**

In `server/src/types.ts` replace `PresetMap`:

```typescript
export type PresetSlots = Array<string | null>;
export type PresetMap = Record<string, PresetSlots>;
```

Create `server/src/domain/presetSlots.ts`:

```typescript
import type { PresetMap, PresetSlots } from "../types.js";

function asId(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function normalizePresetSlots(raw: unknown, quantity: number): PresetSlots {
  const slots: PresetSlots = Array.from({ length: quantity }, () => null);
  if (typeof raw === "string") {
    slots[0] = asId(raw);
    return slots;
  }
  if (!Array.isArray(raw)) {
    return slots;
  }
  for (let i = 0; i < quantity && i < raw.length; i += 1) {
    slots[i] = asId(raw[i]);
  }
  return slots;
}

export function resizePresetSlots(slots: PresetSlots, quantity: number): PresetSlots {
  return normalizePresetSlots(slots, quantity);
}

export function presetSlotAt(slots: PresetSlots, drawIndex: number): string | null {
  if (drawIndex < 0 || drawIndex >= slots.length) {
    return null;
  }
  return slots[drawIndex] ?? null;
}

export function uniqueNonEmptyIds(slots: PresetSlots): boolean {
  const ids = slots.filter((s): s is string => typeof s === "string" && s.length > 0);
  return new Set(ids).size === ids.length;
}

export function clearParticipantFromPresets(presets: PresetMap, participantId: string): PresetMap {
  const next: PresetMap = {};
  for (const [prizeId, slots] of Object.entries(presets)) {
    const updated = slots.map((s) => (s === participantId ? null : s));
    if (updated.some((s) => s !== null)) {
      next[prizeId] = updated;
    }
  }
  return next;
}
```

Disk 上仍可能是旧字符串。路由读入后先 `normalizePresetSlots` 再当 `PresetMap` 用；`JsonStore<PresetMap>` 的 fallback 仍是 `{}`。读到旧格式时不要用未规范化的值写回，除非该次请求本就要写 presets。

- [ ] **Step 4: Run test to verify it passes**

```bash
npm run test --prefix server -- tests/presetSlots.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/src/types.ts server/src/domain/presetSlots.ts server/tests/presetSlots.test.ts
git commit -m "feat: add preset slot helpers"
```

---

### Task 3: canDraw 纯函数

**Files:**
- Create: `server/src/domain/canDraw.ts`
- Create: `server/tests/canDraw.test.ts`

**Interfaces:**
- Consumes: `drawnCountForPrize`、`prizeQuantity`、`presetSlotAt`、`listEligible` 的「池是否为空」用 `eligibleCount: number`
- Produces: `export function computeCanDraw(input: { prize: { id: string; quantity?: unknown } | null; winners: Array<{ prizeId: string }>; eligibleCount: number; slots: Array<string | null> }): boolean`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, expect, it } from "vitest";
import { computeCanDraw } from "../src/domain/canDraw.js";

const prize = { id: "p1", quantity: 2 };

describe("computeCanDraw", () => {
  it("is false without a prize or when complete", () => {
    expect(computeCanDraw({ prize: null, winners: [], eligibleCount: 1, slots: [null, null] })).toBe(false);
    expect(
      computeCanDraw({
        prize,
        winners: [{ prizeId: "p1" }, { prizeId: "p1" }],
        eligibleCount: 3,
        slots: [null, null],
      }),
    ).toBe(false);
  });

  it("is true when the current slot is preset even if eligible is empty", () => {
    expect(
      computeCanDraw({
        prize,
        winners: [{ prizeId: "p1" }],
        eligibleCount: 0,
        slots: [null, "u9"],
      }),
    ).toBe(true);
  });

  it("is true when eligible remains and the slot is empty", () => {
    expect(
      computeCanDraw({
        prize,
        winners: [],
        eligibleCount: 2,
        slots: [null, null],
      }),
    ).toBe(true);
  });

  it("is false when eligible is empty and the current slot is empty", () => {
    expect(
      computeCanDraw({
        prize,
        winners: [],
        eligibleCount: 0,
        slots: [null, "u9"],
      }),
    ).toBe(false);
  });
});
```

最后一例：未抽时当前槽是下标 0，空槽且无人可抽 → false。槽 1 的内定不影响第 1 次。

- [ ] **Step 2: Run test to verify it fails**

```bash
npm run test --prefix server -- tests/canDraw.test.ts
```

Expected: FAIL — cannot find module。

- [ ] **Step 3: Write minimal implementation**

Create `server/src/domain/canDraw.ts`:

```typescript
import { drawnCountForPrize, prizeQuantity } from "./prizeQuantity.js";
import { presetSlotAt } from "./presetSlots.js";

export function computeCanDraw(input: {
  prize: { id: string; quantity?: unknown } | null;
  winners: Array<{ prizeId: string }>;
  eligibleCount: number;
  slots: Array<string | null>;
}): boolean {
  if (!input.prize) {
    return false;
  }
  const quantity = prizeQuantity(input.prize);
  const drawn = drawnCountForPrize(input.winners, input.prize.id);
  if (drawn >= quantity) {
    return false;
  }
  const slot = presetSlotAt(input.slots, drawn);
  if (slot) {
    return true;
  }
  return input.eligibleCount > 0;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm run test --prefix server -- tests/canDraw.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/src/domain/canDraw.ts server/tests/canDraw.test.ts
git commit -m "feat: add canDraw helper without exposing preset names"
```

---

### Task 4: 奖品 API 校验 quantity 并同步内定长度

**Files:**
- Create: `server/tests/prizeQuantity.api.test.ts`
- Modify: `server/src/routes/prizes.ts`
- Modify: `server/src/routes/session.ts`（`currentPrize` 经 `normalizePrize`）
- Modify: `server/tests/api.wave2.test.ts`、`server/tests/e2e-smoke.test.ts`、`server/tests/participants.mutate.test.ts`、`server/tests/lottery.verification.test.ts`（所有奖品 PUT 补 `quantity: 1`）

**Interfaces:**
- Consumes: `normalizePrize`、`prizeQuantity`、`drawnCountForPrize`、`resizePresetSlots`、`normalizePresetSlots`
- Produces: `PUT /api/prizes` 每项必须含整数 `quantity` ≥ 1；小于已抽人数则 400，消息 ``该奖品已抽出 ${x} 人，数量不能小于 ${x}``；成功后按新数量 resize 该奖内定；`GET /api/prizes` 与 `public/view.currentPrize` 带 `quantity`（缺省当 1）

- [ ] **Step 1: Write the failing API test**

Create `server/tests/prizeQuantity.api.test.ts`（`makeDataDir` / `beforeEach` 与 `api.wave2.test.ts` 相同）。本任务不要测「连抽两次」（仍是一奖一次）。「数量小于已抽人数」放到 Task 6。

```typescript
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import request from "supertest";
import { createApp } from "../src/index.js";
import { createStores } from "../src/store/appStores.js";
import { clearSessionsForTests } from "../src/auth/adminAuth.js";

describe("prize quantity API", () => {
  let dataDir = "";
  let app: ReturnType<typeof createApp>;

  beforeEach(async () => {
    clearSessionsForTests();
    dataDir = await mkdtemp(path.join(os.tmpdir(), "lottery-qty-"));
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

  it("GET fills quantity 1 for prizes stored without it", async () => {
    const stores = createStores(dataDir);
    await stores.prizes.write([
      { id: "p1", name: "旧奖", imagePath: "a.png", order: 0 } as never,
    ]);
    const res = await request(app).get("/api/prizes");
    expect(res.status).toBe(200);
    expect(res.body[0].quantity).toBe(1);
  });

  it("PUT rejects missing or non-integer quantity", async () => {
    const login = await request(app).post("/api/admin/login").send({ passphrase: "admin123" });
    const token = login.body.token as string;
    const missing = await request(app)
      .put("/api/prizes")
      .set("Authorization", `Bearer ${token}`)
      .send([{ id: "p1", name: "A", imagePath: "a.png", order: 0 }]);
    expect(missing.status).toBe(400);
    const zero = await request(app)
      .put("/api/prizes")
      .set("Authorization", `Bearer ${token}`)
      .send([{ id: "p1", name: "A", imagePath: "a.png", order: 0, quantity: 0 }]);
    expect(zero.status).toBe(400);
  });

  it("PUT persists quantity", async () => {
    const login = await request(app).post("/api/admin/login").send({ passphrase: "admin123" });
    const token = login.body.token as string;
    const res = await request(app)
      .put("/api/prizes")
      .set("Authorization", `Bearer ${token}`)
      .send([{ id: "p1", name: "A", imagePath: "a.png", order: 0, quantity: 3 }]);
    expect(res.status).toBe(200);
    expect(res.body[0].quantity).toBe(3);
  });
});
```

本任务 PUT 成功时调用 `resizePresetSlots`（无该奖内定键则跳过）。现有测试奖品对象都加上 `quantity: 1` 后全绿。

- [ ] **Step 2: Run test to verify GET default fails**

```bash
npm run test --prefix server -- tests/prizeQuantity.api.test.ts
```

Expected: FAIL — `quantity` undefined。

- [ ] **Step 3: Implement prizes route + normalize on read**

`isValidPrize` 增加：

```typescript
typeof o.quantity === "number" &&
Number.isInteger(o.quantity) &&
o.quantity >= 1
```

`GET /api/prizes`：

```typescript
res.json((await stores.prizes.read()).map((p) => normalizePrize(p)));
```

`PUT /api/prizes`：校验通过后，读 `winners`，对每项若 `drawnCountForPrize(...) > quantity` 则 400 并 `return`。然后 `write(body)`。读 presets：对每个奖 `next[id] = resizePresetSlots(normalizePresetSlots(raw[id], quantity), quantity)`，空且全 null 的键可省略。写回 presets。

`session.ts` 的 `currentPrize` / `lastPrize` 用 `normalizePrize`。

把现有测试里每个奖品字面量加上 `quantity: 1`：

- `lottery.verification.test.ts` 的 `PrizeBody` 增加 `quantity: number`，`PRIZE_1` / `PRIZE_2` 设为 `1`
- `api.wave2.test.ts`、`e2e-smoke.test.ts`、`participants.mutate.test.ts` 每条奖品对象同样加上

「rejects prize without name」无需 quantity（本来就 400）。

- [ ] **Step 4: Run tests**

```bash
npm run test --prefix server -- tests/prizeQuantity.api.test.ts tests/api.wave2.test.ts tests/e2e-smoke.test.ts tests/participants.mutate.test.ts tests/lottery.verification.test.ts
```

Expected: PASS（draw 仍一奖一次；verification 仍断言「该奖品已开奖」，到 Task 6 再改）

- [ ] **Step 5: Commit**

```bash
git add server/src/routes/prizes.ts server/src/routes/session.ts server/tests
git commit -m "feat: require prize quantity and default it on read"
```

---

### Task 5: 内定槽 HTTP API 与删人清槽

**Files:**
- Create: `server/tests/presetSlots.api.test.ts`
- Modify: `server/src/routes/presets.ts`
- Modify: `server/src/routes/participants.ts`
- Modify: `server/src/routes/draw.ts`（读取当前槽：`presetSlotAt(normalizePresetSlots(raw, quantity), drawnCountBefore)`，此时 `drawnCountBefore` 仍因一奖一次而为 0）
- Modify: 所有 `.send({ participantId: ... })` 的 preset PUT 改为 `.send({ slots: [id] })`（quantity 1）

**Interfaces:**
- Consumes: `normalizePresetSlots`、`uniqueNonEmptyIds`、`clearParticipantFromPresets`、`prizeQuantity`
- Produces:
  - `GET /api/presets` → `Record<string, Array<string | null>>`（旧字符串已规范化）
  - `PUT /api/presets/:prizeId` body `{ slots: Array<string | null> }`，长度必须等于该奖 quantity；`""` 当 null；重复非空 id → 400「同一奖品不能重复内定同一人」；用户不存在 → 404「用户不存在」
  - 成功 `{ prizeId, slots }`
  - 不再接受仅 `participantId`

- [ ] **Step 1: Write the failing API tests**

`server/tests/presetSlots.api.test.ts` 覆盖：

- PUT `{ slots: [u1.id, u2.id] }` 而 quantity 为 1 → 400，消息「内定槽数量必须与奖品数量一致」
- PUT `{ slots: [u1.id, u1.id] }` quantity 2 → 400，「同一奖品不能重复内定同一人」
- PUT `{ slots: [u1.id, ""] }` quantity 2 → 200，body.slots 为 `[u1.id, null]`
- 磁盘写入字符串 `"u1"` 后 GET 在 quantity 3 的奖上返回 `["u1", null, null]`（先 PUT 奖 quantity 3，再直接 `stores.presets.write({ p1: "u1" as never })`）
- 删除未中奖用户后，该人槽被清空；若该奖只剩 null 则 GET 无该键（或全 null 数组，与 `clearParticipantFromPresets` 一致：无键）

- [ ] **Step 2: Run to verify fail**

```bash
npm run test --prefix server -- tests/presetSlots.api.test.ts
```

Expected: FAIL — 仍要求 `participantId`。

- [ ] **Step 3: Implement**

`presets.ts` PUT：

```typescript
const prize = prizes.find((p) => p.id === prizeId);
if (!prize) { res.status(404).json({ message: "奖品不存在" }); return; }
const quantity = prizeQuantity(prize);
if (!Array.isArray(req.body?.slots) || req.body.slots.length !== quantity) {
  res.status(400).json({ message: "内定槽数量必须与奖品数量一致" });
  return;
}
const slots = normalizePresetSlots(req.body.slots, quantity);
if (!uniqueNonEmptyIds(slots)) {
  res.status(400).json({ message: "同一奖品不能重复内定同一人" });
  return;
}
for (const id of slots) {
  if (id && !participants.some((p) => p.id === id)) {
    res.status(404).json({ message: "用户不存在" });
    return;
  }
}
const presets = await stores.presets.read();
const next = { ...presets, [prizeId]: slots };
if (slots.every((s) => s === null)) {
  delete next[prizeId];
}
await stores.presets.write(next);
res.json({ prizeId, slots });
```

GET：读 prizes 与 presets，对已有键 `normalizePresetSlots(value, prizeQuantity(prize) 或 value 长度)`。有 prize 用 prize 的 quantity。

`participants.ts` 删除单人：用 `clearParticipantFromPresets`。先把磁盘值规范成 `PresetMap`（对每个键用对应奖 quantity）。

`draw.ts`：`const raw = presets[prizeId]; const slots = normalizePresetSlots(raw, prizeQuantity(prize)); const presetId = presetSlotAt(slots, drawnCountForPrize(winners, prizeId));` 其余逻辑先保持「已有该 prizeId 则已抽完」。

把测试中的 preset 请求改为 `{ slots: [id] }`：

- `api.wave2.test.ts`
- `e2e-smoke.test.ts`
- `participants.mutate.test.ts`
- `lottery.verification.test.ts`（含 missing-user：`{ slots: ["missing-user"] }`）

- [ ] **Step 4: Run tests**

```bash
npm run test --prefix server
```

Expected: PASS（draw 仍一奖一次）

- [ ] **Step 5: Commit**

```bash
git add server/src/routes/presets.ts server/src/routes/participants.ts server/src/routes/draw.ts server/tests
git commit -m "feat: store prize presets as ordered slots"
```

---

### Task 6: 同一奖可抽 quantity 次

**Files:**
- Create: `server/tests/drawQuantity.api.test.ts`
- Modify: `server/src/routes/draw.ts`
- Modify: `server/tests/lottery.verification.test.ts`（「该奖品已开奖」→「该奖品已抽完」；可顺手断言 `prizeComplete`）
- Modify: `server/tests/prizeQuantity.api.test.ts`（补「数量不能小于已抽人数」）

**Interfaces:**
- Consumes: `isPrizeComplete`、`drawnCountForPrize`、`prizeQuantity`、`presetSlotAt`
- Produces: `POST /api/draw` 在条数 ≥ quantity 时 400「该奖品已抽完」；成功体增加 `drawnCount`、`quantity`、`prizeComplete`

- [ ] **Step 1: Write the failing tests**

```typescript
it("allows three draws for quantity 3 then rejects the fourth", async () => {
  // prizes quantity 3, three participants, no presets
  // POST draw x3 status 200; third body prizeComplete true, drawnCount 3, quantity 3
  // fourth 400 该奖品已抽完
});

it("uses slot 0 and slot 2 presets with random in between", async () => {
  // quantity 3, slots [甲, null, 丙], three plus extra eligible
  // first → 甲, third → 丙, second is one of remaining eligible and not 甲/丙
});
```

- [ ] **Step 2: Run to verify fail**

```bash
npm run test --prefix server -- tests/drawQuantity.api.test.ts
```

Expected: FAIL — 第二次 draw 仍「该奖品已开奖」。

- [ ] **Step 3: Implement draw.ts**

删除 `winners.some((w) => w.prizeId === prizeId)`。改为：

```typescript
const quantity = prizeQuantity(prize);
const drawnCountBefore = drawnCountForPrize(winners, prizeId);
if (drawnCountBefore >= quantity) {
  res.status(400).json({ message: "该奖品已抽完" });
  return;
}
const slots = normalizePresetSlots(presets[prizeId], quantity);
const presetId = presetSlotAt(slots, drawnCountBefore);
```

成功后：

```typescript
const drawnCount = drawnCountBefore + 1;
res.json({
  prizeId,
  prizeName: prize.name,
  participantId: winner.id,
  name: winner.name,
  drawnCount,
  quantity,
  prizeComplete: drawnCount >= quantity,
});
```

空槽且 `eligible.length === 0` 仍 400「没有可抽奖用户」。有 preset 时与现在一样不要求其在 eligible 中。

`lottery.verification.test.ts` 将 `该奖品已开奖` 改为 `该奖品已抽完`。

补 Task 4 推迟的「quantity < drawn count」API 测试。

- [ ] **Step 4: Run tests**

```bash
npm run test --prefix server
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/src/routes/draw.ts server/tests
git commit -m "feat: allow multiple draws per prize up to quantity"
```

---

### Task 7: public/view 的 canDraw

**Files:**
- Modify: `server/src/routes/session.ts`
- Create: `server/tests/canDraw.api.test.ts`（或并入 `drawQuantity.api.test.ts`）

**Interfaces:**
- Consumes: `computeCanDraw`、`normalizePrize`、`normalizePresetSlots`、`listEligible`
- Produces: `GET /api/public/view` 增加 `canDraw: boolean`，不出现内定 id 列表

- [ ] **Step 1: Write the failing test**

```typescript
it("canDraw is true when eligible is empty but the current slot is preset", async () => {
  // quantity 1, no participants, preset slots [existingUser] — 先加用户、设内定、删光其他人？ 
  // 更简：不加任何可抽用户，只加内定目标一人然后把他抽到别的奖？ 
  // 规格：池空但本槽有内定。做法：两人，奖 quantity 1 槽为甲；不要先抽空池。
  // 空池：不添加参与者，直接写 presets 指向不存在用户会 404。
  // 合法做法：添加甲，设槽 [甲]，再抽掉甲到另一奖，当前奖 quantity 1 槽仍为甲（可覆盖已中奖）。
  // 或：添加甲，全部中奖到 prize-other，当前奖槽 [甲]，eligible 为空，canDraw true。
});

it("canDraw is false when complete", async () => {
  // quantity 1, draw once, canDraw false
});
```

- [ ] **Step 2: Run to verify fail**

Expected: `canDraw` undefined。

- [ ] **Step 3: Implement**

在 `GET /api/public/view`：

```typescript
const currentPrize = currentRaw ? normalizePrize(currentRaw) : null;
const presets = await stores.presets.read();
const slots = currentPrize
  ? normalizePresetSlots(presets[currentPrize.id], prizeQuantity(currentPrize))
  : [];
const eligible = listEligible(participants, winners);
const canDraw = computeCanDraw({
  prize: currentPrize,
  winners,
  eligibleCount: eligible.length,
  slots,
});
```

响应增加 `canDraw`。`lastPrize` 同样 `normalizePrize`。

- [ ] **Step 4: Run**

```bash
npm run test --prefix server
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/src/routes/session.ts server/tests
git commit -m "feat: expose canDraw on public view"
```

---

### Task 8: 控制条开始/停与下拉文案

**Files:**
- Create: `client/src/screens/prizeOptionLabel.ts`
- Create: `client/src/screens/prizeOptionLabel.test.ts`
- Create: `client/src/screens/drawFlow.ts`
- Create: `client/src/screens/drawFlow.test.ts`
- Modify: `client/src/api/types.ts`
- Modify: `client/src/components/HostControlBar.tsx`
- Modify: `client/src/components/HostControlBar.test.tsx`

**Interfaces:**
- Consumes: 无服务端文件
- Produces:
  - `Prize.quantity: number`
  - `PublicView.canDraw: boolean`
  - `DrawResult.drawnCount: number; quantity: number; prizeComplete: boolean`
  - `export function prizeOptionLabel(p: { name: string; drawnCount: number; quantity: number }): string`
  - `export function startRollError(opts: { currentPrizeId: string | null; prizeComplete: boolean; canDraw: boolean }): string | null`
  - `export function afterHoldAction(prizeComplete: boolean): "winner" | "stay"`
  - `HostControlBar` 增加 `waitingForStop: boolean`、`onStop: () => void`；`prizes` 项为 `{ id, name, drawnCount, quantity }`

- [ ] **Step 1: Write failing tests**

`prizeOptionLabel.test.ts`：

```typescript
expect(prizeOptionLabel({ name: "一等奖", drawnCount: 0, quantity: 1 })).toBe("一等奖");
expect(prizeOptionLabel({ name: "一等奖", drawnCount: 1, quantity: 1 })).toBe("一等奖（已抽）");
expect(prizeOptionLabel({ name: "三等奖", drawnCount: 0, quantity: 3 })).toBe("三等奖（已抽 0/3）");
expect(prizeOptionLabel({ name: "三等奖", drawnCount: 1, quantity: 3 })).toBe("三等奖（已抽 1/3）");
expect(prizeOptionLabel({ name: "三等奖", drawnCount: 3, quantity: 3 })).toBe("三等奖（已抽）");
```

`drawFlow.test.ts`：

```typescript
expect(startRollError({ currentPrizeId: null, prizeComplete: false, canDraw: true })).toBe("未选择当前奖品，无法开奖");
expect(startRollError({ currentPrizeId: "p1", prizeComplete: true, canDraw: false })).toBe("该奖品已抽完");
expect(startRollError({ currentPrizeId: "p1", prizeComplete: false, canDraw: false })).toBe("没有可抽奖用户");
expect(startRollError({ currentPrizeId: "p1", prizeComplete: false, canDraw: true })).toBeNull();
expect(afterHoldAction(false)).toBe("stay");
expect(afterHoldAction(true)).toBe("winner");
```

`HostControlBar.test.tsx` 增加：`waitingForStop` 时主按钮文案「停」；点击调用 `onStop` 不调用 `onDraw`。现有屏序测试补上 `waitingForStop={false}` 与 `onStop`。

- [ ] **Step 2: Run to verify fail**

```bash
npm run test --prefix client -- src/screens/prizeOptionLabel.test.ts src/screens/drawFlow.test.ts
```

Expected: FAIL — modules missing。

- [ ] **Step 3: Implement**

`prizeOptionLabel.ts`：

```typescript
export function prizeOptionLabel(p: { name: string; drawnCount: number; quantity: number }): string {
  const complete = p.drawnCount >= p.quantity;
  if (complete) {
    return `${p.name}（已抽）`;
  }
  if (p.quantity === 1) {
    return p.name;
  }
  return `${p.name}（已抽 ${p.drawnCount}/${p.quantity}）`;
}
```

`drawFlow.ts`：

```typescript
export function startRollError(opts: {
  currentPrizeId: string | null;
  prizeComplete: boolean;
  canDraw: boolean;
}): string | null {
  if (!opts.currentPrizeId) {
    return "未选择当前奖品，无法开奖";
  }
  if (opts.prizeComplete) {
    return "该奖品已抽完";
  }
  if (!opts.canDraw) {
    return "没有可抽奖用户";
  }
  return null;
}

export function afterHoldAction(prizeComplete: boolean): "winner" | "stay" {
  return prizeComplete ? "winner" : "stay";
}
```

`types.ts`：`Prize` 加 `quantity`；`PublicView` 加 `canDraw`；`DrawResult` 加 `drawnCount`、`quantity`、`prizeComplete`。

`HostControlBar.tsx`：

```typescript
type PrizeOption = { id: string; name: string; drawnCount: number; quantity: number };

// props: waitingForStop: boolean; onStop: () => void;

const complete =
  currentPrizeId !== null &&
  prizes.some((p) => p.id === currentPrizeId && p.drawnCount >= p.quantity);

// 下拉 option 文本用 prizeOptionLabel(p)

<button
  type="button"
  className="primary"
  disabled={drawing || (!waitingForStop && (complete || !currentPrizeId))}
  onClick={() => {
    if (waitingForStop) onStop();
    else onDraw();
  }}
>
  {drawing ? "抽奖中…" : waitingForStop ? "停" : complete ? "已抽取" : "开始抽奖"}
</button>
```

`waitingForStop` 为 true 时不要因为 `drawing` 禁用「停」。约定：`drawing` 只表示减速或 3 秒停留；滚动等停时 `drawing=false`、`waitingForStop=true`。

- [ ] **Step 4: Run client tests**

```bash
npm run test --prefix client
```

Expected: PASS（PublicStage 尚未改，若类型报错则先在 PublicStage 传入新 props 的占位：`waitingForStop={false}` `onStop={() => undefined}`，并改 `prizes` 形状；宁可本任务顺手改 PublicStage 的 props 编译通过，行为仍旧，行为改到 Task 10）

若 `PublicStage.tsx` 因类型红，本步骤只补 props 让 `tsc` 过：`drawnCount: drawnPrizeIds.has(id) ? 1 : 0` 暂不正确，正确计数放到 Task 10。更干净：本任务改完 HostControlBar 后立刻改 PublicStage 的 **类型对齐**（`drawnCount` 用 `view.winners.filter`，`quantity` 从 `fetchPrizes` 全量 Prize 来）。

修改 `fetchPrizes` 返回 `Prize[]`。`PublicStage` 暂用：

```typescript
drawnCount: view.winners.filter((w) => w.prizeId === p.id).length,
quantity: p.quantity ?? 1,
```

开始/停行为仍是旧的一次 `onDraw` 里调 `startDraw`，直到 Task 10。此时「停」不会出现，因为 `waitingForStop` 仍 false。

- [ ] **Step 5: Commit**

```bash
git add client/src
git commit -m "feat: add stop control and prize progress labels"
```

---

### Task 9: 奖品屏进度与中奖屏多人

**Files:**
- Modify: `client/src/screens/PrizeScreen.tsx`
- Modify: `client/src/screens/PrizeScreen.test.tsx`
- Modify: `client/src/screens/WinnerScreen.tsx`
- Modify: `client/src/screens/WinnerScreen.test.tsx`
- Modify: `client/src/screens/winnerHistory.ts`
- Modify: `client/src/screens/winnerHistory.test.ts`
- Modify: `client/src/styles/stage.css`

**Interfaces:**
- Consumes: `Prize.quantity`
- Produces:
  - `PrizeScreen` props `{ prize, drawnCount }`，文案 `{quantity} 份 · 已抽 {drawnCount}/{quantity}`
  - `winnersForPrize(...)` → `Participant[]` 抽出顺序
  - `WinnerScreen` props `{ prize, winners: Participant[], history }`；1 人仍一个 `h1.winner-name`；多人用列表，每项同样 `winner-name highlight`

- [ ] **Step 1: Write failing tests**

`PrizeScreen.test.tsx`：传入 `quantity: 3`、`drawnCount: 1`，断言文本「3 份 · 已抽 1/3」。

`winnerHistory.test.ts`：

```typescript
expect(
  winnersForPrize(
    [
      { prizeId: "p1", participantId: "u1" },
      { prizeId: "p2", participantId: "u2" },
      { prizeId: "p1", participantId: "u3" },
    ],
    "p1",
    [
      { id: "u1", name: "甲" },
      { id: "u3", name: "丙" },
    ],
  ).map((p) => p.name),
).toEqual(["甲", "丙"]);
```

`WinnerScreen.test.tsx`：`winners={[{id:u1,name:甲},{id:u2,name:乙}]}` 两名都在文档中；单人数组仍能 `getByText("乙")`。

- [ ] **Step 2: Run to verify fail**

```bash
npm run test --prefix client -- src/screens/PrizeScreen.test.tsx src/screens/WinnerScreen.test.tsx src/screens/winnerHistory.test.ts
```

Expected: FAIL

- [ ] **Step 3: Implement**

`winnerHistory.ts` 增加：

```typescript
export function winnersForPrize(
  winners: Array<{ prizeId: string; participantId: string }>,
  prizeId: string | null,
  participants: Array<{ id: string; name: string }>,
): Array<{ id: string; name: string }> {
  if (!prizeId) {
    return [];
  }
  return winners
    .filter((w) => w.prizeId === prizeId)
    .map((w) => {
      const p = participants.find((x) => x.id === w.participantId);
      return p ?? { id: w.participantId, name: w.participantId };
    });
}
```

`PrizeScreen`：无奖仍「请选择当前奖品」；有奖时在 `h1` 下：

```tsx
<p className="sub">{prize.quantity} 份 · 已抽 {drawnCount}/{prize.quantity}</p>
```

`WinnerScreen`：

```tsx
{winners.length <= 1 ? (
  <h1 className="winner-name highlight">{winners[0]?.name ?? "—"}</h1>
) : (
  <ul className="winner-names">
    {winners.map((w) => (
      <li key={w.id} className="winner-name highlight">{w.name}</li>
    ))}
  </ul>
)}
```

CSS：

```css
.winner-names {
  list-style: none;
  padding: 0;
  margin: 0.4rem 0;
  display: grid;
  gap: 0.25rem;
  justify-items: center;
}
```

`PublicStage` 把 `winner={displayWinner}` 改为 `winners={winnersForPrize(...)}`，`PrizeScreen` 传入 `drawnCount`。本任务做完编译应过。

- [ ] **Step 4: Run**

```bash
npm run test --prefix client
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add client/src/screens client/src/styles/stage.css
git commit -m "feat: show prize remaining count and all winners of a prize"
```

---

### Task 10: 大屏开始滚动、点停开奖、抽满再进第四屏

**Files:**
- Modify: `client/src/screens/PublicStage.tsx`
- Create: `client/src/screens/PublicStage.test.tsx`

**Interfaces:**
- Consumes: `startRollError`、`afterHoldAction`、`startDraw`、`winnersForPrize`、`prizeOptionLabel`（经控制条）
- Produces: 点开始不请求 `/api/draw`；点停才请求；`prizeComplete === false` 时 3 秒后留在抽奖屏；`true` 时进中奖屏；选奖：抽完 → winner，否则 → prize；滚动等停时 `waitingForStop`

- [ ] **Step 1: Write the failing PublicStage test**

Mock `../api/client`：`fetchPublicView`、`fetchPrizes`、`patchSession`、`setCurrentPrize`、`startDraw`。

初始 view：`canDraw: true`，奖 `quantity: 3`，`winners: []`，若干 participants，`currentPrizeId: "p1"`，`publicScreen: "prize"`。

1. 点「开始抽奖」后 `startDraw` **未被调用**；`patchSession` 曾以 `{ publicScreen: "draw", drawPhase: "rolling" }` 调用。
2. 然后将 `startDraw` mock 为 `{ name: "甲", prizeComplete: false, drawnCount: 1, quantity: 3, ... }`。点「停」后 `startDraw` 被调用 1 次。
3. 用假计时器：需要让 `DrawScreen`/`NameTicker` 触发 `onSettled`。为避免真滚动，在测试里 `vi.mock("./DrawScreen", ...)`：当 `settleName` 非空时 `useEffect` 调 `onSettled`。

停留 3000ms 后：`prizeComplete false` 时 **不要** `patchSession` 含 `publicScreen: "winner"`。

再写一例：`startDraw` 返回 `prizeComplete: true`，`onSettled` + 3000ms 后出现对 `publicScreen: "winner"` 的 patch。

点开始时 `canDraw: false` 应显示「没有可抽奖用户」且不 patch 到 draw。

- [ ] **Step 2: Run to verify fail**

```bash
npm run test --prefix client -- src/screens/PublicStage.test.tsx
```

Expected: FAIL — 开始仍立即 `startDraw`。

- [ ] **Step 3: Implement PublicStage**

拆 `onDraw`：

`onStartRoll`：

```typescript
const err = startRollError({
  currentPrizeId: view.session.currentPrizeId,
  prizeComplete: isPrizeComplete(view.winners, view.session.currentPrizeId ?? "", view.currentPrize?.quantity ?? 1),
  canDraw: view.canDraw,
});
if (err) { setError(err); return; }
// snapshot names, rollingRef true, setRolling true, settleName null
// patchSession draw/rolling — 不调用 startDraw
```

前端 `isPrizeComplete`：不要从 server domain import；用 `drawnCount >= quantity` 内联或从 `drawFlow.ts` 再导出一个 `isComplete(drawnCount, quantity)`。加到 `drawFlow.ts`：

```typescript
export function isComplete(drawnCount: number, quantity: number): boolean {
  return drawnCount >= quantity;
}
```

并补一条单测。

`onStop`：若不是 `rollingRef` 或已有 `settleName` 则 return；`startDraw()`；成功则 `setSettleName`、把 `prizeCompleteRef.current = result.prizeComplete`。失败则停滚动、setError、不计数。

`onRollingSettled`：3 秒后：

```typescript
if (afterHoldAction(prizeCompleteRef.current) === "winner") {
  void goScreen("winner", true);
} else {
  holdingRef.current = false;
  setHolding(false);
}
```

`waitingForStop={rolling && settleName === null}`  
`drawing={holding || (rolling && settleName !== null)}`

`onSelectPrize`：`complete = drawnCount >= quantity`（用该奖 quantity，缺省 1），`publicScreen: complete ? "winner" : "prize"`。

手动切屏逻辑保持：`fromAutoReveal` 以外清 rolling/hold，并 `skipRevealRef = true`。

错误文案「该奖品已开奖」全部改为走 `startRollError`（「该奖品已抽完」）。

- [ ] **Step 4: Run**

```bash
npm run test --prefix client
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add client/src/screens
git commit -m "feat: start rolls without drawing; stop reveals winner"
```

---

### Task 11: 管理页、种子数据、README

**Files:**
- Modify: `client/src/admin/AdminPage.tsx`
- Modify: `data/prizes.json`（每条 `quantity: 1`）
- Modify: `README.md`

**Interfaces:**
- Consumes: `PUT /api/prizes` 含 quantity；`PUT /api/presets/:id` `{ slots }`；`GET /api/presets` 槽数组
- Produces: 管理页可编辑数量；每奖 N 个「第 k 次」下拉；README 描述数量、停按钮、抽满公示

- [ ] **Step 1: Write failing admin behavior tests if cheap; otherwise 手工清单进 README**

无现成 AdminPage 单测。本任务不强制新测文件。实现后跑：

```bash
npm run test --prefix client
npm run test --prefix server
```

Expected: 仍 PASS。

- [ ] **Step 2: Implement AdminPage**

`presets` 状态改为 `Record<string, Array<string | null>>`。

`addPrize` 带 `quantity: 1`。

奖品行增加：

```tsx
<label>
  数量
  <input
    type="number"
    min={1}
    value={p.quantity}
    onChange={(e) => updatePrize(index, { quantity: Number(e.target.value) })}
  />
</label>
```

内定区：

```tsx
{prizes.map((p) => {
  const slots = presets[p.id] ?? Array.from({ length: p.quantity }, () => null);
  return (
    <div key={`preset-${p.id}`}>
      <strong>{p.name}</strong>
      {Array.from({ length: p.quantity }, (_, i) => (
        <label key={`${p.id}-${i}`}>
          第{i + 1}次
          <select
            value={slots[i] ?? ""}
            onChange={(e) => {
              const next = Array.from({ length: p.quantity }, (__, j) => slots[j] ?? null);
              next[i] = e.target.value.length > 0 ? e.target.value : null;
              void savePresetSlots(p.id, next);
            }}
          >
            <option value="">未内定（随机）</option>
            {participants.map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
        </label>
      ))}
    </div>
  );
})}
```

`savePresetSlots`：`PUT` `{ slots }`；空槽用 `null`。

`load` 时 `setPresets` 接受数组；若仍收到字符串（不应发生）则当单槽。

说明文案改为：可按抽奖次序填写最多 N 个内定，空槽随机。

- [ ] **Step 3: Seed + README**

`data/prizes.json` 每条增加 `"quantity": 1`。不要改写 `data/presets.json` 的旧字符串（运行时 GET/开奖会规范化）。可选：不提交现场 presets，以免把测试数据当规范。

`README.md`「现场流程」第 4–5 步改为：

- `/admin` 设置每个奖的数量与按次内定（可选）。
- 大屏选奖后点「开始抽奖」滚动，点「停」开奖并减速停名；每次选中停留约 3 秒。同一奖未抽满则继续开始/停；抽满后自动进中奖公示，上方为本奖全部中奖人。

「默认奖品」补一句：未写数量的旧数据按 1 份处理。

- [ ] **Step 4: Run full tests**

```bash
npm run test --prefix server
npm run test --prefix client
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add client/src/admin/AdminPage.tsx data/prizes.json README.md
git commit -m "feat: admin quantity and per-draw presets; document host stop flow"
```

---

## 手工验收（计划执行完后）

1. `/admin` 将某奖数量设为 3，第 1、3 次内定两人，保存。
2. 大屏选该奖，开始 → 滚动且未产生中奖记录 → 停 → 高亮 3 秒仍留抽奖屏。
3. 再开始/停两次；第三次 3 秒后进第四屏，上方三人，下方总名单三行同一奖名。
4. 未抽满时下拉为「已抽 a/3」；抽满为「已抽」。
5. 滚动中切走：无新中奖记录，不会自动跳第四屏。

---

## Spec coverage（自检）

| 规格 | 任务 |
|------|------|
| `quantity` 缺省 1、PUT 校验、小于已抽人数 | 1, 4, 6 |
| 同一奖 N 条 winners、抽满判定 | 6 |
| 内定槽、旧字符串、重复、删人清槽 | 2, 5 |
| 点开始不调 draw、点停才调 | 10 |
| 每次 3 秒；未满留抽奖屏；满了进第四屏 | 8, 10 |
| 第四屏本奖全部中奖人 | 9 |
| 奖品屏进度 | 9 |
| 控制条停 / a/b / 已抽取 | 8 |
| `canDraw` 不泄露内定 | 3, 7 |
| Admin 数量与 N 下拉 | 11 |
| README | 11 |
| verification「已抽完」文案 | 6 |
| 非目标（一次抽出多人、客户端定人、session 状态机） | 不实现 |
