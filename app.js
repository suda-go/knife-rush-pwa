// 页面交互 + 一个极简「切水果」迷你游戏（模拟即点即玩）
(function () {
  'use strict';

  var playBtn = document.getElementById('playBtn');
  var overlay = document.getElementById('gameOverlay');
  var canvas = document.getElementById('gameCanvas');
  var statEl = document.getElementById('gameStat');
  var closeBtn = document.getElementById('gameClose');

  var ctx = canvas.getContext('2d');
  var dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
  var fruits = [];
  var score = 0;
  var timeLeft = 15;
  var raf = null;
  var timer = null;
  var running = false;
  var COLORS = ['#ff6b4a', '#ffce54', '#49d17f', '#8e2de2', '#f5af19'];

  function resize() {
    var r = canvas.getBoundingClientRect();
    canvas.width = r.width * dpr;
    canvas.height = r.height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function spawn() {
    var r = canvas.getBoundingClientRect();
    fruits.push({
      x: 40 + Math.random() * (r.width - 80),
      y: r.height + 30,
      vy: -(6 + Math.random() * 3),
      vx: (Math.random() - 0.5) * 3,
      rad: 26 + Math.random() * 10,
      color: COLORS[(Math.random() * COLORS.length) | 0],
      sliced: false
    });
  }

  function tick() {
    var r = canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, r.width, r.height);
    for (var i = fruits.length - 1; i >= 0; i--) {
      var f = fruits[i];
      f.vy += 0.12;              // 重力
      f.x += f.vx;
      f.y += f.vy;
      if (f.y > r.height + 60) { fruits.splice(i, 1); continue; }
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.rad, 0, Math.PI * 2);
      ctx.fillStyle = f.color;
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(255,255,255,.35)';
      ctx.stroke();
    }
    if (running) raf = requestAnimationFrame(tick);
  }

  function slash(x, y) {
    for (var i = fruits.length - 1; i >= 0; i--) {
      var f = fruits[i];
      var dx = x - f.x, dy = y - f.y;
      if (dx * dx + dy * dy <= (f.rad + 10) * (f.rad + 10)) {
        fruits.splice(i, 1);
        score++;
        updateStat();
        break;
      }
    }
  }

  function pointer(e) {
    var r = canvas.getBoundingClientRect();
    var p = (e.touches && e.touches[0]) || e;
    slash(p.clientX - r.left, p.clientY - r.top);
  }

  function updateStat() {
    statEl.textContent = 'Score ' + score + ' · ' + timeLeft + 's';
  }

  function start() {
    overlay.hidden = false;
    resize();
    score = 0; timeLeft = 15; fruits = []; running = true;
    updateStat();
    tick();
    var spawner = setInterval(function () { if (running) spawn(); }, 650);
    timer = setInterval(function () {
      timeLeft--; updateStat();
      if (timeLeft <= 0) { clearInterval(spawner); stop(); }
    }, 1000);
    overlay._spawner = spawner;
    // 用户已经玩起来了 —— 高意向时机
    document.dispatchEvent(new CustomEvent('krf:engaged'));
  }

  function stop() {
    running = false;
    cancelAnimationFrame(raf);
    clearInterval(timer);
    clearInterval(overlay._spawner);
    overlay.hidden = true;
    // 玩完一局 —— 这里再引导「添加到桌面」最自然
    document.dispatchEvent(new CustomEvent('krf:played', { detail: { score: score } }));
  }

  playBtn.addEventListener('click', start);
  closeBtn.addEventListener('click', stop);
  canvas.addEventListener('mousedown', pointer);
  canvas.addEventListener('touchstart', function (e) { e.preventDefault(); pointer(e); }, { passive: false });
  window.addEventListener('resize', function () { if (running) resize(); });
})();
