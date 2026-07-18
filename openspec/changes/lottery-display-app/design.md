# 技术设计

## 上下文

- 当前状态：仓库为空，仅有 OpenSpec / spec-superflow 工具链；无业务代码。
- 约束条件：前端 + 本地小后端；多奖次；硬内定必中；不可重复中奖；重名拒绝；假二维码；`/admin` 口令；主持人控制条可隐藏；轻量动效；本机暂无 Git。
- 利益相关者：活动主持人（配置/内定/控场）、现场观众（只看对外四屏）。

## 目标

- 本机一键/两条命令可启动，完整走通：配奖 → 加用户 → 内定（可选）→ 四屏开抽 → 中奖展示。
- 数据落本地 JSON，进程重启不丢。
- 管理写操作与公开读分离；内定页不对观众导航暴露。

## 非目标

- 真扫码、云端、多租户、强鉴权、音效粒子、一奖多名、Git worktree 隔离。

## 决策

### 决策 1：技术栈

- **选择**：Vite + React + TypeScript（client）+ Express + TypeScript（server）+ 本地 JSON 文件（`data/`）。
- **理由**：与 DP-1 建议一致；React 适合四屏状态机；Express 足够承载 CRUD 与开奖；JSON 零运维。
- **考虑的替代方案**：Vite + Vue + Express（同等可行，团队更熟 React 生态默认）；纯前端 localStorage（弱一致性、不利内定与多端控场）。

### 决策 2：进程与目录布局

- **选择**：monorepo 扁平结构：`client/`、`server/`、`data/`、根 `package.json` 用 scripts 并行启动（`concurrently` 或分别 `dev`）。
- **理由**：边界清晰，API 与 UI 分离，符合「前端 + 小后端」。
- **考虑的替代方案**：单 Express 托管静态构建（生产友好，开发体验略差）；Electron（过重）。

### 决策 3：领域模型

- **选择**：
  - `Prize { id, name, imagePath, order }`
  - `Participant { id, name }`（`name` 全局唯一）
  - `Preset { prizeId, participantId }`（每奖至多一条）
  - `WinnerRecord { prizeId, participantId, at }`
  - `Session { currentPrizeId, publicScreen, controlBarVisible, drawPhase }`
- **理由**：直接支撑多奖次、硬内定、不可重复中奖与四屏状态。
- **考虑的替代方案**：把 winner 嵌在 prize 上（查询历史不便）；name 唯一改为 id 唯一名可重复（与已确认需求冲突）。

### 决策 4：开奖算法

- **选择**：服务端 `POST /api/draw`：校验当前奖、eligible 池（未中奖者）；若存在 preset 则 winner=preset；否则 `crypto.randomInt` 均匀随机；写入 `WinnerRecord`；返回 winner 供前端表演滚动后停靠。
- **理由**：结果以服务端为准，避免前端篡改；滚动仅为演出。
- **考虑的替代方案**：前端自行随机（不可信）；加权软内定（已否决）。

### 决策 5：Admin 鉴权

- **选择**：`data/config.json` 存口令哈希（或开发态明文口令字段，文档标明仅本地）；`POST /api/admin/login` 发 httpOnly cookie / 内存 token；管理写接口校验。
- **理由**：满足「口令级防误触」，实现简单。
- **考虑的替代方案**：仅前端路由守卫（可被绕过）；系统用户 OS 权限（过重）。

### 决策 6：前端路由与控场

- **选择**：React Router：`/` 公共大屏（四屏为状态而非四条观众路由）、`/admin` 管理页；主持人控制条组件驱动 `Session.publicScreen`；支持隐藏。
- **理由**：观众始终停在同一投屏 URL；切屏不换地址，降低误投风险。
- **考虑的替代方案**：`/screen/1..4` 分路由（误投某一屏时难统一控场）。

### 决策 7：图片与假二维码

- **选择**：奖品图上传到 `data/uploads/` 并由 `/uploads/` 静态托管；假二维码用内置静态 SVG/PNG。
- **理由**：本地可配图；假码无外部依赖。
- **考虑的替代方案**：只允许外链 URL（离线活动易挂）。

## 风险与权衡

- 口令仅防误触，同网可被探测 → 文档声明「仅可信局域网/本机」；默认绑定 `127.0.0.1` 可配置。
- 无 Git 导致 ssf isolate 不可用 → 实现期在工作区直接开发，风险自担。
- 硬内定与「表演随机」观感落差 → 滚动加减速掩盖结果已定；不宣称真随机当存在内定时。
- 浏览器自动播放限制 → 本版无音效，规避该风险。

## 迁移计划

- 上线步骤：安装 Node → `npm install` → 配置 admin 口令与奖品图 → `npm run dev` → 浏览器打开公共页与 `/admin`。
- 回滚步骤：停止进程；删除/还原 `data/*.json` 即可清空活动状态。

## 待明确问题

- （无阻塞项）默认监听 `127.0.0.1:5173`（client）与 `127.0.0.1:3001`（server）；若需局域网投屏再改 `host`。
