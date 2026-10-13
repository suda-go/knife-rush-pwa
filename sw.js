// Knife Rush Fruit - Service Worker
// 安卓 Chrome 要求有一个带 fetch 处理器的 SW，才会触发 beforeinstallprompt。
const CACHE = 'krf-pwa-v3';
const CORE = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './pwa-install.js',
  './push-client.js',
  './manifest.webmanifest',
  './pwa/icon-192.png',
  './pwa/icon-512.png'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(CORE).catch(() => {}))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  // 页面导航：优先网络，断网回退到缓存首页（保证可离线启动）
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(() => caches.match('./index.html'))
    );
    return;
  }

  // 其它同源 GET：缓存优先，缺失再走网络并回填缓存
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        return res;
      }).catch(() => cached);
    })
  );
});

// ---------- Web Push ----------
// 收到服务端推送：展示通知
self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; }
  catch (e) { data = { body: event.data && event.data.text() }; }

  const title = data.title || '🍉 Knife Rush Fruit';
  const options = {
    body: data.body || '新关卡上线，回来切一局！',
    icon: './pwa/icon-192.png',
    badge: './pwa/icon-192.png',
    vibrate: [80, 40, 80],
    tag: data.tag || 'krf-push',
    renotify: true,
    data: { url: data.url || './index.html?src=push' }
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

// 点击通知：聚焦已打开的页面或新开一个，并跳到指定链接
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || './index.html?src=push';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ('focus' in client) { client.navigate(url); return client.focus(); }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
