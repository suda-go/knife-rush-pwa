// Web Push 客户端：请求授权 → 订阅 → 把订阅发给推送服务器
// 参考 web.dev 通知指南 https://web.dev/explore/notifications
(function () {
  'use strict';

  // 客户端与推送服务同源时留空即可（本地用 Node server 跑）。
  // 若把本页单独托管在 github.io，这里改成你的推送服务器地址，例如 'https://your-push-server.com'
  var PUSH_API = window.KRF_PUSH_API || '';

  var btn = document.getElementById('notifyBtn');
  if (!btn) return;

  var supported = ('serviceWorker' in navigator) && ('PushManager' in window) && ('Notification' in window);
  if (!supported) { setBtn('浏览器不支持通知', true); dbg('不支持'); return; }

  refresh();
  btn.addEventListener('click', enable);

  async function enable() {
    try {
      setBtn('请求授权…', true);
      var perm = await Notification.requestPermission();
      dbg(perm);
      if (perm !== 'granted') { setBtn('🔔 通知被拒绝', true); return; }

      var reg = await navigator.serviceWorker.ready;
      var sub = await reg.pushManager.getSubscription();
      if (!sub) {
        var res = await fetch(PUSH_API + '/api/vapidPublicKey');
        if (!res.ok) throw new Error('no-server');
        var key = (await res.json()).key;
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,                       // 规范要求：订阅必须对应用户可见的通知
          applicationServerKey: urlB64ToUint8Array(key)
        });
      }
      // 把订阅对象交给服务器保存（服务器据此发送）
      await fetch(PUSH_API + '/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sub)
      });
      setBtn('✅ 通知已开启', true);
      dbg('subscribed');
      track('push_subscribed');
    } catch (e) {
      if (e.message === 'no-server') setBtn('需先运行推送服务器', false);
      else setBtn('开启失败，点此重试', false);
      dbg('错误:' + (e.message || e));
      console.warn('[push] enable failed:', e);
    }
  }

  async function refresh() {
    if (Notification.permission === 'denied') { setBtn('🔔 通知被拒绝', true); dbg('denied'); return; }
    var reg = await navigator.serviceWorker.ready.catch(function () { return null; });
    var sub = null;
    if (reg) sub = await reg.pushManager.getSubscription();
    if (sub && Notification.permission === 'granted') { setBtn('✅ 通知已开启', true); dbg('subscribed'); }
    else { setBtn('🔔 开启上新 / 体力提醒', false); dbg(Notification.permission); }
  }

  function setBtn(text, disabled) { btn.textContent = text; btn.disabled = !!disabled; }
  function dbg(s) {
    var el = document.getElementById('dbgPush');
    if (!el) return;
    el.textContent = s;
    el.className = (s === 'subscribed' || s === 'granted') ? 'ok'
      : (s === 'denied' || String(s).indexOf('错误') === 0 || s === '不支持') ? 'no' : '';
  }
  function track(n) { try { console.log('[track]', n); } catch (e) {} }

  // VAPID 公钥（base64url 字符串）转 Uint8Array
  function urlB64ToUint8Array(base64String) {
    var padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    var base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    var raw = atob(base64);
    var arr = new Uint8Array(raw.length);
    for (var i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
    return arr;
  }
})();
