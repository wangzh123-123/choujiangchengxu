# 奖品种子入库与本地配奖命令设计

**日期：** 2026-08-26  
**状态：** 口头设计已逐段确认；书面规格待审阅  
**范围：** 奖品清单以仓库种子为唯一正式来源；每次启动用种子覆盖运行时奖品；现场 `/admin` 不再改奖品；本地命令打开配奖页，保存写入仓库文件（不自动提交）。

---

## 1. 背景与目标

### 1.1 现状

- 技术栈不变：Vite + React（`client/`）+ Express（`server/`）+ JSON 文件（`data/`）。
- 奖品读写 `data/prizes.json`，图片在 `data/uploads/`，大屏与 `/admin` 都改这份运行时文件。
- `/admin` 可改名称、图片文件名、排序、数量；图片需手工放到 `data/uploads/`。
- 仓库里已有一份 `data/prizes.json`（含示例与后来加上的奖）。部署后若只在线上 `/admin` 改奖，下一次从 git 部署会回到仓库内容；看起来像「每次要重新配」。
- 抽奖数量、开始/停、内定槽位、四屏顺序不在本规格内改动。

### 1.2 已确认需求

| 维度 | 选择 |
|------|------|
| 正式来源 | 仓库种子清单，每次启动覆盖运行时奖品 |
| 现场 `/admin` | 不再改奖品；缺了也只能本地改种子再部署 |
| 本地配奖命令 | 打开配奖页；保存只写仓库文件，不自动 commit / push |
| 图片 | 设置页上传，保存进种子目录并同步到运行时 |
| 启动覆盖范围 | 只覆盖奖品清单与用到的图。当前奖仍在清单里则保留，否则改成第一项。内定、中奖、参与者不动 |
| 实现策略 | 独立 `catalog/` 种子目录 + 启动拷贝 + 仅本机配奖页（方案 1） |

### 1.3 目标

- 打开服务器后大屏立刻能展示仓库里的奖品，不必每次在后台重配。
- 改正式奖品只有一条路：本机命令 → 配奖页 → 写入种子 → 需要时再提交推送。
- 现场 `/admin` 只保留内定、中奖、参与者等当晚事务。

### 1.4 非目标

- 保存时自动 git commit 或 push。
- 现场 `/admin` 应急改奖（含清单为空时的补全入口）。
- 把奖品写成 TypeScript 常量。
- 改姓名录入、四屏顺序、开始/停抽奖、内定规则。
- 新加 npm 依赖（含浏览器打开库）；用系统命令打开浏览器。
- 公网提供配奖页。

---

## 2. 数据与启动

### 2.1 目录

| 路径 | 职责 |
|------|------|
| `catalog/prizes.json` | Git 中的正式奖品清单（字段与现有 `Prize` 相同：`id`、`name`、`imagePath`、`order`、`quantity`） |
| `catalog/uploads/` | Git 中的奖品图片 |
| `data/prizes.json` | 运行时清单；大屏与抽奖读取这里 |
| `data/uploads/` | 运行时图片；`/uploads/...` 静态服务这里 |

首次落地时：把当前 `data/prizes.json` 拷为 `catalog/prizes.json` 的初始内容；把清单引用到的图片（至少 `prize-default.svg`）拷进 `catalog/uploads/`。之后以 `catalog/` 为准。

### 2.2 启动拷贝

服务器进程启动时，若**未**设置 `LOTTERY_SKIP_PRIZE_SEED`：

1. 读取 `catalog/prizes.json`（文件不存在则视为 `[]`）。
2. **整份覆盖**写入运行时 `data/prizes.json`。
3. 将种子清单里 `imagePath` 指向的、且存在于 `catalog/uploads/` 的文件拷到 `data/uploads/`（同名覆盖）。不删除 `data/uploads/` 中种子未引用的其它文件。
4. 不读、不写 `participants.json` / `presets.json` / `winners.json`。
5. 读 `session.json`：若 `currentPrizeId` 在新清单中存在，保持不变；否则若清单非空，改为 `order` 最小的一项的 `id`，再写回 session；清单为空则将 `currentPrizeId` 置为 `null`。

若某奖已抽出人数大于种子里的 `quantity`，仍按种子写入；该奖按现有规则视为抽完。不因此拒绝启动。

Vitest 全局设置 `LOTTERY_SKIP_PRIZE_SEED`，现有用临时目录 `PUT /api/prizes` 的测试行为不变。本地 `npm run dev` / `npm start` 与 Render **不**设置该变量，因此总会拷贝。

仓库内 `catalog/` 路径相对仓库根目录解析，不跟 `LOTTERY_DATA_DIR` 走（测试临时目录不会变成种子源）。

### 2.3 运行时 API

- `GET /api/prizes` 与 `GET /api/public/view` 仍读运行时 `data/prizes.json`（启动拷贝之后即种子内容）。
- `PUT /api/prizes` **保留**，供测试写入临时数据目录。现场 `/admin` 不再调用。进程不重启则 PUT 仍会改运行时文件；**下一次启动**会被种子再次覆盖。配奖页不走这条接口。

---

## 3. 本地配奖命令与页面

### 3.1 命令

仓库根目录：

```bash
npm run setup:prizes
```

行为：

1. 设置 `LOTTERY_PRIZE_SETUP=1`，按本地开发方式启动前端与后端（端口与现有一致：`5173` + `3001`）。本命令不走生产单进程。
2. 用系统命令打开默认浏览器到 `http://127.0.0.1:5173/setup/prizes`。
3. 若 5173 或 3001 已被占用：打印「请先关掉占用 5173/3001 的进程」，退出码非 0，不复用已有、未开配奖开关的进程。
4. 不执行 git add / commit / push。

### 3.2 配奖页 ` /setup/prizes`

- 仅本机使用：不登录、不校验管理口令。开关是进程环境变量 `LOTTERY_PRIZE_SETUP=1`。
- 未开开关时：页面展示「仅本地配奖可用」；配奖专用接口返回 **404**，消息同样为「仅本地配奖可用」。Render 生产不设置该变量。
- 功能：列出种子清单；添加、删除奖品；改名称、数量（整数 ≥ 1）、排序；上传图片并预览；保存。
- 新奖品 `id` 为 `prize-${Date.now()}`。已有项的 `id` 不可编辑，以免内定与中奖记录对不上。
- 允许保存空清单。
- 保存成功文案固定：「已写入仓库文件，未提交。大屏刷新即可看到」。

### 3.3 配奖专用接口（仅 `LOTTERY_PRIZE_SETUP=1`）

未开开关时一律 404 + 「仅本地配奖可用」。

- `GET /api/setup/prizes`：读 `catalog/prizes.json`（缺文件为 `[]`）。
- `PUT /api/setup/prizes`：body 为奖品数组。校验与现有奖品写入相同（每项必须有非空 `name`、`imagePath`，整数 `quantity` ≥ 1）。通过后写入 `catalog/prizes.json`，并立刻按 §2.2 的规则同步到运行时 `data/`（含当前奖修正）。**不**按「数量不得小于已抽人数」拒绝（与启动覆盖一致）。
- `POST /api/setup/prizes/image`：上传一张图片。空文件或非图片 → 400，消息「请上传图片」。成功则把文件写入 `catalog/uploads/`（文件名避免覆盖已有无关文件；可保留原扩展名），返回 `{ "imagePath": "<文件名>" }`。配奖页把该文件名写入对应奖品的 `imagePath`，再随 PUT 保存清单。

保存清单时，把各奖 `imagePath` 在 `catalog/uploads/` 中存在的文件同步拷到 `data/uploads/`。

### 3.4 现场 `/admin`

- 删除「奖品配置」整块（含添加奖品、保存奖品、图片文件名输入）。
- 内定、已中奖、参与用户、清空操作保留。内定区展示的奖品名称来自 `GET /api/prizes`（只读）。
- 不在 `/admin` 链到配奖页。

---

## 4. 错误与边界

| 情况 | 行为 |
|------|------|
| 未开 `LOTTERY_PRIZE_SETUP` 访问配奖接口 | 404，「仅本地配奖可用」 |
| 未开开关打开 `/setup/prizes` | 页面文案「仅本地配奖可用」，不展示表单 |
| PUT 种子清单缺 name / imagePath | 不写文件；沿用现有奖品校验（当前为「奖品缺少 name 或 imagePath」） |
| quantity 不是 ≥ 1 的整数 | 不写文件；与现有 `PUT /api/prizes` 数量校验一致 |
| 上传空文件或非图片 | 400，「请上传图片」 |
| 种子 quantity 小于该奖已抽人数 | 仍写入；该奖视为抽完 |
| 清单删除某奖，但 winners/presets 仍引用其 id | 不清理那些记录；公示名称回退为 id（现有行为） |
| 端口占用 | 命令失败并提示关掉占用 5173/3001 的进程 |

不新加 npm 依赖。

---

## 5. 测试

在现有 Vitest 上增加，不引入新测试框架。

**启动拷贝（临时目录 + 显式调用拷贝函数，或未设置 skip 的专用用例）：**

- 种子清单与引用到的图片出现在目标 `data/`。
- 无效 `currentPrizeId` 改为清单中 `order` 最小项。
- 拷贝前后 `participants` / `presets` / `winners` 文件内容不变。
- 设置 `LOTTERY_SKIP_PRIZE_SEED` 时不拷贝。

**配奖接口：**

- 未开开关：GET/PUT/POST image 均为 404，消息「仅本地配奖可用」。
- 开开关：PUT 写入 `catalog/prizes.json` 且运行时 `data/prizes.json` 同步。
- 开开关：上传合法图片后返回文件名；非法/空文件 400「请上传图片」。

**后台页：**

- 渲染结果中不再出现「奖品配置」或「保存奖品」。

现有 85 服务端 + 39 客户端测试在全局 skip 种子后保持通过。

---

## 6. 文档

`README.md`：

- 「默认奖品」改为说明奖品来自 `catalog/`，启动时拷入 `data/`。
- 增加 `npm run setup:prizes` 的用法：打开配奖页、保存写入仓库、需自行提交推送。
- 现场流程中删除「在 `/admin` 设置数量」作为改奖途径；数量在配奖页改。`/admin` 仍只做内定等。

---

## 7. 非范围（再次收口）

- 不改 `resolveWinner` / `listEligible`。
- 不把种子内容放进 `GET /api/public/view` 以外的新公开字段。
- 不在 Render 上开启 `LOTTERY_PRIZE_SETUP`。
- 不自动提交 git。
