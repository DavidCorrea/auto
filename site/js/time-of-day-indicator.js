(function () {
  var el = document.createElement('div');
  el.id = 'sun-moon';
  el.setAttribute('aria-label', 'Time of day');
  el.style.cssText = 'position:fixed;top:10px;left:0;width:28px;height:28px;border-radius:50%;pointer-events:none;z-index:10000;font-size:24px;display:flex;align-items:center;justify-content:center;transition:left .8s ease,filter .4s ease;';
  document.body.appendChild(el);

  function update() {
    var h = new Date().getHours();
    var day = h >= 6 && h < 18;
    el.textContent = day ? '☀️' : '🌙';
    var pct = ((h + 0.5) / 24 * 100);
    el.style.left = pct + '%';
    if (!day) {
      el.style.filter = 'drop-shadow(0 0 10px rgba(255,255,255,.5))';
    } else {
      el.style.filter = 'drop-shadow(0 0 10px rgba(255,200,50,.6))';
    }
  }

  update();
  setInterval(update, 60000);
})();