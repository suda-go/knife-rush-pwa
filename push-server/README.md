# Knife Rush Fruit · 推送服务器

一个零框架的 Node 服务（内置 `http` + `web-push`），同时：

- 托管上层 PWA 静态文件（这样 `http://localhost:3000` 打开的页面和推送接口**同源**，省掉跨域/HTTPS 的麻烦）
- 保存浏览器订阅
- 发送 Web Push

## 为什么必须有它

Web Push 的「发送」动作需要**服务端持有 VAPID 私钥**并调用推送服务（FCM / Mozilla autopush 等）。
GitHub Pages 是纯静态托管，发不了推送。客户端的订阅逻辑和 Service Worker 可以继续放在 Pages，
但要真正把通知推出去，就得跑这个服务（本地或部署到公网）。

## 本地运行

```bash
cd push-server
npm install            # 安装 web-push
npm run keys           # 生成 VAPID 密钥 + adminToken（写入 vapid.json，已 gitignore）
npm start              # 启动 http://localhost:3000
```

然后：

1. 浏览器开 `http://localhost:3000`（localhost 是安全上下文，Push 可用）。
2. 点页面上的 **「🔔 开启上新 / 体力提醒」**，允许通知。此时订阅会存到 `subscriptions.json`。
3. 发送一条推送：

```bash
node send.js "🍉 新关卡上线" "三条新地图已解锁，来切一局！"
# 第三个参数可选：点击通知后打开的链接
```

几秒内就会收到系统通知；点击通知会聚焦/打开游戏页。

## HTTP 接口

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/vapidPublicKey` | 返回 VAPID 公钥（客户端订阅用） |
| POST | `/api/subscribe` | body 为订阅对象，保存订阅 |
| POST | `/api/unsubscribe` | body `{endpoint}`，删除订阅 |
| POST | `/api/send` | 发送给所有订阅；需请求头 `X-Admin-Token`（见 vapid.json） |
| GET | `/api/stats` | 当前订阅数 |

远程触发发送示例：

```bash
curl -X POST http://localhost:3000/api/send \
  -H "Content-Type: application/json" \
  -H "X-Admin-Token: <vapid.json 里的 adminToken>" \
  -d '{"title":"体力已满","body":"回来清体力！","url":"/knife-rush-pwa/index.html?src=push"}'
```

## 部署到公网（手机 / 线上）

手机要收推送，这个服务必须公网可达且 HTTPS。把 `push-server/` 部署到任意 Node 平台
（Render / Railway / Fly.io / 云服务器等），然后：

- 若页面继续托管在 GitHub Pages，在页面里设置 `window.KRF_PUSH_API = 'https://你的推送服务域名'`
  （或改 `push-client.js` 顶部的 `PUSH_API`），这样订阅请求会打到你的服务。
- 把 CORS 的 `Access-Control-Allow-Origin` 从 `*` 收紧为你的站点域名。
- VAPID 密钥用环境变量注入，别提交 `vapid.json`。

## 安全须知（重要）

- `vapid.json` 含**私钥**，`subscriptions.json` 含用户端点，二者已在 `.gitignore`，切勿提交或公开。
- `/api/send` 目前只用一个 `adminToken` 做 demo 级保护。**生产环境必须换成正规鉴权**（后台登录/服务间密钥），否则任何人都能向你的用户群发推送。
- 通知遵循 `userVisibleOnly: true`：每次推送都要展示用户可见的通知，不可用于静默后台追踪。
