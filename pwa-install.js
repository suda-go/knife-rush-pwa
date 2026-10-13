// PWA：Service Worker 注册 + 「添加到桌面」引导（安卓 Chrome）
(function () {
  'use strict';

  var deferredPrompt = null;
  var DISMISS_KEY = 'krf_a2hs_dismissed_at';
  var DISMISS_DAYS = 7;

  var banner = document.getElementById('a2hs');
  var installBtn = document.getElementById('a2hsInstall');
  var closeBtn = document.getElementById('a2hsClose');
  var manualTip = document.getElementById('manualTip');
  var manualClose = document.getElementById('manualClose');

  var isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
                     window.navigator.standalone === true;

  // --- 轻量埋点（接你们现有系统）---
  function track(name, data) {
    try { console.log('[track]', name, data || {}); } catch (e) {}
    dbgState(name);
  }

  // ---------- 1. 注册 Service Worker ----------
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('./sw.js', { scope: './' })
        .then(function (reg) {
          dbgSet('dbgSW', reg.active ? 'active' : 'installing', !!reg.active);
          navigator.serviceWorker.ready.then(function () { dbgSet('dbgSW', 'active', true); });
        })
        .catch(function (err) {
          dbgSet('dbgSW', '注册失败', false);
          console.warn('SW register failed', err);
        });
    });
  } else {
    dbgSet('dbgSW', '不支持', false);
  }

  // ---------- 2. 捕获可安装事件 ----------
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();          // 拦掉 Chrome 默认提示，改用自己的 UI
    deferredPrompt = e;
    dbgSet('dbgInstallable', '是', true);
    track('a2hs_available');
  });

  // ---------- 3. 合适时机展示引导 ----------
  // 玩完一局再引导，最自然；没触发 prompt 时给手动兜底。
  document.addEventListener('krf:played', function () {
    if (isStandalone) return;
    if (deferredPrompt && !dismissedRecently()) {
      showBanner();
    } else if (!deferredPrompt) {
      showManual();              // 条件没满足/冷却期：教用户手动添加
    }
  });

  function showBanner() {
    if (!banner) return;
    banner.hidden = false;
    track('a2hs_shown');
  }
  function hideBanner() { if (banner) banner.hidden = true; }
  function showManual() { if (manualTip) manualTip.hidden = false; }
  function hideManual() { if (manualTip) manualTip.hidden = true; }

  // ---------- 4. 触发原生安装框 ----------
  function triggerInstall() {
    if (!deferredPrompt) { showManual(); return; }
    deferredPrompt.prompt();                       // 必须在用户手势里调用
    deferredPrompt.userChoice.then(function (choice) {
      track('a2hs_result', { outcome: choice.outcome }); // accepted | dismissed
      if (choice.outcome === 'dismissed') markDismissed();
      deferredPrompt = null;
      dbgSet('dbgInstallable', '已用', false);
      hideBanner();
    });
  }

  if (installBtn) installBtn.addEventListener('click', triggerInstall);
  if (closeBtn) closeBtn.addEventListener('click', function () {
    hideBanner();
    markDismissed();
    track('a2hs_dismissed');
  });
  if (manualClose) manualClose.addEventListener('click', hideManual);
  if (manualTip) manualTip.addEventListener('click', function (e) {
    if (e.target === manualTip) hideManual();
  });

  // ---------- 5. 安装成功 ----------
  window.addEventListener('appinstalled', function () {
    track('a2hs_installed');
    hideBanner();
    deferredPrompt = null;
  });

  // ---------- 6. 以独立应用启动（已安装） ----------
  if (isStandalone) {
    dbgSet('dbgMode', 'standalone', true);
    track('launch_standalone');
    toast('🎉 已从桌面启动');
  }

  // ---------- 工具 ----------
  function dismissedRecently() {
    var t = +localStorage.getItem(DISMISS_KEY) || 0;
    return Date.now() - t < DISMISS_DAYS * 864e5;
  }
  function markDismissed() {
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch (e) {}
  }
  function toast(msg) {
    var t = document.createElement('div');
    t.className = 'toast';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, 2600);
  }

  // ---------- 调试面板 ----------
  function dbgSet(id, text, ok) {
    var el = document.getElementById(id);
    if (!el) return;
    el.textContent = text;
    if (ok === true) { el.className = 'ok'; }
    else if (ok === false) { el.className = 'no'; }
    else { el.className = ''; }
  }
  function dbgState(s) { var el = document.getElementById('dbgState'); if (el) el.textContent = s; }

  var dbgTrigger = document.getElementById('dbgTrigger');
  var dbgReset = document.getElementById('dbgReset');
  var dbgToggle = document.getElementById('dbgToggle');
  var dbg = document.getElementById('dbg');
  if (dbgTrigger) dbgTrigger.addEventListener('click', triggerInstall);
  if (dbgReset) dbgReset.addEventListener('click', function () {
    try { localStorage.removeItem(DISMISS_KEY); } catch (e) {}
    toast('已重置忽略状态');
  });
  if (dbgToggle) dbgToggle.addEventListener('click', function () {
    if (dbg.classList.contains('mini')) { dbg.classList.remove('mini'); rebuildDbg(); }
    else { dbg.classList.add('mini'); dbg.textContent = '调试'; }
  });
  var _dbgHTML = dbg ? dbg.innerHTML : '';
  function rebuildDbg() {
    dbg.innerHTML = _dbgHTML;
    // 重新绑定（innerHTML 重建后引用失效）
    document.getElementById('dbgTrigger').addEventListener('click', triggerInstall);
    document.getElementById('dbgReset').addEventListener('click', function () {
      try { localStorage.removeItem(DISMISS_KEY); } catch (e) {}
      toast('已重置忽略状态');
    });
    document.getElementById('dbgToggle').addEventListener('click', function () {
      dbg.classList.add('mini'); dbg.textContent = '调试';
    });
    // 恢复当前状态显示
    if (isStandalone) dbgSet('dbgMode', 'standalone', true);
    dbgSet('dbgInstallable', deferredPrompt ? '是' : '否', !!deferredPrompt);
  }
  if (dbg) dbg.addEventListener('click', function () {
    if (dbg.classList.contains('mini')) { dbg.classList.remove('mini'); rebuildDbg(); }
  });
})();
