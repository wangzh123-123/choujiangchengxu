# 执行合同

## Intent Lock

- **变更名称**：`lottery-display-app`
- **要解决的问题**：空仓库缺少可本地运行的抽奖展示系统，无法支撑对外四屏展示与对内硬内定控场。
- **范围内**：Vite+React+Express+JSON；多奖次；四屏（奖品/假二维码报名/滚动抽奖/中奖）；`/admin` 口令；硬内定必中；不可重复中奖；重名拒绝；主持人控制条可隐藏；轻量动效。
- **范围外**：真扫码、一奖多名、音效/粒子/皮肤、云端多租户、强鉴权、Git worktree 隔离。

## Scope Fence

- 不得引入真实扫码或第三方登录。
- 不得实现一奖多名或软内定加权。
- 不得加入音效、粒子、主题皮肤。
- 不得把 admin 写操作做成无口令可调用。
- 不得在未记录 DP-3 / 当前 execution plan 前开始实现业务代码。

## Approved Behavior

- **已批准需求摘要**：
  1. 本地持久化多奖品（名+图），可设当前奖品；无当前奖禁止开奖。
  2. 手动添加用户（id+name）；名称精确重复 → 拒绝并提示重输；假二维码展示。
  3. 对外四屏可切；奖品屏展示当前奖；抽奖屏风格一致且滚动播名（加减速停靠）；中奖屏展示奖+人（高亮）；控制条可隐藏；切屏淡入淡出。
  4. 每奖至多一个硬内定；有内定必中；无内定均匀随机；已中奖者不可再中/不可再被内定；空池拒开奖。
  5. Express+JSON；admin 口令保护管理写；公共可读当前展示模型。
- **关键场景**：重名 409；硬内定开奖停靠内定者；已中奖者内定被拒；无口令管理写 401；重启后数据仍在。
- **验收检查**：本地 `npm run dev` 走通「配奖→加用户→内定→开抽→中奖」；上述 API/UI 行为可测。

## Design Constraints

- **架构约束**：`client/`（Vite React TS）+ `server/`（Express TS）+ `data/` JSON；公共页 `/` 为单页四屏状态机；`/admin` 独立路由。
- **接口约束**：开奖以 `POST /api/draw` 服务端结果为准；管理写经 `requireAdmin`；`GET /api/public/view` 无需口令。
- **依赖约束**：仅本机 Node + 浏览器；默认监听本机回环；奖品图存 `data/uploads/`。
- **数据约束**：`Participant.name` 全局唯一；`WinnerRecord` 决定不可再中；`Preset` 每奖至多一条且指向未中奖用户。

## Execution Plan

full 模式：先运行 `ssf execution recommend`，用户确认后再 `ssf execution plan --confirm`。本文件不替代 execution-plan.json。

推荐 wave 划分（与 tasks.md 12 batches 对齐，按依赖串行波次；波内可标记 parallel 仅当无共享文件冲突）：

## Execution Waves

### Wave 1 — 后端地基

- **Wave ID**：`w1-backend-foundation`
- **任务**：Batch 1–2（health、JsonStore、types、data 种子）
- **依赖 wave**：无
- **策略**：`serial`
- **目标**：可启动的 Express 与可测持久化层
- **输入**：design.md 决策 1–3；tasks Batch 1–2
- **输出**：`server/` 脚手架、`data/*.json`、health + store 测试通过
- **完成标准**：`cd server && npx vitest run tests/health.test.ts tests/jsonStore.test.ts` PASS
- **Review gate**：`.superpowers/sdd/reviews/w1-backend-foundation.md` + `ssf execution review ... --verdict pass|fail`

### Wave 2 — 领域 API

- **Wave ID**：`w2-domain-api`
- **任务**：Batch 3–7（奖品、用户重名、admin 口令、内定/开奖、session/public）
- **依赖 wave**：`w1-backend-foundation`
- **策略**：`serial`
- **目标**：全部服务端业务规则可 API 验收
- **输入**：specs 五能力；tasks Batch 3–7
- **输出**：routes + domain + 对应 vitest PASS
- **完成标准**：prizes/participants/adminAuth/draw/eligibility/session 测试 PASS；e2e 冒烟前置 API 可用
- **Review gate**：`.superpowers/sdd/reviews/w2-domain-api.md`

### Wave 3 — 公共大屏 UI

- **Wave ID**：`w3-public-ui`
- **任务**：Batch 8–10（client 脚手架、四屏、控制条、滚动停靠、动效）
- **依赖 wave**：`w2-domain-api`
- **策略**：`serial`
- **目标**：观众可见四屏与主持人控场完整
- **输入**：public-lottery-screens + enrollment specs；tasks 8–10
- **输出**：`client/` 公共舞台与控制条
- **完成标准**：相关 client vitest PASS；手工可切四屏并开抽停靠
- **Review gate**：`.superpowers/sdd/reviews/w3-public-ui.md`

### Wave 4 — Admin 与收口

- **Wave ID**：`w4-admin-closeout`
- **任务**：Batch 11–12（Admin 页、README、e2e-smoke）
- **依赖 wave**：`w3-public-ui`
- **策略**：`serial`
- **目标**：内定管理可用且文档/冒烟齐备
- **输入**：hard-preset-draw + local-lottery-api；tasks 11–12
- **输出**：`/admin`、README、`e2e-smoke` PASS
- **完成标准**：端到端「内定必中」冒烟 PASS；README 可按步骤复现
- **Review gate**：`.superpowers/sdd/reviews/w4-admin-closeout.md`

## Test Obligations

- **必须先从失败测试开始的行为**：health、JsonStore、奖品校验、重名 409、admin 401/登录后 200、硬内定/随机/空池/已中奖拦截、public view 无鉴权、PrizeScreen 渲染、NameTicker 循环、Admin 登录表单、e2e-smoke。
- **必需的边界情况**：缺字段奖品、重名、无当前奖、空 eligible、内定已中奖者、无口令写、重启保数据。
- **回归敏感区域**：`draw.ts` / `eligibility.ts` / participants 重名 / adminAuth。

## Requirement Coverage Cross-Check

| Spec Requirement | Test obligation | Batch/Wave |
|---|---|---|
| 奖品列表可配置 / 当前奖品 / 无奖禁抽 | prizes tests | B3 / W2 |
| 手动添加用户 / 重名拒绝 / 假二维码 | participants + EnrollScreen | B4,B9 / W2–W3 |
| 四屏 / 奖品屏 / 滚动 / 中奖 / 控制条 / 淡入淡出 | session + UI tests | B7,B9,B10 / W2–W3 |
| 硬内定 / 必中 / 随机 / 不可重复 / 开奖前置 | draw+eligibility tests | B6 / W2 |
| JSON API / 口令 / 读写分离 | adminAuth+public+e2e | B5,B7,B12 / W2,W4 |

未映射需求：无。

## Execution Mode

- **可用方式与推荐**：待 DP-3 后运行 `ssf execution recommend`（建议 `batch-inline` 或 `sdd`；本变更 4 waves / 12 batches，推荐 `sdd` 若宿主支持；否则 `batch-inline` 串行）。
- **用户确认的模式**：待 DP-4 填写
- **推荐理由 / 项目事实**：待 recommend 输出
- **非推荐选择的风险确认**：若适用
- **执行计划命令**：待用户确认后执行
- **允许的修订**：仅按 CLI `execution revise` 规则升级/重规划
- **计划 revision / artifact hash**：待 plan 后回填；当前 `artifacts_hash` 见 `.spec-superflow.yaml`

## Verification Dimensions

| 维度 | 状态 | 发现 |
|------|------|------|
| Completeness | Pending | 覆盖表已列全；待实现后复核 |
| Correctness | Pending | — |
| Coherence | Pending | proposal/specs/design/tasks 已对齐 |

**总体结论**：Pending（待实现与验证）

## Review Gates

- **强制审查点**：每个 Execution Wave 完成后记录 `ssf execution review` receipt
- **阻塞类别**：依赖 wave 未 pass、receipt fail/缺失/过期、无 current execution plan
- **收口条件**：w1–w4 均有 `pass` review receipt，且 spec_merged / 归档按 release-archivist

## Escalation Rules

- **何时回退到 `specifying`**：新增真扫码/一奖多名/改软内定等范围变化；需求与 tasks 漂移。
- **何时回退到 `bridging`**：实现中发现合同与设计冲突需改约束但范围不变。
- **何时不得继续实现**：DP-3 未批准；无 `current: true` execution plan；wave review 未 pass；合同过期（artifacts/contract hash 不匹配）。

## Ambiguity Flags

- 本机无 Git：wave review 的 base/head SHA 可能不可用 → 实现期用内容 hash 或时间戳路径记录，并在 review 报告中注明。
- Admin 口令存储：开发默认本地配置明文或哈希均可，但 README 必须写明默认口令与仅本机可信前提。
