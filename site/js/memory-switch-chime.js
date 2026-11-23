(function () {
  var ctx = null;
  function chime() {
    try {
      if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
      var t = ctx.currentTime;
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, t);
      osc.frequency.exponentialRampToValueAtTime(1318.5, t + 0.18);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.22, t + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.5);
    } catch (e) {}
  }
  window.playMemoryChime = chime;
  window.addEventListener('memory:switch', chime);
})();
=======