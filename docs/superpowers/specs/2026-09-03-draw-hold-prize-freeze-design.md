# 抽奖停稳、切奖时机与滚动名单设计

**日期：** 2026-09-03  
**状态：** 口头设计已逐段确认；书面规格待审阅  
**范围：** 修四条现场缺陷：抽满后下拉框/抽奖屏进中奖屏再切下一奖；点停后再滚 40ms 定人；停留期显示的人与公示一致；滚动只含未中奖者。不改开奖算法、3 秒停留、四屏顺序、内定、XML、配奖。

---

## 1. 背景与目标

### 1.1 现状

- 点停后 `POST /api/draw` 抽出中奖人；抽满时服务端立刻把 `session.currentPrizeId` 改成下一未抽完奖。
- 前端 `onStop` 后 `refresh()`，抽奖屏和下拉框立刻跟新的 `currentPrizeId`。停留 3 秒期间画面可能已是下一奖，高亮的却是刚抽这一奖的人；进中奖屏后公示刚抽完的奖，看起来像「停稳的人」和「公示」对不上。
- `NameTicker`：`ROLL_MS = 800`，`TICK_MS = 40`。点停后还要再滚约 800ms 才停稳。
- 开始滚动时 `tickerNames` 取自全部 `participants`，已中奖者仍出现在循环里。
- 停稳后 `SETTLE_HOLD_MS = 3000`；抽满进中奖屏，未抽满留在抽奖屏。中奖屏展示奖由 `winnerScreenPrizeId` 决定（当前奖未抽完时用 `lastWinnerPrizeId`）。

### 1.2 已确认需求

| 维度 | 选择 |
|------|------|
| 下拉框/抽奖屏何时改下一奖 | 3 秒停留结束、进入中奖屏时，而不是点停后立刻（方案 A） |
| 点停到停稳 | 再滚 **40ms**（`ROLL_MS = 40`） |
| 滚动名单 | 只含还没中奖的人（开转时的 `eligible`） |
| 服务端抽满写下一奖 | 保持现有：`POST /api/draw` 抽满即改 `currentPrizeId` |
| 3 秒停留 | 仍为 3000ms |

### 1.3 目标

- 抽满停留期间：下拉框、抽奖屏奖品名/图、高亮姓名都属于刚抽的这一奖；进中奖屏后公示同一批人，下拉框这时才是下一奖。
- 点停后约 40ms 停到中奖人并高亮。
- 之后各轮滚动不再出现已中奖者；当场停稳仍能停到刚抽出的人。

### 1.4 非目标

- 改后端抽奖、内定、不可重复中奖、数量含义。
- 把 `currentPrizeId` 的写入推迟到进中奖屏（方案 B）。
- 缩短或取消 3000ms 停留。
- 真实减速曲线；点停瞬间零再滚（0ms）。
- 改 XML 名单、配奖页、管理页、音效、公网部署。

---

## 2. 时间线

### 2.1 抽满当前奖

1. 点「开始抽奖」（仅抽奖屏）：`tickerNames` = 当时 `view.eligible` 的姓名（顺序与数组一致）。下拉框与抽奖屏显示开转时的当前奖。进入滚动。
2. 点「停」：立刻 `POST /api/draw`。服务端写中奖；若抽满则 `currentPrizeId` 改为下一未抽完奖（没有则保持）。响应含中奖姓名与 `prizeComplete`。
3. 前端拿到姓名后：`ROLL_MS = 40` 再滚，然后停到该人并高亮。`tickerNames` 本轮不再被 `refresh` 换成新的 eligible（刚中的人已不在 eligible 里，必须留在本轮名单里才能停稳）。
4. 高亮后再停留 3000ms。此期间抽奖屏和下拉框仍显示**刚抽的这一奖**（开转/点停时的奖），不显示 session 里可能已经换成的下一奖。
5. 3000ms 结束自动进中奖屏：公示刚抽完这一奖的全部中奖人（现有 `winnerScreenPrizeId`）。下拉框改为 session 的 `currentPrizeId`（下一奖或最后一奖）。
6. 之后切到抽奖屏/奖品屏：跟 session 当前奖。

### 2.2 未抽满

步骤 1–4 相同，但服务端不改 `currentPrizeId`。3 秒后留在抽奖屏，奖不变。再点开始时重新取 `eligible`，刚中的人不再进入滚动。

### 2.3 显示用的奖（冻住）

滚动、再滚、3 秒停留期间（`rolling || holding`）：

- 抽奖屏奖品、控制条下拉框选中项：用冻住的奖 ID（开转时的 `currentPrizeId`；点停后也可用本次开奖的奖，与开转同一奖）。
- 不因 `refresh` 后的 `session.currentPrizeId` 改画面。

离开停留并进入中奖屏（自动 `goScreen("winner", true)`）之后：下拉框跟 `session.currentPrizeId`。中奖屏内容仍按现有规则公示刚抽完的奖，不跟下拉框走。

主持人在滚动/停留中手切其它屏：取消尚未执行的自动进中奖屏（现有 `skipReveal`）。解冻，之后下拉框跟 session（抽满时可能已是下一奖）。不把服务端已写下的下一奖回滚。

没有下一奖：冻住与解冻都是最后一奖。

---

## 3. 组件改动（最小集合）

| 位置 | 改动 |
|------|------|
| `client/src/components/NameTicker.tsx` | `ROLL_MS`：800 → 40 |
| `client/src/components/NameTicker.test.ts` | 断言改为 40 |
| `client/src/screens/PublicStage.tsx` | 开转用 eligible；冻住显示奖；本轮 ticker 不被 refresh 抽掉刚中的人 |
| `client/src/screens/PublicStage.test.tsx` | 停留期内下拉框/抽奖屏仍为刚抽的奖；进中奖屏后下拉框为下一奖；滚动名单来自 eligible |
| `README.md` | 「约 1 秒内停到」改为点停后约 40ms 停稳并高亮；抽满后进中奖屏时下拉框才变下一奖 |

不改：`settleHold.ts` 的 3000、`POST /api/draw`、`nextIncompletePrizeId`、`winnerScreenPrizeId` 语义、`EnrollScreen`、server 开奖。

可用 ref 保存 `displayPrizeId`（开转写入，`holding` 结束且自动进中奖屏或手切屏后清掉）。不要新接口、不要新 session 字段。

---

## 4. 错误与边界

| 情况 | 行为 |
|------|------|
| 接口尚未返回 | 仍滚动；未定人 |
| 返回后 40ms 内 | 再滚然后停到返回的姓名 |
| 姓名不在本轮 `tickerNames` | 现有 `pickSettleIndex`：找不到则下标 0 |
| `refresh` 轮询（3s）发生在停留期 | 更新 winners/session，但不改本轮 ticker，不改冻住的显示奖 |
| 全部奖抽完 | 进最后一奖中奖屏；下拉框仍是它；「开始抽奖」为已抽取 |
| 手切屏 | 不解冻回上一奖；只取消自动跳转 |

---

## 5. 验收

- 抽满：点停后至进中奖屏前，下拉框与抽奖屏奖品仍是刚抽的奖；高亮姓名属于该奖；中奖屏公示该奖中奖人（含刚抽的人）。进中奖屏后下拉框为下一未抽完奖（若有）。
- `ROLL_MS === 40`；`TICK_MS` 仍为 40。`NameTicker.settle.test.tsx` 仍相对 `ROLL_MS` 计时。
- 开转后滚动名单不含已中奖者；同一奖再抽或下一奖再抽，上一轮中奖人不再出现。
- 未抽满 3 秒后留在抽奖屏；手切屏仍取消自动进中奖屏。
- 现有「进中奖屏后公示刚抽完的奖」成立。不新增 npm 依赖。不改后端测试所锁定的 `POST /api/draw` 抽满即改 `currentPrizeId`。
