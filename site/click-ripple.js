(function () {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var style = document.createElement('style');
  style.textContent =
    '@keyframes click-ripple{from{transform:translate(-50%,-50%) scale(.15);opacity:.85}to{transform:translate(-50%,-50%) scale(6);opacity:0}}' +
    '@keyframes click-spark{to{transform:translate(var(--dx),var(--dy)) scale(0);opacity:0}}' +
    '.click-ripple{position:fixed;left:0;top:0;width:60px;height:60px;border-radius:50%;pointer-events:none;z-index:9998;border:2px solid var(--site-accent,#0066cc);animation:click-ripple 750ms cubic-bezier(.2,.7,.3,1) forwards}' +
    '.click-spark{position:fixed;left:0;top:0;width:6px;height:6px;border-radius:50%;pointer-events:none;z-index:9999;background:var(--site-accent,#0066cc);animation:click-spark 700ms ease-out forwards}';
  document.head.appendChild(style);

  var hue = 265;
  var sky = null;

  function paint(x, y) {
    var ring = document.createElement('div');
    ring.className = 'click-ripple';
    ring.style.left = x + 'px';
    ring.style.top = y + 'px';
    ring.style.transform = 'translate(-50%,-50%)';
    document.body.appendChild(ring);
    setTimeout(function () { ring.remove(); }, 800);

    for (var i = 0; i < 6; i++) {
      var a = (Math.PI * 2 * i) / 6 + Math.random() * 0.6;
      var d = 40 + Math.random() * 50;
      var s = document.createElement('div');
      s.className = 'click-spark';
      s.style.left = x + 'px';
      s.style.top = y + 'px';
      s.style.setProperty('--dx', Math.cos(a) * d + 'px');
      s.style.setProperty('--dy', Math.sin(a) * d + 'px');
      document.body.appendChild(s);
      (function (el) { setTimeout(function () { el.remove(); }, 760); })(s);
    }

    sky = sky || document.getElementById('sky');
    if (sky) {
      hue = (hue + 37) % 360;
      sky.style.setProperty('--hue', hue);
    }
  }

  document.addEventListener('pointerdown', function (e) {
    if (e.button !== undefined && e.button !== 0) return;
    paint(e.clientX, e.clientY);
  }, { passive: true });
})();