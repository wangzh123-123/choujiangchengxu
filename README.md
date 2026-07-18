# 抽奖大屏 Lottery Display App

本地可运行的抽奖展示系统：对外四屏 + 内部管理（硬内定）。

## 启动

需要 Node.js。在两个终端分别执行：

```bash
npm run dev --prefix server
npm run dev --prefix client
```

- 大屏：http://127.0.0.1:5173/
- 管理：http://127.0.0.1:5173/admin
- API 健康检查：http://127.0.0.1:3001/api/health

默认管理口令：`admin123`（见 `data/config.json`）

## 默认奖品

仓库已预置 3 个示例奖品（一/二/三等奖），图片为 `data/uploads/prize-default.svg`，当前奖品默认选中「一等奖（示例）」。

你可随时在 `/admin` 修改名称、图片文件名，或把真实图片放入 `data/uploads/` 后填写文件名。

## 现场流程

1. 打开大屏 URL，投屏给观众。
2. 用控制条切换：奖品 → 参与 → 抽奖 → 中奖；可「隐藏」控制条。
3. 在参与页添加用户（id + 名称；重名会提示）。
4. 在 `/admin` 登录后按奖品设置内定（可选）；有内定则开奖必中。
5. 在大屏选择当前奖品，点「开始抽奖」。

## 测试

```bash
npm run test --prefix server
npm run test --prefix client
```

## 说明

- 假二维码仅为展示，本版不接真实扫码。
- 管理口令仅防误触，请勿暴露到不可信网络。
- 数据保存在 `data/*.json`，重启不丢。
