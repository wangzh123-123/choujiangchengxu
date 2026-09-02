# 大屏内容黑框仅保留参与页设计

**日期：** 2026-09-02  
**状态：** 口头设计已逐段确认；书面规格待审阅  
**范围：** 观众大屏中间半透明内容底只留在参与页；奖品、抽奖、中奖三页只显示文字和图片。不改控制条、奖品图框、接口、后台。

---

## 1. 背景与目标

### 1.1 现状

- 四页共用 `section.screen`。`stage.css` 中 `.screen` 带 `background: rgba(8, 14, 24, 0.72)` 与 `border-radius: 18px`，形成中间大块半透明黑框。
- 各页已有修饰 class：`prize-screen`、`enroll-screen`、`draw-screen`、`winner-screen`。
- 舞台幕布在 `.stage`；主持人条 `.host-bar` 自有深色底；奖品图 `.prize-image-wrap` 自有金边方框与深色填充。

### 1.2 已确认需求

| 维度 | 选择 |
|------|------|
| 参与页 | 保留现有半透明内容底 |
| 奖品 / 抽奖 / 中奖 | 去掉内容黑框，只留文字和图片 |
| 实现 | 方案 A：只改 CSS，把底从 `.screen` 挪到 `.enroll-screen` |
| 图框 | `.prize-image-wrap` 金边方框保留 |
| 可读性 | 不加文字描边/阴影 |

### 1.3 目标

- 参与页名单仍落在半透明底上。
- 其它三页能直接看到舞台幕布，标题与奖品图仍在原位置。

### 1.4 非目标

- 改字色、控制条、抽奖滚动、中奖动效、四屏流程、接口。
- 去掉奖品图金边方框。
- 为无底页面加描边或新背景层。
- 改后台 `/admin`、配奖页。
- 新增自动化测试或 npm 依赖。

---

## 2. 样式

只改 `client/src/styles/stage.css`。

### 2.1 `.screen`

保留：

- `width: min(960px, 100%)`
- `text-align: center`
- `padding: 1.5rem 1.25rem`

删除：

- `background: rgba(8, 14, 24, 0.72)`
- `border-radius: 18px`

### 2.2 `.enroll-screen`

新增（或补全）规则，值与当前 `.screen` 黑框相同：

- `background: rgba(8, 14, 24, 0.72)`
- `border-radius: 18px`

不改 `EnrollScreen.tsx`：根节点已是 `className="screen enroll-screen"`。

不改 `.host-bar`（约 `rgba(8, 14, 24, 0.92)`）、`.prize-image-wrap`、`.stage` 幕布。

---

## 3. 错误与边界

- 奖品/抽奖/中奖浅色字叠在红幕上，对比弱于有底时；本次接受，不加描边。
- 无新接口、无新失败提示。
- 切页淡入、名单滚动、中奖高亮保持现有 CSS。

---

## 4. 验收

- `.screen` 不再设置半透明底与圆角。
- `.enroll-screen` 带与改前相同的底与圆角。
- 本地大屏：参与页有内容底；奖品、抽奖、中奖无中间大黑框，文字与奖品图仍显示。
- 控制条外观不变；`/admin` 与配奖页不变。
- 不新增单元测试。现有 client 测试不为这块底改断言。

---

## 5. 组件改动（最小集合）

| 位置 | 改动 |
|------|------|
| `client/src/styles/stage.css` | `.screen` 去掉底与圆角；`.enroll-screen` 接过这两条 |

不改：各 `*Screen.tsx`、`PublicStage.tsx`、`server/**`、`data/**`、`catalog/**`。
