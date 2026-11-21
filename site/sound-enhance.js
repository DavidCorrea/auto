(() => {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  const canvasShow = window.show;
  window.show = function(i) {
    canvasShow(i);
    setTimeout(() => playHarmonic(i), 300);
  };
  function playHarmonic(i) {
    const ctx = AC ? new AC() : null;
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume();
    const osc1 = ctx.createOscillator();
    osc1.type = 'sine';
    osc1.frequency.value = 520 + i * 90;
    const gain1 = ctx.createGain();
    gain1.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain1.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + 0.01);
    gain1.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.18);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start();
    osc1.stop(ctx.currentTime + 0.2);
    const osc2 = ctx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.value = (520 + i * 90) * 2;
    const gain2 = ctx.createGain();
    gain2.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain2.gain.exponentialRampToValueAtTime(0.05, ctx.currentTime + 0.01);
    gain2.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.2);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start();
    osc2.stop(ctx.currentTime + 0.25);
  }
})();