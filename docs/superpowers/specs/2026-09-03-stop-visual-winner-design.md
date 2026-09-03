# 点停后以画面高亮人为中奖人设计

**日期：** 2026-09-03  
**状态：** 口头设计已逐段确认；书面规格待审阅  
**范围：** 点停后再滚约 40ms，停稳中间格的人同时作为抽奖屏高亮、中奖记录和中奖页公示；开奖改为提交该人 id。不改 3 秒停留、冻奖、抽满切下一奖、四屏顺序、XML、配奖。

---

## 1. 背景与目标

### 1.1 现状

- 点「停」立刻 `POST /api/draw`（无 body）。服务端用内定或随机抽出中奖人并写入。
- 前端把返回姓名设为 `settleName`。`NameTicker` 再滚 `ROLL_MS`（40ms）后用 `pickSettleIndex` **跳到**该姓名；找不到则停在下标 0。
- 滚动定时器与定格定时器都是 40ms。定格后定时器可能再翻一格，中间格变成相邻的人。
- 中奖页不使用这次定格姓名，而用 `winnerScreenPrizeId` 从 `view.winners` 再筛一遍。抽满后 `currentPrizeId` 可能已是下一奖，再叠加 3 秒轮询，公示的人可以和抽奖屏高亮不是同一个人。

现场已确认为：**同一奖，停稳高亮是张三，中奖页大字是李四。** 要以停稳画面为准。

### 1.2 已确认需求

| 维度 | 选择 |
|------|------|
| 谁是中奖人 | 点停后再滚约 40ms，中间格定死后屏幕高亮的人 |
| 中奖记录 | 必须写成这个人，不只改中奖页文案 |
| 点停瞬间 | 不立刻定格、不立刻请求开奖 |
| 内定 | 点停路径不再使用；管理页入口保留 |
| 提交时机 | 定格之后再 `POST`，按格子下标对应的 `participantId` |
| 定格前切屏 | 这一抽作废，不写中奖 |
| 抽满写下一奖 / 3 秒停留 / 冻奖 | 保持现有 |

### 1.3 目标

- 观众在抽奖屏看到谁高亮，中奖页和 `winners` 就是谁。
- 点停后约 40ms 停到**当时中间格**的人，不再跳到后台另抽的人，定格后不再多翻一格。
- 两个同名按格子下标对应的 id 提交。

### 1.4 非目标

- 按下「停」瞬间零再滚（0ms）。
- 真实减速曲线。
- 删除管理页内定入口或改内定 API。
- 改不可重复中奖、奖品数量含义、XML、配奖页、公网部署、音效。
- 把 `currentPrizeId` 的写入推迟到进中奖页。
- 缩短或取消 3000ms 停留。

---

## 2. 时间线

1. 点「开始抽奖」：拍下当时 `view.eligible` 快照（`id` + 姓名，顺序与数组一致）。滚动名单用快照姓名。抽奖屏和下拉框冻住开转时的奖。**不写**中奖记录。`eligible` 为空则不能开转（即使 `canDraw` 因内定为 true）。
2. 点「停」：名单继续按 `TICK_MS = 40` 滚约 `ROLL_MS = 40`。这期间不请求 `/api/draw`。主按钮为禁用的「抽奖中…」。
3. 到点后：先清掉滚动定时器，再读取当前中间格下标并高亮。不调用 `pickSettleIndex`，不按姓名查找。
4. 用快照 `[index % snapshot.length]` 的 `participantId` 调用 `POST /api/draw`。成功后记住这次结果（`prizeId`、`participantId`、姓名）。
5. 高亮后再停留 3000ms。未抽满留在抽奖屏；抽满自动进中奖页。服务端抽满仍立刻改 `currentPrizeId`；停留期内画面仍显示刚抽的奖，进中奖页时下拉框才变。

定格前手切其它屏：取消尚未执行的定格与提交，不当中奖。提交成功后再切屏：记录保留，取消自动进中奖页（现有 `skipReveal`）。

---

## 3. 开奖接口

`POST /api/draw` 必须带 JSON `{ "participantId": "<id>" }`。服务端不再随机、不再读内定槽。

校验（失败则 400，不写记录）：

- 已选 `currentPrizeId`，奖存在，且该奖未抽满
- `participantId` 为非空字符串，对应参与者存在
- 该人此刻在可抽名单中（`listEligible`：未中过奖）

通过后与现在相同：追加 `winners`；`lastWinnerParticipantId` / `lastWinnerPrizeId`；抽满则 `currentPrizeId` 改为 `nextIncompletePrizeId`（没有则保持）；`publicScreen` 仍为 `"draw"`；`drawPhase` 为 `"revealed"`。响应字段保持现有 `DrawResult`（含 `name`、`prizeComplete`、`currentPrizeId`）。

不新增 session 字段。不接受用姓名字符串提交。

`resolveWinner` 可留在 domain 供旧单测，但 `draw` 路由不再调用它。所有现有 `POST /api/draw` 无 body 的测试改为带一个可抽的 `participantId`。原先「开奖必中内定」改为：「即使设了内定，写入的仍是请求里的 `participantId`」。

---

## 4. 抽奖屏定格与中奖页

### 4.1 快照与 `NameTicker`

开转快照为 `Participant[]`，不是只存姓名。`names` 仍是 `snapshot.map((p) => p.name)`。`buildCycle` 仍是名单拷贝，下标与快照一致。

`NameTicker` / `DrawScreen`：

- 用 `stopping: boolean` 取代「把 `settleName` 当成要跳转的目标」。
- `rolling && !stopping`：继续 40ms 翻格。
- `rolling && stopping`：再过 `ROLL_MS` 后，**先 clear 滚动 interval（ref 保存 timer id），再** `setSettled(true)`，并以当前 `offset` 调用 `onSettled(index)`。
- 父组件在回调里才 `POST`。`rolling` 在提交流程中再置 false（进入 3 秒停留时），避免 40ms 再滚被提前掐断。
- 生产路径不调用 `pickSettleIndex`，不按姓名跳格。该函数及只测跳转的用例一并删除。

`waitingForStop`：正在滚且尚未点停。点停后至停留结束：`drawing === true`（「抽奖中…」）。点停后忽略重复点停。

### 4.2 中奖页跟提交结果

提交成功后，`PublicStage` 保存 `committedDraw: { prizeId, participantId, name }`。

- 中奖页公示奖：有 `committedDraw` 时用它的 `prizeId`，不用 `winnerScreenPrizeId` 另算。
- 公示名单：该奖已有中奖人，且必须包含 `committedDraw` 对应的人（`view.winners` 里没有也要补上）。仅一人时，大字就是这个人。
- 3 秒轮询可以更新其它字段，但只要 `committedDraw` 还在，就不许把公示人换成别人。

`committedDraw` 在下一轮 `onStartRoll` 或手选其它奖时清掉。提交成功后手切到中奖页，仍用它公示刚定格的人，不要清掉（否则又会走 `winnerScreenPrizeId` 猜人）。未抽满 3 秒后留在抽奖屏时，高亮仍是刚定格的人，直到下一轮开转。`displayPrizeIdRef` 仍按现有冻奖规则在进中奖页或手切后解冻，与 `committedDraw` 生命周期分开。

手动进入中奖页且没有 `committedDraw` 时：仍用现有 `winnerScreenPrizeId`（提前看当前奖、或抽满后看上一奖）。

奖品冻住、`canStartRollFromScreen`、奖品页/中奖页开转规则不改。抽满后中奖页的公示奖是刚抽完的奖（`committedDraw.prizeId`），与已切到的下一奖不同，开始按钮仍置灰。

---

## 5. 组件改动（最小集合）

| 位置 | 改动 |
|------|------|
| `server/src/routes/draw.ts` | 读 `participantId`；校验可抽；不调用内定/随机 |
| `server/tests/*draw*` 及 `e2e-smoke.test.ts`、`lottery.verification.test.ts` 等所有 `POST /api/draw` | body 带可抽 id；内定用例改为「请求谁写谁」 |
| `client/src/api/client.ts` | `startDraw(participantId: string)`，JSON body |
| `client/src/components/NameTicker.tsx` | `stopping` + 先停 timer 再按当前 offset 回调 |
| `client/src/components/NameTicker.settle.test.tsx` 等 | 断言再滚 40ms 后停在当时格子，而不是跳到指定姓名 |
| `client/src/screens/DrawScreen.tsx` | 把 `stopping` / `onSettled(index)` 传给 ticker |
| `client/src/screens/PublicStage.tsx` | 快照、点停只设 stopping、回调里再 draw、记住 `committedDraw` |
| `client/src/screens/PublicStage.test.tsx` | 点停当下不调用 `startDraw`；定格后带 id 调用；中奖页人名与定格一致 |
| `README.md` | 点停后约 40ms 停到当时中间格的人；此人即记录与公示；内定不在点停时生效 |

不改：`settleHold.ts` 的 3000、冻奖 ref、`canStartRollFromScreen` 语义、`EnrollScreen`、配奖、XML、管理页内定 CRUD。不新增 npm 依赖、不新增 session 字段。

---

## 6. 错误与边界

| 情况 | 行为 |
|------|------|
| 点停后、定格前 | 仍滚动；未写入 |
| 定格后提交失败 | 取消高亮与 `stopping`，提示错误（内定相关文案仍不弹），不计数，可再点开始 |
| 定格前手切屏 | 取消定格定时器与提交 |
| 提交成功后再手切屏 | 记录保留；取消自动进中奖页 |
| 快照为空 / 下标对不上人 | 不提交；提示「没有可抽奖用户」或等价错误 |
| 请求的人已中奖或奖已满 | 400；前端按提交失败处理 |
| 两个同名 | 提交该格快照上的 id |
| 停留期轮询 | 不覆盖 `committedDraw` 公示 |
| 仅内定、可抽名单为空 | 不能开转 |
| 全部奖抽完 | 进最后一奖中奖页，公示含刚定格的人 |

---

## 7. 测试

**后端**

- 无 `participantId` → 400，`winners` 不变。
- 可抽 id → 200，记录为该人；设了另一个人的内定也仍写请求里的人。
- 已中奖 id / 未知 id / 奖已满 / 未选奖 → 400。
- 抽满后 `currentPrizeId` 切下一未抽完奖（现有 `drawNextPrize` 行为，请求改为带 id）。

**前端**

- 点开始不请求 `/api/draw`。
- 点停当下不请求；推进 40ms 后以快照该格 `participantId` 请求一次。
- 39ms 时仍在滚、未定格、未请求。
- 定格后 interval 不再增加 offset（不会多翻一格）。
- 抽满：停留后进中奖页，大字（或名单中刚抽出的人）与定格姓名相同。
- 未抽满：不进中奖页；`startDraw` 仍被调用且写入的是定格的人。
- 定格前切屏：不调用 `startDraw`。
- 重复点停：只提交一次。

不测：墙钟是否严格 40ms、多浏览器逐帧对齐、音效。

---

## 8. 验收

- 点「停」后约 40ms，抽奖屏停在点停后再滚结束时的中间格，并高亮。
- 中奖页大字（仅一人）或刚抽出的那一条，与该高亮姓名一致；`winners` 中对应记录也是这个人。
- 管理页设了内定，点停结果仍跟画面，不强制内定。
- 点停当下不出现 `/api/draw`；定格后请求 body 含 `participantId`。
- 未抽满留抽奖屏、抽满进中奖页、冻奖到进中奖页才切下拉框、奖品页/当前奖中奖页可开转、抽满后中奖页不可直接抽下一奖：与改前相同。
- 不新增 npm 依赖；不改后端抽满即写下一奖的时机。
