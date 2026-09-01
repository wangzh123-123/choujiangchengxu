# 抽奖大屏 Lottery Display App

本地可运行的抽奖展示系统：对外四屏 + 内部管理（硬内定）。

## 启动（开发）

需要 Node.js。在两个终端分别执行：

```bash
npm run dev --prefix server
npm run dev --prefix client
```

- 大屏：http://127.0.0.1:5173/
- 管理：http://127.0.0.1:5173/admin
- API 健康检查：http://127.0.0.1:3001/api/health

默认管理口令：`admin123`（见 `data/config.json`）

## 生产模式（本地单进程）

构建前端并由 Express 同时提供页面与 API：

```bash
npm run build
# Windows PowerShell:
$env:NODE_ENV="production"; npm run start
# Linux / macOS / Render:
# NODE_ENV=production npm run start
```

- 访问：http://127.0.0.1:3001/（大屏）、http://127.0.0.1:3001/admin

## 部署到 Render（免费公网）

适合远程测试与短期活动（如十月使用后下线）。

1. 将仓库连接到 [Render](https://render.com)，使用根目录 `render.yaml`（Blueprint）或手动创建 Web Service。
2. 在 Render Dashboard 设置环境变量 **`ADMIN_PASSPHRASE`**（强口令，勿用 `admin123`）。
3. 部署完成后使用 Render 提供的 `https://xxx.onrender.com` 访问大屏与 `/admin`。

**数据持久说明：**

- 参与者、内定、中奖记录保存在容器内 `data/*.json`；**关闭浏览器不影响数据**。
- 免费档约 15 分钟无访问后会休眠，再次打开可能有冷启动延迟；活动前可访问一次预热。
- **重新部署（Redeploy）会清空磁盘数据**；十月活动期间请避免 Redeploy。活动前可备份 `data/` 目录。

**十月后：** 在 Render 删除该 Web Service 即可。


## 默认奖品

正式奖品清单在 `catalog/prizes.json`，图片在 `catalog/uploads/`。服务器启动时会覆盖写入 `data/prizes.json`，并把用到的图片拷到 `data/uploads/`。未写数量的旧数据按 1 份处理。

本地配置奖品（写入仓库文件，不会自动提交）：

```bash
npm run setup:prizes
```

浏览器会打开配奖页。保存后请自行 `git add` / `commit` / `push`。若提示端口占用，先关掉 5173 和 3001 上的进程。现场 `/admin` 不能改奖品。

## 现场流程

1. 打开大屏 URL，投屏给观众。新会话默认停在「参与」屏。
2. 用控制条切换：参与 → 奖品 → 抽奖 → 中奖；可「隐藏」控制条。
3. 在参与页逐个输入姓名添加用户（可改名、删除；已中奖者不能删除；重名会提示）。无需填写用户 ID。
4. 内定仍在 `/admin` 按次设置（可选）。奖品名称、数量、图片用上面的本地命令改。
5. 大屏选奖后点「开始抽奖」滚动，点「停」开奖；约 1 秒内停到中奖人并高亮，再停留约 3 秒。同一奖未抽满则继续开始/停；抽满后自动进中奖公示，上方为本奖全部中奖人。

## 测试

```bash
npm run test --prefix server
npm run test --prefix client
```

## 说明

- 本版用姓名录入参与，不接真实扫码。
- 管理口令仅防误触，请勿暴露到不可信网络。
- 数据保存在 `data/*.json`，重启不丢。
