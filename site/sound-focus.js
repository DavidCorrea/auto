(function () {
  let ctx = null;
  let enabled = false;
  var toggle = document.createElement('button');
  toggle.id = 'sound-toggle';
  toggle.type = 'button';
  toggle.textContent = '🔇 Off';
  toggle.setAttribute('aria-pressed', 'false');
  toggle.style.cssText = 'position:fixed;bottom:1rem;right:1rem;z-index:9999;border:1px solid #ccc;background:#fdf6e3;color:#333;border-radius:12px;padding:.4rem .8rem;cursor:pointer;font-size:.8rem';
  document.body.appendChild(toggle);
  function ensure() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
  }
  function tone() {
    if (!enabled) return;
    ensure();
    var o = ctx.createOscillator();
    var g = ctx.createGain();
    o.type = 'sine';
    o.frequency.value = 220;
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.04, ctx.currentTime + 0.08);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 1.8);
    o.connect(g);
    g.connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 1.9);
  }
  toggle.addEventListener('click', function () {
    enabled = !enabled;
    toggle.textContent = enabled ? '🔊 On' : '🔇 Off';
    toggle.setAttribute('aria-pressed', String(enabled));
  });
  document.addEventListener('focusin', function (e) {
    if (e.target.matches('button.portrait, a.portrait, [class*="portrait"]')) tone();
  });
})();