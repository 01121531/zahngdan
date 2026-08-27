# zahngdan

“轻账”是一个移动端与桌面端自适应的私有个人账单平台，用于记录收入、支出、分类、支付方式，以及为每笔账单保存图片、PDF 和 Office 等附件。

## 在线使用

[打开轻账](https://qingzhang-personal-ledger.liheyangedu.chatgpt.site)

站点采用私有访问策略，并在应用内使用独立密码保护。初始密码不会写入公开仓库，请在首次登录后立即修改密码。

## 功能

- 收入、支出记录与月度统计
- 分类、支付方式和多条件筛选
- 每笔账单最多 10 个附件，支持图片、HEIC、PDF、Word、Excel、CSV 和 TXT
- 图片灯箱、PDF 站内预览和原始文件下载
- 账单与附件回收站，30 天内可恢复
- CSV 导出和“CSV + 原始附件”ZIP 完整备份
- 浅色、深色与跟随系统主题
- 设置页在线检查 GitHub 最新版本

## 本地开发

```bash
npm install
npm run dev
```

提交前可运行：

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

GitHub Actions 会在推送和拉取请求时自动执行以上检查。发布新版本时，请更新 `public/version.json` 中的版本号和说明，再将同一提交部署到线上站点。

## 技术栈

TypeScript、React、Next.js/Vinext、Tailwind CSS、Radix UI、Recharts、Cloudflare D1 和 R2。
