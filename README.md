# Knife Rush Fruit · PWA 添加到桌面 Demo

基于游戏落地页复刻的最小可运行 PWA，演示**安卓 Chrome「添加到桌面」**完整流程：
Service Worker 注册 → `beforeinstallprompt` 捕获 → 自定义引导条 → 原生安装框 → 安装成功回收 → 桌面图标启动。

## 目录结构

```
knife-rush-pwa/
├─ index.html            落地页 + 引导条/兜底弹层/调试面板
├─ styles.css            样式
├─ app.js                页面交互 + 极简「切水果」迷你游戏（即点即玩）
├─ pwa-install.js        PWA 核心：SW 注册 + 安装引导逻辑
├─ sw.js                 Service Worker（带 fetch 处理器，缓存可离线）
├─ manifest.webmanifest  应用清单
└─ pwa/                  192 / 512 / 512-maskable 图标
```

## 本地运行

Service Worker 需要安全上下文，`http://localhost` 视为安全，可直接跑：

```bash
cd knife-rush-pwa
python3 -m http.server 8080
# 打开 http://localhost:8080
```

> 必须用 http 服务访问，别直接双击用 `file://` 打开（SW 不会生效）。

## 体验流程

1. 用 Chrome 打开页面，右上角**调试面板**会显示 Service Worker 是否 active、是否已可安装。
2. 点 **Play Free** 玩一局（点水果切开），结束后会从底部弹出**「添加到桌面」**引导条。
3. 点「添加」→ 弹出系统安装框 → 确认后桌面出现图标。
4. 从桌面图标启动，页面以独立窗口打开，顶部提示「🎉 已从桌面启动」。

调试面板还提供「触发安装 / 重置忽略 / 收起」，方便反复测试。

## 在真机（安卓）上测

桌面 `localhost` 不是手机的 localhost，用 Chrome 的端口转发：

1. 手机开**开发者选项 + USB 调试**，连电脑。
2. 电脑 Chrome 打开 `chrome://inspect`，在 **Port forwarding** 加 `8080 → localhost:8080` 并勾选启用。
3. 手机 Chrome 访问 `http://localhost:8080`（经转发仍是安全上下文），即可测真实安装与 WebAPK 生成。

## 验证清单

- DevTools → **Application → Manifest**：无报错，图标正常，可点 “Install”。
- DevTools → **Application → Service Workers**：状态 activated。
- **Lighthouse** 的 Installability 审计应通过。
- 安卓真机能看到安装框，装完桌面有独立图标和启动画面。

## 搬到你们线上页面要改什么

1. 把 `manifest.webmanifest`、`sw.js`、`pwa/` 三样放到站点，`<head>` 加 `manifest` 链接和 `theme-color`。
2. `sw.js` 放到**能覆盖 start_url 的路径**（通常站点根 `/sw.js`，scope 最大）。
3. `pwa-install.js` 里的引导时机换成你们的真实节点（如点击真正的 Play 之后），`track()` 接自己的埋点。
4. 图标换成和游戏一致的本机同源 PNG（192 / 512 /一张 maskable）。
5. 上线前删掉页面里的**调试面板**（`#dbg` 那段 DOM 和对应逻辑）。

## 已知边界

- 仅针对安卓 Chrome / 同内核浏览器。`beforeinstallprompt` 不触发时（条件未满足、或用户拒绝后的冷却期）走手动引导兜底。
- iOS 不支持该事件（本 demo 不处理，你们只做安卓）。
