# 本地 XML 抽奖人名单设计

**日期：** 2026-09-01  
**状态：** 口头设计已逐段确认；书面规格待审阅  
**范围：** 用本机 `data/participants.xml` 保存默认抽奖人姓名；服务器启动时用这份名单开新一场；现场参与屏与后台清空在现有 JSON 接口上双写 XML。不新增大屏页面，不新加 npm 依赖。

---

## 1. 背景与目标

### 1.1 现状

- 技术栈不变：Vite + React（`client/`）+ Express（`server/`）+ JSON 文件（`data/`）。
- 抽奖人在大屏「参与」屏逐个添加、改名、删除；运行时写在 `data/participants.json`（`id` + `name`）。
- 服务器重启后仍读这份 JSON；中奖（`winners.json`）与内定（`presets.json`）也会留下。
- 奖品已有种子：启动时从 `catalog/` 覆盖运行时；本规格不改奖品行为。
- 项目内没有抽奖人 XML，也没有独立的配名单页。

### 1.2 已确认需求

| 维度 | 选择 |
|------|------|
| 录入入口 | 继续用大屏参与屏；添加/改名/删除写回 XML |
| 打开网站 | 仅**服务器进程启动**时灌名单；刷新浏览器不重开一场 |
| 启动时活动 | 当新一场：用 XML 姓名重建运行时名单，清空中奖与内定 |
| 首次无 XML | 用当前 `participants.json` 的姓名生成 XML |
| 实现策略 | XML 当本机姓名底稿，JSON 仍负责当场抽奖（方案 1） |

### 1.3 目标

- 本机有一份可手改、也可由参与屏维护的 XML 姓名名单。
- 启动服务后大屏先显示这份名单，再在此基础上添加、修改、抽奖。
- 每次启动都是新活动：上一场中奖、内定不带到这一场。
- 刷新或再开大屏窗口不影响进行中的抽奖。

### 1.4 非目标

- 新增 `npm run setup:participants` 或 `/setup` 配名单页。
- 用 XML 取代 `participants.json` 作为运行时存储。
- 把 XML 放到 `catalog/` 或纳入奖品种子。
- 浏览器刷新时重灌名单或清空中奖。
- 运行中手改 XML 热加载。
- 新加 XML 解析/序列化 npm 依赖。
- 改抽奖算法、停稳停留、四屏顺序、配奖、内定规则本身。

---

## 2. 数据与启动

### 2.1 文件

| 路径 | 职责 |
|------|------|
| `data/participants.xml` | 本机默认姓名名单（有序、无 `id`） |
| `data/participants.json` | 当场运行时名单（`id` + `name`）；抽奖、内定、中奖只认这个 |

XML 跟 `LOTTERY_DATA_DIR` 走，与 `participants.json` 同目录。测试临时数据目录不会读到仓库里的 XML。

路径加入现有 `getPaths()`，字段名为 `participantsXml`。

### 2.2 XML 格式

UTF-8。根节点必须是 `participants`。每个姓名一个 `participant` 元素，文本为 trim 后的姓名。元素之间允许空白。

```xml
<participants>
  <participant>邵心悦</participant>
  <participant>邵景昊</participant>
</participants>
```

允许：无 XML 声明；`<participants></participants>` 或 `<participants/>` 表示空名单。  
不允许：其它根节点、未闭合标签、`participant` 互相嵌套。姓名中的 `&` `<` `>` `"` `'` 写入时转义为 `&amp;` `&lt;` `&gt;` `&quot;` `&apos;`，读出时还原。

落地时把当前 `data/participants.json` 的姓名写成仓库中的 `data/participants.xml`（顺序与 JSON 数组一致）。之后启动走「已有 XML」路径。

### 2.3 启动流程

仅在服务器 `main()` 里、`maybeApplyPrizeSeed` **之后**调用 `maybeApplyParticipantSeed`。`createApp()` 本身不灌名单；现有用临时目录起 app 的测试行为不变。

若 **未** 设置 `LOTTERY_SKIP_PARTICIPANT_SEED=1`：

1. 若 XML 文件不存在：读取当前运行时 JSON 的 `name`（保持顺序；空名跳过），写成 §2.2 的 XML。JSON 为空或文件不存在则写成空名单。
2. 读取 XML。按出现顺序收集姓名：trim 后为空则跳过；与已收集姓名完全相同则跳过（只留第一次）。
3. 将运行时 JSON **整份覆盖**为 `{ id: 新 UUID, name }[]`，顺序与上一步一致。不把 XML 以外的旧 JSON 条目留下来。
4. 将 `winners.json` 写成 `[]`，将 `presets.json` 写成 `{}`。
5. 读 `session.json`，写入：`drawPhase` 为 `"idle"`，`lastWinnerParticipantId`、`lastWinnerPrizeId` 为 `null`，`publicScreen` 为 `"enroll"`。`currentPrizeId` 与 `controlBarVisible` 不改（当前奖仍由奖品种子处理）。

若设置了 `LOTTERY_SKIP_PARTICIPANT_SEED=1`：上述步骤全部跳过。Vitest 全局设置该变量（与 `LOTTERY_SKIP_PRIZE_SEED` 相同用意）。本地 `npm run dev` / `npm start` 与 Render **不**设置，因此总会灌名单。

奖品种子仍不读、不写参与者 XML/JSON。参与者灌入不改奖品清单与图片。

---

## 3. 运行时双写

### 3.1 参与屏与接口

大屏 `EnrollScreen`、控制条、`/admin` 交互不改。仍走现有：

- `POST /api/participants`：trim 后非空；重名 409；成功 201，服务端生成 UUID。
- `PATCH /api/participants/:id`：改名规则与现在相同。
- `DELETE /api/participants/:id`：已中奖 409。
- `DELETE /api/participants`（管理口令）：清空全部参与者并清空全部内定。

成功变更运行时 JSON 之后，把**当前 JSON 里全部 `name`**（数组顺序）整份写回 XML。清空全部时 XML 写成空名单（`<participants></participants>`）。

空名、重名、删除已中奖等失败路径不写 XML。

写 XML 失败：接口返回失败（5xx），界面不假装成功。此时 JSON 可能已更新（当场刷新可见）；**下次启动按 XML 回退**，可能丢掉这一次成功写进 JSON 但未进 XML 的改动。不为此做回滚。

`GET /api/participants` 与 `GET /api/public/view` 仍只读 JSON。

### 3.2 当场抽奖

抽奖、内定、中奖记录只读写现有 JSON 文件。运行期间不读 XML。服务在跑时手改 XML，要等下次进程启动才生效。

内部身份仍是 UUID。XML 永不存 `id`。因此启动重建后，上一场内定/中奖即使未被清空也无法对准新人；本规格选择启动时清空，避免悬空引用。

---

## 4. 错误与边界

| 情况 | 行为 |
|------|------|
| 启动时没有 XML | 用当前 JSON 姓名生成 XML，再按 §2.3 重建 JSON、清中奖/内定、复位会话 |
| XML 为空名单 | 运行时名单为 `[]`；中奖/内定仍清空；会话仍按 §2.3 复位 |
| XML 无法解析或根节点不是 `participants` | 灌入函数抛错，`main()` 以非 0 退出；不覆盖 JSON、不清中奖/内定、不改会话 |
| XML 内空姓名 | 跳过 |
| XML 内重名 | 只保留第一次出现 |
| 姓名含 XML 特殊字符 | 按 §2.2 转义/还原；界面显示原字 |
| 双写时 XML 写失败 | 见 §3.1 |
| 运行中手改 XML | 当场不生效 |
| 空名 / 重名 / 删已中奖 | 与现在相同，不写 XML |
| `LOTTERY_SKIP_PARTICIPANT_SEED=1` | 不灌 XML |

解析范围：去掉可选的 XML 声明后，文档必须是根元素 `participants`（可空）。子节点只允许空白与 `participant`（含空元素，视为空姓名并跳过）。其它结构视为无法解析。

---

## 5. 组件改动（最小集合）

| 位置 | 改动 |
|------|------|
| `server/src/store/paths.ts` | 增加 `participantsXml` |
| `server/src/domain/` | XML 读写（固定格式、转义）；`maybeApplyParticipantSeed`；是否灌入的开关函数 |
| `server/src/index.ts` | 奖品种子之后调用参与者灌入 |
| `server/src/routes/participants.ts` | 成功的 POST/PATCH/DELETE（含清空）之后写 XML |
| `server/vitest.config.ts` | 全局 `LOTTERY_SKIP_PARTICIPANT_SEED=1` |
| `data/participants.xml` | 由当前 JSON 姓名落地 |
| `README.md` | 说明 XML 名单、启动即新一场、参与屏会写回 XML |

不改：`EnrollScreen` UI、抽奖核心、配奖页、`PUT /api/prizes`、内定 API 语义（启动清空是灌入步骤，不是改内定规则）。

读写 XML 只用 Node 内置 `fs` 与字符串处理，不引入三方 XML 库。

---

## 6. 测试

**后端：**

- 无 XML：从 JSON 生成 XML，再重建 JSON（姓名顺序不变、id 全部换新），`winners` 为 `[]`，`presets` 为 `{}`，会话 `publicScreen` 为 `enroll`、`drawPhase` 为 `idle`、上一轮中奖人为空。
- 已有 XML：按 XML 重建；JSON 中 XML 没有的人消失。
- 空名单 XML → JSON 为 `[]`。
- 坏 XML → 抛错；JSON、中奖、内定、会话文件内容不变。
- 重名只留第一次；空标签跳过。
- 特殊字符姓名往返后与原字相同。
- `POST` / `PATCH` / `DELETE :id` 成功后 XML 姓名列表与 JSON 一致。
- 管理口令清空后 XML 为空名单。
- 开关为 `1` 时不灌入。
- 原有参与者改删、开奖、不可重复中奖、奖品种子测试仍通过。

**前端：** 不新增界面测试。

**手工：** 启动见 XML 名单 → 参与屏添加/改名/删除 → 打开 XML 已更新 → 抽一次 → 重启服务后名单仍在、中奖与内定已空、大屏在参与屏。刷新浏览器不清空中奖。

**不测：** 手改 XML 热加载、公网部署、配名单页、XML 库兼容性。

---

## 7. 验收标准

- [ ] 仓库（或首次启动后）存在 `data/participants.xml`，内容为姓名列表。
- [ ] 未跳过灌入时，服务器启动用 XML 覆盖运行时抽奖人，并清空中奖与内定；大屏默认在参与屏。
- [ ] 刷新浏览器或再开窗口不重新灌入、不清空当场中奖。
- [ ] 参与屏添加、改名、删除未中奖者后，XML 与当场名单一致。
- [ ] 后台清空全部参与者后，XML 为空名单。
- [ ] XML 损坏时进程启动失败，旧 JSON 与中奖不被覆盖。
- [ ] 不新增 npm 依赖；抽奖、配奖、四屏交互保持现有行为。
- [ ] README 与上述行为一致。
