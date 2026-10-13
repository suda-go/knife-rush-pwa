// Knife Rush Fruit 推送服务器
// 职责：1) 托管上层 PWA 静态文件  2) 保存订阅  3) 发送 Web Push
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const webpush = require('web-push');

const ROOT = path.join(__dirname, '..');            // 复用上层 PWA 静态文件
const VAPID_FILE = path.join(__dirname, 'vapid.json');
const SUBS_FILE = path.join(__dirname, 'subscriptions.json');
const PORT = process.env.PORT || 3000;

// ---------- VAPID ----------
if (!fs.existsSync(VAPID_FILE)) {
  const keys = webpush.generateVAPIDKeys();
  fs.writeFileSync(VAPID_FILE, JSON.stringify({
    publicKey: keys.publicKey,
    privateKey: keys.privateKey,
    subject: 'mailto:admin@example.com',
    adminToken: crypto.randomBytes(16).toString('hex')
  }, null, 2));
  console.log('首次启动：已自动生成 vapid.json');
}
const vapid = JSON.parse(fs.readFileSync(VAPID_FILE, 'utf8'));
webpush.setVapidDetails(vapid.subject || 'mailto:admin@example.com', vapid.publicKey, vapid.privateKey);

// ---------- 订阅存储（demo 用文件；生产换数据库）----------
let subs = [];
try { subs = JSON.parse(fs.readFileSync(SUBS_FILE, 'utf8')); } catch (e) { subs = []; }
function saveSubs() { fs.writeFileSync(SUBS_FILE, JSON.stringify(subs, null, 2)); }

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon'
};

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');          // demo 放开；生产应限制为你的站点域名
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Admin-Token');
}
function sendJson(res, code, obj) {
  cors(res);
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(obj));
}
function readBody(req) {
  return new Promise((resolve) => {
    let b = '';
    req.on('data', (c) => { b += c; if (b.length > 1e6) req.destroy(); });
    req.on('end', () => { try { resolve(JSON.parse(b || '{}')); } catch (e) { resolve({}); } });
  });
}

async function sendToAll(payload) {
  const data = JSON.stringify(payload);
  const keep = [];
  let sent = 0, failed = 0, pruned = 0;
  await Promise.all(subs.map(async (s) => {
    try { await webpush.sendNotification(s, data); sent++; keep.push(s); }
    catch (err) {
      failed++;
      if (err.statusCode === 404 || err.statusCode === 410) { pruned++; }  // 订阅已失效，丢弃
      else { keep.push(s); }
    }
  }));
  subs = keep; saveSubs();
  return { sent, failed, pruned, total: subs.length };
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const p = url.pathname;

  if (req.method === 'OPTIONS') { cors(res); res.writeHead(204); return res.end(); }

  // ---------- API ----------
  if (p === '/api/vapidPublicKey') return sendJson(res, 200, { key: vapid.publicKey });

  if (p === '/api/subscribe' && req.method === 'POST') {
    const sub = await readBody(req);
    if (!sub || !sub.endpoint) return sendJson(res, 400, { error: 'invalid subscription' });
    if (!subs.find((s) => s.endpoint === sub.endpoint)) { subs.push(sub); saveSubs(); }
    return sendJson(res, 201, { ok: true, count: subs.length });
  }

  if (p === '/api/unsubscribe' && req.method === 'POST') {
    const { endpoint } = await readBody(req);
    subs = subs.filter((s) => s.endpoint !== endpoint); saveSubs();
    return sendJson(res, 200, { ok: true, count: subs.length });
  }

  if (p === '/api/send' && req.method === 'POST') {
    // demo 级保护：发送需带 X-Admin-Token。生产务必换成正规鉴权（登录/后台）。
    if ((req.headers['x-admin-token'] || '') !== vapid.adminToken)
      return sendJson(res, 401, { error: 'unauthorized' });
    const body = await readBody(req);
    const result = await sendToAll({
      title: body.title || '🍉 Knife Rush Fruit',
      body: body.body || '新关卡上线，回来切一局！',
      url: body.url || '/knife-rush-pwa/index.html?src=push'
    });
    return sendJson(res, 200, { ok: true, ...result });
  }

  if (p === '/api/stats') return sendJson(res, 200, { subscriptions: subs.length });

  // ---------- 安全：禁止访问服务端私密文件 ----------
  if (p.startsWith('/push-server') || p.includes('/.git')) { res.writeHead(403); return res.end('forbidden'); }

  // ---------- 静态文件 ----------
  let file = path.join(ROOT, decodeURIComponent(p));
  if (p === '/' || p.endsWith('/')) file = path.join(ROOT, 'index.html');
  const rel = path.relative(ROOT, file);
  if (rel.startsWith('..') || path.isAbsolute(rel)) { res.writeHead(403); return res.end('forbidden'); }
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    res.end(buf);
  });
});

server.listen(PORT, () => {
  console.log('------------------------------------------------');
  console.log(`PWA + 推送服务: http://localhost:${PORT}`);
  console.log(`VAPID public key : ${vapid.publicKey}`);
  console.log(`admin token      : ${vapid.adminToken}`);
  console.log(`当前订阅数        : ${subs.length}`);
  console.log('发送：node send.js "标题" "正文"');
  console.log('------------------------------------------------');
});
