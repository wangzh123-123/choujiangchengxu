# Render 使用仓库 data 目录设计

**日期：** 2026-09-02  
**状态：** 口头设计已逐段确认；书面规格待审阅  
**范围：** 让 Render 生产进程读取仓库根目录 `data/`，使已提交的参与者 XML 在公网大屏显示。不改抽奖逻辑、不改大屏页面、不把名单或背景做成 catalog 种子。

---

## 1. 背景与目标

### 1.1 现状

- 本机不设 `LOTTERY_DATA_DIR` 时，`resolveDataDir()` 按 `server/src/store/paths.ts` 的源码位置解析到仓库根目录 `data/`。
- `render.yaml` 设置 `LOTTERY_DATA_DIR=./data`。启动命令是 `npm run start --prefix server`，进程工作目录是 `server/`，因此 `./data` 解析为 `server/data`，而不是仓库 `data/`。
- 奖品从 `catalog/` 按源码位置灌入**当前**数据目录，所以公网奖品清单和奖品图仍正常。
- 参与者启动灌入读数据目录里的 `participants.xml`。错误目录没有这份 XML，就按空名单开场。线上 `/api/participants` 返回 `[]`。
- 舞台背景 `/uploads/抽奖背景.jpg` 只存在于仓库 `data/uploads/`，不在 catalog 拷贝列表里；本次不作为验收项。

### 1.2 已确认需求

| 维度 | 选择 |
|------|------|
| 修法 | 方案 A：生产配置不再使用相对路径 `LOTTERY_DATA_DIR=./data` |
| 验收重点 | 公网参与屏显示仓库 `data/participants.xml` 中的姓名 |
| 背景图 | 本次不作为必须通过项 |
| 实现范围 | 只改部署配置与 README；不改 server/client 业务代码 |

### 1.3 目标

- Render 启动后数据目录为仓库根目录 `data/`。
- 启动灌名单读到已提交的 `data/participants.xml`，大屏参与人不再为空。
- 奖品清单与奖品图行为不变。

### 1.4 非目标

- 把名单或背景做成与奖品相同的 catalog 种子。
- 修改 `resolveDataDir()` 对相对路径的解析规则。
- 改抽奖、内定、四屏、配奖。
- 为背景图增加新接口或拷贝步骤。
- 新增自动化测试。

---

## 2. 配置与数据流

### 2.1 `render.yaml`

从 `envVars` 中删除：

```yaml
- key: LOTTERY_DATA_DIR
  value: ./data
```

保留 `NODE_ENV=production`、`HOST=0.0.0.0`、`ADMIN_PASSPHRASE`（`sync: false`）。  
`buildCommand` 与 `startCommand` 不变。

不设 `LOTTERY_DATA_DIR` 时，`resolveDataDir()` 使用源码相对路径 `<repo>/data`，与本机开发一致，也不依赖进程工作目录。

### 2.2 Dashboard 残留变量

若该服务曾用 Blueprint 或手动写入过 `LOTTERY_DATA_DIR`，从 yaml 删除后 Dashboard 仍可能留下旧值。旧值若仍是 `./data`，问题复现。

部署后必须在 Render Environment 确认没有 `LOTTERY_DATA_DIR`。若仍存在，在控制台删除后再 Manual Deploy 一次。

### 2.3 启动后数据流

1. 进程未设置 `LOTTERY_DATA_DIR` → 数据目录 = 仓库 `data/`。
2. 奖品种子仍从 `catalog/` 写入该目录（现有行为）。
3. 参与者灌入读取 `data/participants.xml`，覆盖当场 `participants.json`，并按现有规则清空中奖与内定、将会话回到参与屏。
4. 公开接口 `GET /api/participants` 与 `GET /api/public/view` 返回这份名单。

休眠后再冷启动仍会按 XML 开新一场（现有规则，本次不改）。

相对路径 `LOTTERY_DATA_DIR=./data` 在代码中仍按进程工作目录解析；本次只是生产配置不再设置它。

---

## 3. 文档

在 `README.md`「部署到 Render」中说明：

- 生产环境不要设置相对路径 `LOTTERY_DATA_DIR=./data`。在 `npm run start --prefix server` 下它会指向 `server/data`。
- 不设置该变量时使用仓库根目录 `data/`。
- 若 Dashboard 仍有该项，删除后再部署。

不改部署步骤的其它条目。

---

## 4. 验收

- `render.yaml` 不再包含 `LOTTERY_DATA_DIR`。
- README 含上述相对路径警告。
- 将改动推到 Render 跟踪的分支并完成一次部署。
- Dashboard Environment 中无 `LOTTERY_DATA_DIR`。
- 打开公网大屏，参与屏能看到 `data/participants.xml` 中的姓名；`/api/participants` 不是 `[]`。
- 奖品清单与奖品图仍显示。
- 背景图不作为必须通过项。

不新增单元测试。本地无需为本次配置改动跑新测试套件。

---

## 5. 组件改动（最小集合）

| 位置 | 改动 |
|------|------|
| `render.yaml` | 删除 `LOTTERY_DATA_DIR` |
| `README.md` | 部署小节增加相对路径警告与 Dashboard 检查 |

不改：`server/**`、`client/**`、`data/**`、`catalog/**`。
