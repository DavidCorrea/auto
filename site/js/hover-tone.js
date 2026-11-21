// hover-tone.js — Subtle hover tones for timeline marks
// Include with: <script src="js/hover-tone.js"></script>

(function () {
  var AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;

  var ctx;
  function getCtx() {
    if (!ctx) ctx = new AC();
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function playTone(freq, duration) {
    try {
      var c = getCtx();
      var osc = c.createOscillator();
      var gain = c.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, c.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.05, c.currentTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + duration);
      osc.connect(gain);
      gain.connect(c.destination);
      osc.start();
      osc.stop(c.currentTime + duration);
    } catch (e) {}
  }

  function attach() {
    document.querySelectorAll('.mark').forEach(function (mark, i) {
      mark.addEventListener('mouseenter', function () {
        playTone(520 + i * 90, 0.06);
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', attach);
  } else {
    attach();
  }
})();