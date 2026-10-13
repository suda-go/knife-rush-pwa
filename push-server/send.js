// 命令行直接给所有订阅者发一条推送（本地演示最省事）
// 用法: node send.js "标题" "正文" "点击打开的链接(可选)"
const fs = require('fs');
const path = require('path');
const webpush = require('web-push');

const vapid = JSON.parse(fs.readFileSync(path.join(__dirname, 'vapid.json'), 'utf8'));
webpush.setVapidDetails(vapid.subject || 'mailto:admin@example.com', vapid.publicKey, vapid.privateKey);

const SUBS_FILE = path.join(__dirname, 'subscriptions.json');
let subs = [];
try { subs = JSON.parse(fs.readFileSync(SUBS_FILE, 'utf8')); } catch (e) { subs = []; }

const title = process.argv[2] || '🍉 Knife Rush Fruit';
const body = process.argv[3] || '体力已满，回来切一局！';
const url = process.argv[4] || '/knife-rush-pwa/index.html?src=push';
const payload = JSON.stringify({ title, body, url });

if (!subs.length) {
  console.log('还没有任何订阅。先在页面点「开启上新 / 体力提醒」并允许通知。');
  process.exit(0);
}

(async () => {
  let ok = 0, fail = 0, pruned = 0;
  const keep = [];
  for (const s of subs) {
    try { await webpush.sendNotification(s, payload); ok++; keep.push(s); }
    catch (e) {
      fail++;
      if (e.statusCode === 404 || e.statusCode === 410) { pruned++; }
      else { keep.push(s); console.warn('发送失败:', e.statusCode || e.message); }
    }
  }
  fs.writeFileSync(SUBS_FILE, JSON.stringify(keep, null, 2));
  console.log(`完成：成功 ${ok}，失败 ${fail}，清理过期 ${pruned}，剩余订阅 ${keep.length}`);
})();
