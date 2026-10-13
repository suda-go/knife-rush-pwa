// 生成 VAPID 密钥对 + 发送用的 adminToken，写入 vapid.json（私钥仅存服务端，勿提交）
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const webpush = require('web-push');

const file = path.join(__dirname, 'vapid.json');
if (fs.existsSync(file)) {
  const v = JSON.parse(fs.readFileSync(file, 'utf8'));
  console.log('vapid.json 已存在，跳过生成。');
  console.log('publicKey :', v.publicKey);
  console.log('adminToken:', v.adminToken);
  process.exit(0);
}

const keys = webpush.generateVAPIDKeys();
const data = {
  publicKey: keys.publicKey,
  privateKey: keys.privateKey,
  subject: 'mailto:admin@example.com',
  adminToken: crypto.randomBytes(16).toString('hex')
};
fs.writeFileSync(file, JSON.stringify(data, null, 2));
console.log('已生成 vapid.json');
console.log('publicKey :', data.publicKey);
console.log('adminToken:', data.adminToken);
