# 点停后 1 秒内停到中奖人 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 点「停」且开奖成功后，抽奖屏在 800ms 内停到后台抽出的中奖人并高亮；滚动一格改为 40ms；停稳后仍停留 3 秒。

**Architecture:** 只改 `NameTicker` 的两个时长。开奖仍在点停时 `POST /api/draw`，停稳回调与 `startSettleHold(3000)` 不变。不引入减速算法、不立刻定格。

**Tech Stack:** Vite + React 18（`client/`）、Vitest + Testing Library、现有 Express 后端（本变更不改 server）

## Global Constraints

- 对照 `docs/superpowers/specs/2026-09-01-draw-stop-settle-1s-design.md`；不扩大范围。
- `ROLL_MS = 800`（从拿到中奖姓名起算）；`TICK_MS = 40`（点停前与点停后再滚都用它）。
- 停稳后停留仍为 `SETTLE_HOLD_MS = 3000`。不改 `settleHold.ts`。
- 中奖人仍由 `POST /api/draw` 决定，不由点停瞬间屏幕上的名字决定。
- 不改 `PublicStage` 开奖时序、后端路由、内定、奖品数量、管理页。
- 不新加 npm 依赖。不改四屏顺序、控制条文案含义。
- 实现前须用户明确允许改代码；获准后按本计划改。本仓库是 TypeScript，不适用 C++ 定宽整型 / 头文件实现等规则。

---

## File Map

| 文件 | 职责 |
|------|------|
| `client/src/components/NameTicker.tsx` | 导出 `ROLL_MS`、`TICK_MS`；再滚与滚动间隔用这两个常量 |
| `client/src/components/NameTicker.test.ts` | 现有 `tickerMath` 辅助测试 + 常量断言 |
| `client/src/components/NameTicker.settle.test.tsx` | 假计时器：799ms 未停稳，800ms 停稳并调用 `onSettled` |
| `README.md` | 现场流程第 5 步：点停后约 1 秒内停名高亮，再停留约 3 秒 |

不改：`PublicStage.tsx`、`settleHold.ts`、`DrawScreen.tsx`、`server/**`。

---

### Task 1: NameTicker 再滚 800ms、滚动 40ms 一格

**Files:**
- Modify: `client/src/components/NameTicker.test.ts`
- Create: `client/src/components/NameTicker.settle.test.tsx`
- Modify: `client/src/components/NameTicker.tsx`

**Interfaces:**
- Consumes: `buildCycle`、`pickSettleIndex`（`client/src/components/tickerMath.ts`，不改）
- Produces:
  - `export const ROLL_MS = 800`
  - `export const TICK_MS = 40`
  - `NameTicker` 在 `rolling && settleName` 时于 `ROLL_MS` 后停稳并调用 `onSettled`；滚动 `setInterval` 间隔为 `TICK_MS`

- [ ] **Step 1: Write the failing tests**

在 `client/src/components/NameTicker.test.ts` 增加常量断言（保留现有 helper 用例）：

```typescript
import { describe, expect, it } from "vitest";
import { ROLL_MS, TICK_MS } from "./NameTicker";
import { buildCycle, pickSettleIndex } from "./tickerMath";

describe("NameTicker helpers", () => {
  it("includes all names in cycle list", () => {
    expect(buildCycle(["a", "b"])).toEqual(["a", "b"]);
  });

  it("finds settle index for winner", () => {
    expect(pickSettleIndex(["甲", "乙", "丙"], "乙")).toBe(1);
  });
});

describe("NameTicker timing constants", () => {
  it("settles 800ms after winner is known and ticks every 40ms", () => {
    expect(ROLL_MS).toBe(800);
    expect(TICK_MS).toBe(40);
  });
});
```

创建 `client/src/components/NameTicker.settle.test.tsx`：

```tsx
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NameTicker, ROLL_MS } from "./NameTicker";

describe("NameTicker settle delay", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("does not settle before ROLL_MS and settles at ROLL_MS", () => {
    const onSettled = vi.fn();
    render(
      <NameTicker
        names={["甲", "乙", "丙"]}
        rolling
        settleName="乙"
        onSettled={onSettled}
      />,
    );

    expect(onSettled).not.toHaveBeenCalled();
    expect(document.querySelector(".ticker")).not.toHaveClass("settled");

    act(() => {
      vi.advanceTimersByTime(ROLL_MS - 1);
    });
    expect(onSettled).not.toHaveBeenCalled();
    expect(document.querySelector(".ticker")).not.toHaveClass("settled");

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(onSettled).toHaveBeenCalledTimes(1);
    expect(document.querySelector(".ticker")).toHaveClass("settled");
    expect(screen.getByText("乙")).toHaveClass("focus");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
npm run test --prefix client -- src/components/NameTicker.test.ts src/components/NameTicker.settle.test.tsx
```

Expected: FAIL。`NameTicker.test.ts` 报 `ROLL_MS` / `TICK_MS` 未导出，或值不是 800 / 40。若常量测试因未导出而整文件无法加载，`settle` 测试可能尚未跑到；先修导出与取值后再确认 settle 用例在改 `ROLL_MS` 前会失败（当前内部超时是 2800，推进 800ms 时 `onSettled` 仍不应被调用——该用例在实现前应在 800ms 处失败：期望已停稳，实际未停稳）。

- [ ] **Step 3: Write minimal implementation**

改 `client/src/components/NameTicker.tsx`：导出常量，滚动间隔用 `TICK_MS`，再滚超时用 `ROLL_MS`。完整文件：

```tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { buildCycle, pickSettleIndex } from "./tickerMath";

type Props = {
  names: string[];
  rolling: boolean;
  settleName: string | null;
  onSettled?: () => void;
};

export const ROLL_MS = 800;
export const TICK_MS = 40;

export function NameTicker({ names, rolling, settleName, onSettled }: Props) {
  const cycle = useMemo(() => buildCycle(names), [names]);
  const [offset, setOffset] = useState(0);
  const [settled, setSettled] = useState(false);
  const onSettledRef = useRef(onSettled);
  onSettledRef.current = onSettled;
  const settledOnceRef = useRef(false);

  useEffect(() => {
    if (!rolling || cycle.length === 0) {
      return;
    }
    settledOnceRef.current = false;
    setSettled(false);

    const tick = window.setInterval(() => {
      setOffset((v) => (v + 1) % cycle.length);
    }, TICK_MS);

    return () => {
      window.clearInterval(tick);
    };
  }, [rolling, cycle]);

  useEffect(() => {
    if (!rolling || !settleName || cycle.length === 0 || settledOnceRef.current) {
      return;
    }
    const settleTimer = window.setTimeout(() => {
      if (settledOnceRef.current) {
        return;
      }
      settledOnceRef.current = true;
      const idx = pickSettleIndex(cycle, settleName);
      setOffset(idx);
      setSettled(true);
      onSettledRef.current?.();
    }, ROLL_MS);
    return () => {
      window.clearTimeout(settleTimer);
    };
  }, [rolling, settleName, cycle]);

  if (cycle.length === 0) {
    return <div className="ticker empty">暂无参与用户</div>;
  }

  const current = cycle[offset % cycle.length] ?? "";
  const prev = cycle[(offset - 1 + cycle.length) % cycle.length] ?? "";
  const next = cycle[(offset + 1) % cycle.length] ?? "";

  return (
    <div className={`ticker ${rolling && !settled ? "rolling" : ""} ${settled ? "settled" : ""}`}>
      <div className="ticker-item dim">{prev}</div>
      <div className="ticker-item focus">{current}</div>
      <div className="ticker-item dim">{next}</div>
    </div>
  );
}
```

不要改 JSX 结构、不要改 `pickSettleIndex` 停稳逻辑、不要改 `onSettled` 调用时机以外的行为。

- [ ] **Step 4: Run tests to verify they pass**

Run:

```bash
npm run test --prefix client -- src/components/NameTicker.test.ts src/components/NameTicker.settle.test.tsx
```

Expected: PASS，上述文件全部通过。

- [ ] **Step 5: Commit**

```bash
git add client/src/components/NameTicker.tsx client/src/components/NameTicker.test.ts client/src/components/NameTicker.settle.test.tsx
git commit -m "feat: settle draw ticker within 800ms at 40ms ticks"
```

---

### Task 2: README 现场说明与回归

**Files:**
- Modify: `README.md`（现场流程第 5 步，约第 69 行）
- Test: `client/src/components/settleHold.test.ts`（不改代码，只跑）
- Test: `client/src/screens/PublicStage.test.tsx`（不改代码，只跑）

**Interfaces:**
- Consumes: Task 1 的 `ROLL_MS` / `TICK_MS`（本任务不引用代码接口）
- Produces: README 与规格一致的现场描述；确认 3 秒停留与点停才开奖的现有测试仍过

- [ ] **Step 1: Update README**

把 `README.md` 现场流程第 5 步从：

```markdown
5. 大屏选奖后点「开始抽奖」滚动，点「停」开奖并减速停名；每次选中停留约 3 秒。同一奖未抽满则继续开始/停；抽满后自动进中奖公示，上方为本奖全部中奖人。
```

改为：

```markdown
5. 大屏选奖后点「开始抽奖」滚动，点「停」开奖；约 1 秒内停到中奖人并高亮，再停留约 3 秒。同一奖未抽满则继续开始/停；抽满后自动进中奖公示，上方为本奖全部中奖人。
```

不要改 README 其他段落。

- [ ] **Step 2: Run regression tests**

Run:

```bash
npm run test --prefix client -- src/components/settleHold.test.ts src/screens/PublicStage.test.tsx src/components/NameTicker.test.ts src/components/NameTicker.settle.test.tsx
```

Expected: PASS。

- `settleHold.test.ts`：`SETTLE_HOLD_MS === 3000`，2999ms 不跳、3000ms 跳。
- `PublicStage.test.tsx`：点开始不调用 `startDraw`；点停才调用；未抽满停留后不进中奖屏；抽满后进中奖屏。该文件 mock 了 `DrawScreen`，停稳是立即的，只覆盖开奖时序与 3000ms 停留，不覆盖 800ms 再滚（再滚由 Task 1 的 settle 测试覆盖）。

若失败：只修本变更引入的问题；不要为了过测试去改 `PublicStage` 的开奖时序。

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: describe 1s stop-to-winner on the draw screen"
```

---

## 手工验收（计划执行完毕后）

1. 大屏选奖，点「开始抽奖」：名字按约 40ms 一格滚动（比以前快）。
2. 点「停」：约 1 秒内停到中奖人并高亮（不要再空转约 2.8 秒）。
3. 高亮后再等约 3 秒：未抽满可再点「开始抽奖」；抽满进入中奖屏。
4. 点停后按钮为「抽奖中…」直到 3 秒停留结束。

不测：多设备逐帧对齐、音效、公网、真实网络下墙钟是否严格小于 1000ms。
