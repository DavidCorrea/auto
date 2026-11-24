// Memory mark particle burst — particles fly out from the chosen mark onto the fragment canvas.
(function () {
  var frag = document.getElementById('fragment');
  var canvas = document.getElementById('fragment-constellation');
  if (!frag || !canvas || !canvas.getContext) return;
  var ctx = canvas.getContext('2d');
  if (!ctx) return;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:0';
  var parts = [], running = false;

  function size() {
    var r = frag.getBoundingClientRect();
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.round(r.width * dpr));
    canvas.height = Math.max(1, Math.round(r.height * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  size();
  window.addEventListener('resize', size);

  function tick() {
    var w = canvas.width / (Math.min(window.devicePixelRatio || 1, 2));
    var h = canvas.height / (Math.min(window.devicePixelRatio || 1, 2));
    ctx.clearRect(0, 0, w, h);
    for (var i = parts.length - 1; i >= 0; i--) {
      var p = parts[i];
      p.x += p.vx; p.y += p.vy;
      p.vy += 0.05; p.vx *= 0.97; p.vy *= 0.97;
      p.life -= 0.018;
      if (p.life <= 0) { parts.splice(i, 1); continue; }
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = 'hsl(' + p.hue + ',85%,62%)';
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    if (parts.length) requestAnimationFrame(tick);
    else { running = false; ctx.clearRect(0, 0, w, h); }
  }

  function burst(x, y) {
    if (reduce) return;
    var n = 24;
    for (var i = 0; i < n; i++) {
      var a = (Math.PI * 2 * i) / n + Math.random() * 0.4;
      var sp = 0.8 + Math.random() * 2.2;
      parts.push({
        x: x, y: y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: 1, r: 1 + Math.random() * 1.8,
        hue: 245 + Math.random() * 70
      });
    }
    if (!running) { running = true; requestAnimationFrame(tick); }
  }

  function origin(el) {
    var r = frag.getBoundingClientRect();
    var b = el.getBoundingClientRect();
    var x = b.left + b.width / 2 - r.left;
    var y = b.top + b.height / 2 - r.top;
    return {
      x: Math.max(8, Math.min(r.width - 8, x)),
      y: Math.max(8, Math.min(r.height - 8, y))
    };
  }

  document.addEventListener('click', function (e) {
    var t = e.target;
    var m = t && t.closest ? t.closest('.mark') : null;
    if (!m) return;
    var o = origin(m);
    burst(o.x, o.y);
  }, true);

  document.addEventListener('keydown', function (e) {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    var on = document.querySelector('.mark.on');
    if (!on) return;
    var o = origin(on);
    burst(o.x, o.y);
  });
})();