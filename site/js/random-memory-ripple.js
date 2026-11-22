(function () {
  var style = document.createElement('style');
  style.textContent = '@keyframes ripple { from { transform: scale(0); opacity: 0.4; } to { transform: scale(4); opacity: 0; } } .ripple { position: absolute; border-radius: 50%; background: var(--site-accent); pointer-events: none; animation: ripple 0.5s ease-out; }';
  document.head.appendChild(style);

  function addRipple(e) {
    var btn = e.currentTarget;
    btn.style.position = 'relative';
    btn.style.overflow = 'hidden';
    var rect = btn.getBoundingClientRect();
    var size = Math.max(rect.width, rect.height);
    var ripple = document.createElement('span');
    ripple.className = 'ripple';
    ripple.style.width = ripple.style.height = size + 'px';
    ripple.style.left = (e.clientX - rect.left - size / 2) + 'px';
    ripple.style.top = (e.clientY - rect.top - size / 2) + 'px';
    btn.appendChild(ripple);
    setTimeout(function () { ripple.remove(); }, 500);
  }

  function init() {
    var btn = document.getElementById('random-memory');
    if (!btn) return;
    btn.addEventListener('click', addRipple);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();