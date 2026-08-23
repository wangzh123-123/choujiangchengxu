# 抽奖大屏公网免费部署设计

**日期：** 2026-08-23  
**状态：** 已批准（用户确认 OK）  
**范围：** 将现有本地抽奖大屏部署到免费公网，支持现在测试、十月正式使用、十月后下线。

---

## 1. 背景与目标

### 1.1 现状

- 架构：Vite + React（`client/`）+ Express（`server/`）+ 本地 JSON（`data/`）。
- 开发模式：前端 `5173`、后端 `3001`，Vite 代理 `/api` 与 `/uploads`。
- 后端默认监听 `127.0.0.1`，仅本机可访问。
- 数据持久化：服务端 JSON 文件（`prizes`、`participants`、`presets`、`winners`、`session`、`config`）及 `data/uploads/` 图片。
- 已有环境变量 `LOTTERY_DATA_DIR` 可覆盖数据目录。

### 1.2 用户需求（已确认）

| 维度 | 要求 |
|------|------|
| 费用 | 免费 |
| 使用周期 | 现在远程测试 → 十月正式使用 → 十月后不再使用 |
| 冷启动 | 可接受（如 15 分钟无访问后首次打开较慢） |
| 数据持久 | 理想：关浏览器后再打开，内定/参与者仍保留；底线：页面未关、服务在跑时数据不丢 |
| 持久时长 | 短时间即可（测试期 + 十月活动周），不需长期云数据库 |
| 访问方式 | 其他电脑通过公网 URL 打开 |

### 1.3 目标

- 提供稳定公网 URL（平台子域名即可）。
- 生产环境单进程：Express 同时提供静态前端、API、上传文件。
- 最小业务改动：不引入云数据库；沿用 JSON 文件存储。
- 文档化部署步骤与数据备份/注意事项。

### 1.4 非目标

- 自定义域名（可后续加，本次不强制）。
- 高可用、多实例、自动扩缩容。
- 将 JSON 迁移到 Supabase / MongoDB 等外部存储。
- 强化鉴权（超出当前口令级防误触）。
- Oracle VPS 或本机 Tunnel 作为主路径（备选方案见 §4）。

---

## 2. 推荐方案：Render 免费 Web 服务

### 2.1 架构

```
用户浏览器
    ↓ HTTPS
Render 免费 Web Service（单容器）
    ├── Express
    │   ├── 静态资源 client/dist（/, /admin SPA）
    │   ├── /api/* 业务接口
    │   └── /uploads 奖品图片
    └── 可写磁盘：LOTTERY_DATA_DIR（默认容器内 ./data）
```

### 2.2 为何选 Render

- 真公网 URL，任意设备可测。
- 免费档满足「十月后下线」的短期需求。
- 用户接受冷启动；免费档约 15 分钟无流量后休眠。
- 几乎不需改业务逻辑，仅需生产构建与静态托管。
- 相较 Oracle VPS：上手更简单；相较本机 Tunnel：不依赖现场电脑常开。

### 2.3 数据持久化行为（关键）

数据在**服务端 JSON**，非浏览器缓存。关浏览器不影响服务端数据。

| 场景 | 数据是否保留 |
|------|----------------|
| 用户关闭页面，数小时/数天后再访问 | 是（同一容器实例、未 redeploy） |
| 容器休眠后冷启动 | 是 |
| 活动期间服务持续有访问 | 是 |
| Render 重新部署（Redeploy）或更换实例 | 否（磁盘清空） |
| 删除服务后重建 | 否 |

**活动周策略：** 十月正式使用前完成配置；活动期间避免 Redeploy；可选在活动前导出 `data/` 备份。

### 2.4 安全

- 部署前将 `data/config.json` 中 `adminPassphrase` 改为强口令（或通过环境变量注入，若实现支持）。
- 不向观众展示 `/admin` 链接；口令仅内部分享。
- 管理接口继续要求 admin token；公开读接口保持现有设计。

---

## 3. 工程改动概要

### 3.1 生产构建

1. `client`：`npm run build` → `client/dist`。
2. `server`：生产模式下挂载 `client/dist` 为静态资源。
3. SPA 回退：非 API/非 uploads 的 GET 请求返回 `index.html`（支持 `/admin` 深链）。

### 3.2 启动与脚本

根目录或 `server` 增加生产脚本，典型流程：

```bash
npm run build --prefix client
npm run start --prefix server   # NODE_ENV=production
```

- `PORT`：Render 注入（通常 10000）。
- `HOST`：`0.0.0.0`（监听所有接口）。
- `LOTTERY_DATA_DIR`：指向容器内可写路径（如 `/opt/render/project/src/data` 或 `./data`）。

### 3.3 部署配置

- 添加 `render.yaml` 或 README 部署章节：
  - Build Command：`npm install && npm run build --prefix client && npm install --prefix server`
  - Start Command：`npm run start --prefix server`
  - 环境变量：`NODE_ENV=production`、`HOST=0.0.0.0`、`LOTTERY_DATA_DIR=./data`

### 3.4 可选增强（非必须）

- Admin 页「导出数据」：打包下载 JSON 或提示备份路径。
- 通过环境变量 `ADMIN_PASSPHRASE` 覆盖口令，避免把生产口令写入仓库。

### 3.5 测试

- 本地生产模式冒烟：build 后单进程启动，验证 `/`、`/admin`、`/api/health`、抽奖全流程。
- 现有 server/client 测试保持通过；可增加生产静态托管的集成测试（可选）。

---

## 4. 备选方案（本次不实施）

| 方案 | 适用场景 | 说明 |
|------|----------|------|
| 本机 + Cloudflare Tunnel | 十月现场固定一台投屏电脑 | 数据最稳，依赖本机常开 |
| Oracle 永久免费 VPS | 需长期磁盘且常 redeploy | 配置成本高，超出本次周期 |

若 Render 测试期频繁 redeploy 导致丢数据，可改用 Tunnel 作十月现场方案，无需改存储。

---

## 5. 使用流程

### 5.1 现在（测试）

1. 按文档部署到 Render，获得 `https://xxx.onrender.com`。
2. 用公网 URL 测试：加参与者、设内定、抽奖、关页再开验证数据。
3. 测试 redeploy 会清空数据，建立「配置后少 redeploy」的习惯。

### 5.2 十月（正式）

1. 活动前：确认奖品图、口令、内定（或活动当天配置）。
2. 可选：从 Render Shell 或备份脚本导出 `data/`。
3. 活动周：同一 URL 投屏；避免 Redeploy。
4. 主持人控制条可隐藏；大屏 URL 不变。

### 5.3 十月后

1. 删除 Render Web Service（或暂停）。
2. 本地 `data/` 若需归档，保留最后一次备份即可。

---

## 6. 风险与缓解

| 风险 | 缓解 |
|------|------|
| Redeploy 丢数据 | 活动期不 redeploy；活动前备份 |
| 冷启动慢 | 活动前人工访问一次预热 |
| 国内访问慢 | 可接受；必要时十月现场改 Tunnel |
| 免费额度用尽 | 十月前确认 Render 免费政策；备用 Tunnel |
| 口令弱 | 部署强口令；不公开 admin 链接 |

---

## 7. 验收标准

- [ ] 公网 URL 可打开大屏与 `/admin`。
- [ ] 其他电脑/手机同一 URL 可完成：报名 → 内定 → 抽奖 → 中奖展示。
- [ ] 关浏览器后再次打开，数据仍在（未 redeploy 前提下）。
- [ ] 冷启动后服务恢复，数据仍在（未 redeploy 前提下）。
- [ ] README 含 Render 部署步骤与数据注意事项。
- [ ] 本地 `npm run build` + 生产启动可复现上述行为。
