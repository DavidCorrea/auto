(function () {
  var code = ['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','b','a'];
  var pos = 0;
  var ctx = null;
  var sky = null;

  var style = document.createElement('style');
  style.textContent = [
    '#sky.konami-aurora{animation:konami-bend 3.2s cubic-bezier(.3,0,.2,1) 1}',
    '@keyframes konami-bend{',
    '0%{filter:hue-rotate(0deg) saturate(1)}',
    '18%{filter:hue-rotate(150deg) saturate(2.4) brightness(1.28)}',
    '42%{filter:hue-rotate(-100deg) saturate(2) brightness(1.12)}',
    '68%{filter:hue-rotate(250deg) saturate(2.6) brightness(1.34)}',
    '100%{filter:hue-rotate(0deg) saturate(1)}}',
    'body.konami-flash::after{content:"";position:fixed;inset:0;pointer-events:none;z-index:9998;',
    'background:radial-gradient(circle at 50% 38%,rgba(107,78,255,.32),rgba(233,75,60,.14) 45%,transparent 68%);',
    'animation:konami-flash 1.6s ease-out forwards}',
    '@keyframes konami-flash{from{opacity:0}22%{opacity:1}to{opacity:0}}',
    '#konami-toast{position:fixed;left:50%;bottom:1.6rem;transform:translateX(-50%);z-index:10000;',
    'font:0.8rem/1.4 "Courier New",monospace;letter-spacing:.08em;padding:.5rem .9rem;border-radius:12px;',
    'background:var(--site-mark-bg,#fdf6e3);border:1px solid var(--site-border,#ccc);color:var(--site-text,#333);',
    'box-shadow:0 4px 18px rgba(107,78,255,.35);opacity:0;transition:opacity .4s ease,transform .4s ease}',
    '#konami-toast.on{opacity:1;transform:translateX(-50%) translateY(-6px)}',
    '@media (prefers-reduced-motion: reduce){#sky.konami-aurora{animation-duration:1.2s}body.konami-flash::after{animation-duration:.6s}}'
  ].join('\n');
  document.head.appendChild(style);

  function chime() {
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    if (!ctx) ctx = new AC();
    if (ctx.state === 'suspended') ctx.resume();
    var t0 = ctx.currentTime + 0.03;
    var notes = [523.25, 659.25, 783.99, 1046.5, 1318.51];
    notes.forEach(function (f, i) {
      var o = ctx.createOscillator();
      var g = ctx.createGain();
      o.type = i % 2 ? 'triangle' : 'square';
      o.frequency.value = f;
      var at = t0 + i * 0.09;
      g.gain.setValueAtTime(0.0001, at);
      g.gain.exponentialRampToValueAtTime(0.075, at + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, at + 0.22);
      o.connect(g);
      g.connect(ctx.destination);
      o.start(at);
      o.stop(at + 0.26);
    });
  }

  function toast() {
    var old = document.getElementById('konami-toast');
    if (old && old.parentNode) old.parentNode.removeChild(old);
    var t = document.createElement('div');
    t.id = 'konami-toast';
    t.textContent = '\u2191\u2191\u2193\u2193\u2190\u2192\u2190\u2192 B A \u2014 the sky remembers';
    document.body.appendChild(t);
    requestAnimationFrame(function () { t.classList.add('on'); });
    setTimeout(function () {
      t.classList.remove('on');
      setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 500);
    }, 2600);
  }

  function fire() {
    sky = sky || document.getElementById('sky');
    if (sky) {
      sky.classList.remove('konami-aurora');
      void sky.offsetWidth;
      sky.classList.add('konami-aurora');
      setTimeout(function () { sky.classList.remove('konami-aurora'); }, 3400);
    }
    document.body.classList.remove('konami-flash');
    void document.body.offsetWidth;
    document.body.classList.add('konami-flash');
    setTimeout(function () { document.body.classList.remove('konami-flash'); }, 1800);
    chime();
    toast();
  }

  document.addEventListener('keydown', function (e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    var k = e.key && e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (k === code[pos]) {
      pos++;
      if (pos === code.length) { pos = 0; fire(); }
    } else {
      pos = k === code[0] ? 1 : 0;
    }
  });
})();