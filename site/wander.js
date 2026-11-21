// Small change: add a "wander" button beside the "forget this" control
// that jumps to a random memory in the timeline.
(function () {
  var btn = document.createElement('button');
  btn.type = 'button';
  btn.id = 'wander-btn';
  btn.textContent = '✦ wander';
  btn.title = 'Jump to a random memory';
  btn.setAttribute('aria-label', 'Jump to a random memory');
  btn.style.cssText = 'margin-top:.6rem;margin-left:.5rem;padding:.15rem .55rem;font-size:.72rem;cursor:pointer;border:1px solid var(--site-border);background:var(--site-mark-bg);color:var(--site-text);border-radius:10px;';
  btn.addEventListener('click', function () {
    if (typeof window.show === 'function' && Array.isArray(window.memories)) {
      window.show(Math.floor(Math.random() * window.memories.length));
    }
  });
  var frag = document.getElementById('fragment');
  if (!frag) return;
  var next = frag.querySelector('button');
  if (next) {
    frag.insertBefore(btn, next);
  } else {
    frag.appendChild(btn);
  }
})();