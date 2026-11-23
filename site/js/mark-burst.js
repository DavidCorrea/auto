```javascript
(() => {
  const colors = ['#e94b3c','#f2a65a','#f7d354','#6fcf97','#56ccf2','#9b5de5'];
  let ps = [];

  function burst(x, y) {
    for (let k = 0; k < 30; k++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 1.2 + Math.random() * 4.5;
      ps.push({ x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 1.2, life: 1, c: colors[k % colors.length] });
    }
    (function anim() {
      let alive = false;
      for (const p of ps) {
        if (p.life <= 0) continue;
        alive = true;
        p.x += p.vx; p.y += p.vy; p.vy += 0.06; p.life -= 0.022;
      }
      ctx.globalAlpha = 1;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const p of ps) {
        if (p.life <= 0) continue;
        ctx.fillStyle = p.c;
        ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
      }
      if (alive) requestAnimationFrame(anim);
      else { ctx.clearRect(0, 0, canvas.width, canvas.height); ps = []; }
    })();
  }

  const canvas = document.createElement('canvas');
  canvas.id = 'burst-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  canvas.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:50';
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d');

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  document.querySelectorAll('.mark').forEach(el => {
    el.addEventListener('click', () => {
      const rect = el.getBoundingClientRect();
      burst(rect.left + rect.width / 2, rect.top + rect.height / 2);
    });
  });
})();
```