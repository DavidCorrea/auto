(function() {
  const seq = [38, 38, 40, 40, 37, 39, 37, 39, 66, 65];
  let i = 0;
  const style = document.createElement('style');
  style.textContent = `@keyframes ring{0%{transform:scale(0.5);opacity:.5}100%{transform:scale(1);opacity:0}}`;
  document.head.appendChild(style);
  document.addEventListener('keydown', e => {
    if (e.keyCode === seq[i]) {
      i++;
      if (i === seq.length) {
        if (window.playMemoryChime) {
          window.playMemoryChime();
        } else {
          const a = new Audio('data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAABCxAgAEABAAZGF0YUgAAAA=');
          a.play();
        }
        const ring = document.createElement('div');
        ring.id = 'konami-ring';
        ring.style.position = 'fixed';
        ring.style.top = '50%';
        ring.style.left = '50%';
        ring.style.transform = 'translate(-50%,-50%)';
        ring.style.width = '200px';
        ring.style.height = '200px';
        ring.style.border = '2px solid var(--site-accent)';
        ring.style.borderRadius = '50%';
        ring.style.animation = 'ring 1s ease-out';
        document.body.appendChild(ring);
        setTimeout(() => ring.remove(), 1500);
        i = 0;
      }
    } else {
      i = 0;
    }
  });
})();