# 奖品页与中奖页开始抽奖设计

**日期：** 2026-09-03  
**状态：** 口头设计已逐段确认；书面规格待审阅  
**范围：** 奖品页、以及「公示的就是当前奖」的中奖页，可点「开始抽奖」，一点即切到抽奖页并开转。参与页与抽满后公示上一奖的中奖页仍置灰。不改开奖算法、自动切下一奖、3 秒停留、冻奖、后端接口。

---

## 1. 背景与目标

### 1.1 现状

- 控制条只有一个主按钮。抽奖页、当前奖未抽满、未在滚动/停留时，文案为「开始抽奖」且可点。
- `HostControlBar` 与 `PublicStage.onStartRoll` 都要求当前屏是抽奖页。奖品页、中奖页、参与页上按钮置灰；即使点到也会被 `onStartRoll` 直接 return。
- 点开始后：冻住当前奖、用当时未中奖名单滚动，`patchSession({ publicScreen: "draw", drawPhase: "rolling" })`。开奖仍是点「停」才 `POST /api/draw`。
- 一奖抽满后：服务端把 `currentPrizeId` 改成下一未抽完奖；中奖页用 `winnerScreenPrizeId` 公示刚抽完的奖。下拉框已是下一奖，中奖画面仍是上一奖。

### 1.2 已确认需求

| 维度 | 选择 |
|------|------|
| 参与页 | 仍不能开抽 |
| 奖品页 | 当前奖未抽满时可点；一点切到抽奖页并开转 |
| 中奖页（提前进入，公示的就是当前未抽满奖） | 可点；一点切到抽奖页并开转 |
| 中奖页（抽满后公示上一奖，下拉框已是下一奖） | 仍置灰；先切到奖品页或抽奖页再开下一奖 |
| 实现 | 复用现有 `onStartRoll`，只放宽「从哪一页可以点」 |
| 开奖时机 | 仍是点「停」才 `POST /api/draw`，点开始不抽人 |

### 1.3 目标

- 看完奖品介绍可直接开抽，不必先点「抽奖」再点「开始抽奖」。
- 同一奖未抽满时，提前切到中奖页也能直接开抽。
- 抽满后的中奖公示不会被误触成下一奖开转。

### 1.4 非目标

- 参与页开抽。
- 抽满后的中奖页直接抽下一奖。
- 点开始就请求开奖。
- 大屏上另加开始按钮。
- 新增 session 字段或改后端 `/api/draw`、自动切下一奖、3 秒停留、冻奖、XML、配奖、管理页。

---

## 2. 可点规则

同一物理按钮，文案规则不变：等待点停时为「停」；减速/停留时为禁用的「抽奖中…」；当前奖已抽满为禁用的「已抽取」；其余为「开始抽奖」。

「开始抽奖」可点，必须同时满足：

1. 不在滚动、点停后再滚、3 秒停留里。
2. 已选当前奖，且这一奖还没抽满。
3. 当前视觉屏幕允许开转，见下表。

| 视觉屏幕 | 当前奖未抽满 | 「开始抽奖」 |
|----------|--------------|--------------|
| 参与 | 置灰 | 不能开转 |
| 奖品 | 可点 | 切到抽奖页并开转 |
| 抽奖 | 可点 | 开转（现状） |
| 中奖，且公示奖 ID = 当前奖 ID | 可点 | 切到抽奖页并开转 |
| 中奖，且公示奖 ID ≠ 当前奖 ID | 置灰 | 抽满后下拉框已是下一奖、画面仍是刚抽完的奖 |
| 任一页，未选奖或当前奖已抽满 | 置灰 | 文案「已抽取」（已抽满时） |

中奖页不能只看「当前奖未抽满」。抽满后 `session.currentPrizeId` 已经是下一奖（未抽满）；只看这个会在中奖页误亮，一点就抽下一奖。必须再比：`winnerScreenPrizeId` 与当前奖 ID 相同。

当前奖 ID 在控制条里仍是现有的 `visiblePrizeId`（滚动/停留时冻住的奖，其余时候是 `session.currentPrizeId`）。奖品页、中奖页不在滚动中，因此就是 session 当前奖。

### 2.1 中奖页两种现场

**提前进入（可开转）：** 当前奖未抽满。`lastWinnerPrizeId` 为空，或与当前奖相同（同一奖已抽出部分）。`winnerScreenPrizeId` 等于当前奖。按钮可点。

**抽满后自动进入（不可开转）：** 刚抽完的奖已满，session 已切到下一奖。`winnerScreenPrizeId` 为刚抽完的奖，与 `currentPrizeId` 不同。按钮置灰。主持人切到奖品页或抽奖页后，按奖品/抽奖页规则开下一奖。

离开中奖页再回来、只要公示奖仍不是当前奖，开始按钮仍置灰。全部奖抽完时当前奖已满，按钮为「已抽取」。

---

## 3. `canStartRollFromScreen`

新纯函数，放在 `client/src/screens/drawFlow.ts`，与 `startRollError` 并列。

输入：

- `screen`：当前视觉屏幕
- `currentPrizeId`：当前奖 ID（控制条所用，可空）
- `winnerPrizeId`：中奖页公示奖 ID（可空；非中奖页可传 `winnerScreenPrizeId` 的现有计算结果）
- `prizeComplete`：当前奖是否抽满

返回 `boolean`：

1. `currentPrizeId` 为空，或 `prizeComplete` 为 true → `false`
2. `screen === "enroll"` → `false`
3. `screen === "prize"` 或 `"draw"` → `true`
4. `screen === "winner"` → `winnerPrizeId === currentPrizeId`（二者都有值且相等才 `true`）
5. 其它 → `false`

滚动/停留是否可点仍由控制条现有的 `drawing` / `waitingForStop` 处理，不放进这个函数。`waitingForStop` 时按钮是可点的「停」，与现在相同。

`startRollError` 仍负责未选奖、已抽满、没有可抽用户的中文提示。`canStartRollFromScreen` 只决定「这一页能不能开始」；通过后再走 `startRollError`。

---

## 4. 数据流

1. 主持人在奖品页，或在允许开转的中奖页，点「开始抽奖」。
2. `onStartRoll`：若正在滚动/停留，return。若 `canStartRollFromScreen` 为 false，return（不切屏、不开转、不提示）。
3. 现有 `startRollError`：未选奖、已抽满、`canDraw === false` → 设错误文案，不切屏、不开转。
4. 通过后与抽奖页开转相同：冻住当前奖 ID、用当时 `eligible` 姓名开转、`patchSession({ publicScreen: "draw", drawPhase: "rolling" })`、刷新。
5. 大屏切到抽奖页并滚动。点「停」才 `POST /api/draw`。

抽满后的中奖页：按钮置灰。即使误调 `onStartRoll`，步骤 2 也会 return，不会切到抽奖页，也不会开转下一奖。

不新增 session 字段。不改 `POST /api/draw`、`PATCH /api/session`、`winnerScreenPrizeId`、自动切下一奖。

---

## 5. 组件改动（最小集合）

| 位置 | 改动 |
|------|------|
| `client/src/screens/drawFlow.ts` | 新增 `canStartRollFromScreen` |
| `client/src/screens/drawFlow.test.ts` | 覆盖第 3 节真/假组合 |
| `client/src/components/HostControlBar.tsx` | 「必须在抽奖页」改为调用 `canStartRollFromScreen`；增加 `winnerPrizeId` prop |
| `client/src/components/HostControlBar.test.tsx` | 奖品页可点；参与页灰；抽满后中奖页灰；公示=当前奖的中奖页可点 |
| `client/src/screens/PublicStage.tsx` | `onStartRoll` 用 `canStartRollFromScreen` 替换 `publicScreen !== "draw"`；把已有的 `winnerPrizeId` 传给控制条 |
| `client/src/screens/PublicStage.test.tsx` | 奖品页一点即进抽奖页并开转；抽满后中奖页仍不开转 |
| `README.md` | 现场步骤改为：奖品页可直接开始；抽满后中奖页仍须先切到奖品页或抽奖页 |

`onStartRoll` 里比较用 `view.session.publicScreen`（调用时不在滚动，视觉屏与 session 一致）。`winnerPrizeId` 用现有 `winnerScreenPrizeId` 计算结果，与中奖页画面同一来源。`HostControlBar` 的 `winnerPrizeId` 为 `string | null`，与中奖页同源；非中奖页也传入同一值。控制条现有的 `complete` 作为 `prizeComplete` 传入 `canStartRollFromScreen`。

不改：`PrizeScreen`、`WinnerScreen`、`NameTicker`、`winnerDisplay.ts`、`server/**`、`data/**`、配奖、管理页。

---

## 6. 错误处理

| 情况 | 行为 |
|------|------|
| 参与页点开始 | 按钮置灰；`onStartRoll` 忽略 |
| 抽满后中奖页点开始 | 按钮置灰；`onStartRoll` 忽略，不切屏、不开转下一奖 |
| 未选奖 / 当前奖已抽满 / 没有可抽用户 | 与现在相同：不滚动，对应中文提示 |
| `patchSession` 失败 | 现有 catch：停转、解冻、提示（内定相关文案仍不弹）、`refresh`。奖品页/中奖页走同一条 |
| 滚动或停留中 | 「抽奖中…」或「停」；不能再点开始。手动切屏仍按现有规则取消自动进中奖屏 |
| 全部奖抽完 | 「已抽取」，置灰 |

不另做错误 UI。

---

## 7. 测试

**纯函数：** `canStartRollFromScreen`

- 参与页 → false（即使奖未抽满）
- 奖品页、抽奖页、未抽满、已选奖 → true
- 中奖页、`winnerPrizeId === currentPrizeId`、未抽满 → true
- 中奖页、公示奖是上一奖（`winnerPrizeId !== currentPrizeId`）、当前奖未抽满 → false
- 未选奖或已抽满 → 任一屏 false

**控制条：** 奖品页「开始抽奖」可点；参与页置灰；抽满后中奖页（公示 ≠ 当前）置灰；提前进入且公示=当前奖的中奖页可点。已抽满仍为「已抽取」。文案与「停」行为不变。

**PublicStage：**

- 奖品页点「开始抽奖」：`patchSession` 含 `publicScreen: "draw"` 与 `drawPhase: "rolling"`；出现抽奖屏；此时还不调用 `startDraw`。改掉现有用例「does not start rolling from the prize screen」。
- 抽满后停在中奖页（view 的 `currentPrizeId` 已是下一奖，`lastWinnerPrizeId` 为刚抽完的奖）：点「开始抽奖」不可用；不 patch 到 draw；不调用 `startDraw`。

**不测：** 后端换奖、冻奖时间线、多窗口对齐、音效、XML/配奖。

---

## 8. 验收标准

- [ ] 奖品页、当前奖未抽满时，「开始抽奖」可点；一点后大屏切到抽奖页并开始滚动名单。
- [ ] 中奖页在公示奖就是当前未抽满奖时，同样可点并切到抽奖页开转。
- [ ] 一奖抽满后自动进入的中奖页（公示刚抽完的奖、下拉框已是下一奖）上，「开始抽奖」置灰；不会开转下一奖。
- [ ] 参与页「开始抽奖」仍置灰。
- [ ] 点开始仍不调用 `POST /api/draw`；开奖仍是点「停」。
- [ ] 未选奖、已抽满、没有可抽用户、滚动/停留中的按钮与提示与现在相同。
- [ ] 自动切下一奖、3 秒停留、冻奖、中奖公示、后端开奖行为不变。
- [ ] README 现场步骤与上表一致：奖品页可直接开始；抽满后中奖页不能直接抽下一奖。
