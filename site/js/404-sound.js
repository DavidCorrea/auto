// 404 chime — a tiny sound for the page that was not found.
// Drop this one line into 404.html to hear it:
//   <script src="js/404-sound.js"></script>
// It plays once, only here, and only if the visitor hasn't asked for reduced motion.
(function () {
  if (typeof window === 'undefined') return;
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  try {
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    var ctx = new AC();
    var notes = [523.25, 659.25, 783.99]; // C5, E5, G5 — a small, gentle arpeggio
    var now = ctx.currentTime;
    notes.forEach(function (freq, i) {
      var t = now + i * 0.18;
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.18, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 1.1);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 1.15);
    });
  } catch (e) { /* no sound, no problem */ }
})();