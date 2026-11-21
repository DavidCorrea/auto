document.addEventListener('keydown', function (e) {
  var seq = window.__konamiSeq || [];
  var map = { arrowup: 'w', w: 'w', arrowdown: 's', s: 's', arrowleft: 'a', a: 'a', arrowright: 'd', d: 'd' };
  var key = map[e.key] || e.key.toLowerCase();
  seq.push(key);
  if (seq.join(',') === 'w,w,s,s,a,d,a,d,b,a') {
    var sky = document.getElementById('sky');
    if (sky) sky.style.setProperty('--hue', (Math.random() * 360).toFixed(0));
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      if (!window.__beepCtx) window.__beepCtx = new AC();
      var ctx = window.__beepCtx;
      if (ctx.state === 'suspended') ctx.resume();
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 520;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.18);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.2);
    } catch (e) {}
  }
  seq = seq.slice(-10);
});